import { eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, comments, emailOutbox, matches, user } from "@/db/schema";
import { buildCommentDigest, buildResultEmail } from "@/lib/emails";
import { codeForTeam, espnDateKey, fetchEspnMatches, matchEspnByCodes } from "@/lib/espn";
import { enqueueEmail, flushOutbox } from "@/lib/notify";
import { scoreBet } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Coolify scheduled task hits this every minute — the ONLY scheduler.
 *   1. find matches in their live window (no live match → no ESPN call)
 *   2. poll ESPN, update live scores / status, auto-score on full time
 *   3. enqueue savage result emails + batched comment digests
 *   4. push the outbox to the Apps Script Gmail relay
 *   GET/POST /api/cron/tick?secret=$CRON_SECRET
 */
const PRE_MS = 5 * 60_000;
const MAX_MS = 180 * 60_000;
const DIGEST_MS = 30 * 60_000;

async function handle(req: Request) {
  const url = new URL(req.url);
  if (
    !process.env.CRON_SECRET ||
    url.searchParams.get("secret") !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let live = 0;
  let updated = 0;
  let finishedNow = 0;

  /* 1. matches in their live window, not already finished */
  const candidates = db
    .select()
    .from(matches)
    .where(eq(matches.finished, false))
    .all()
    .filter((m) => {
      const k = m.kickoffUtc.getTime();
      return now >= k - PRE_MS && now <= k + MAX_MS;
    });
  live = candidates.length;

  /* 2. only call ESPN when something is actually on */
  if (candidates.length) {
    const keys = [...new Set(candidates.map((m) => espnDateKey(m.kickoffUtc)))];
    const results = await Promise.all(
      keys.map((k) => fetchEspnMatches(k).catch(() => [])),
    );
    const espn = results.flat();

    for (const m of candidates) {
      const hc = codeForTeam(m.homeTeam);
      const ac = codeForTeam(m.awayTeam);
      const found = matchEspnByCodes(espn, hc, ac);
      if (!found) continue;
      const { ev, swapped } = found;
      const hs = swapped ? ev.awayScore : ev.homeScore;
      const as = swapped ? ev.homeScore : ev.awayScore;

      if (ev.state === "in") {
        db.update(matches)
          .set({ status: "live", homeScore: hs, awayScore: as })
          .where(eq(matches.id, m.id))
          .run();
        updated++;
      } else if (ev.state === "post" && hs != null && as != null) {
        db.update(matches)
          .set({ status: "finished", finished: true, homeScore: hs, awayScore: as })
          .where(eq(matches.id, m.id))
          .run();
        /* auto-score every bet (admin can still reopen/setResult to override) */
        const matchBets = db.select().from(bets).where(eq(bets.matchId, m.id)).all();
        for (const b of matchBets) {
          const pts = scoreBet(b.predHome, b.predAway, hs, as, m.stage);
          db.update(bets).set({ points: pts }).where(eq(bets.id, b.id)).run();
        }
        const { subject, html } = buildResultEmail({
          id: m.id,
          stage: m.stage,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeFlag: m.homeFlag,
          awayFlag: m.awayFlag,
          homeScore: hs,
          awayScore: as,
        });
        enqueueEmail(`result:${m.id}`, subject, html);
        finishedNow++;
      }
    }
  }

  /* 3. batched comment digest (~30 min) */
  const digests = maybeQueueCommentDigests(now);

  /* 4. push the queue to the Gmail relay */
  const sent = await flushOutbox();

  return NextResponse.json({ ok: true, live, updated, finishedNow, digests, sent });
}

function maybeQueueCommentDigests(now: number): number {
  const lastRow = db
    .select({ c: sql<number | null>`max(created_at)` })
    .from(emailOutbox)
    .where(sql`kind LIKE 'comments:%'`)
    .get();
  const lastMs = lastRow?.c ? Number(lastRow.c) * 1000 : 0;
  if (now - lastMs < DIGEST_MS) return 0;

  /* first run only looks back 30 min — never blasts the whole comment history */
  const since = new Date(lastMs ? lastMs : now - DIGEST_MS);
  const fresh = db
    .select({
      matchId: comments.matchId,
      body: comments.body,
      name: user.name,
    })
    .from(comments)
    .innerJoin(user, eq(comments.userId, user.id))
    .where(gt(comments.createdAt, since))
    .all();
  if (!fresh.length) return 0;

  const byMatch = new Map<number, { name: string; body: string }[]>();
  for (const c of fresh) {
    const arr = byMatch.get(c.matchId) ?? [];
    arr.push({ name: c.name, body: c.body });
    byMatch.set(c.matchId, arr);
  }

  const bucket = Math.floor(now / DIGEST_MS);
  let queued = 0;
  for (const [matchId, cs] of byMatch) {
    const mm = db.select().from(matches).where(eq(matches.id, matchId)).get();
    if (!mm) continue;
    const { subject, html } = buildCommentDigest(
      {
        id: mm.id,
        homeTeam: mm.homeTeam,
        awayTeam: mm.awayTeam,
        homeFlag: mm.homeFlag,
        awayFlag: mm.awayFlag,
      },
      cs,
    );
    enqueueEmail(`comments:${bucket}:${matchId}`, subject, html);
    queued++;
  }
  return queued;
}

export function GET(req: Request) {
  return handle(req);
}

export function POST(req: Request) {
  return handle(req);
}
