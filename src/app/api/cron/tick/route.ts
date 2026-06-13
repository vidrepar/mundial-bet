import { eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, comments, emailOutbox, matches, odds, user } from "@/db/schema";
import { buildCommentDigest, buildResultEmail } from "@/lib/emails";
import {
  codeForTeam,
  espnDateKey,
  fetchEspnMatches,
  fetchEspnOdds,
  matchEspnByCodes,
} from "@/lib/espn";
import type { EspnMatch } from "@/lib/espn.types";
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

/* odds polling: price matches up to 36h out, refresh at most every 15 min,
 * and cap fetches per tick → stays well under any free-tier rate limit. */
const ODDS_TTL = 15 * 60_000;
const ODDS_WINDOW = 36 * 60 * 60_000;
const ODDS_MAX = 10;

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

  /* 3. refresh betting odds (throttled) */
  const oddsUpdated = await refreshOdds(now);

  /* 4. batched comment digest (~30 min) */
  const digests = maybeQueueCommentDigests(now);

  /* 5. push the queue to the Gmail relay */
  const sent = await flushOutbox();

  return NextResponse.json({
    ok: true,
    live,
    updated,
    finishedNow,
    oddsUpdated,
    digests,
    sent,
  });
}

/* Poll ESPN's free odds feed for soon/live matches and cache decimal odds. */
async function refreshOdds(now: number): Promise<number> {
  /* 1. matches worth pricing: not finished, kickoff within the window */
  const upcoming = db
    .select()
    .from(matches)
    .where(eq(matches.finished, false))
    .all()
    .filter((m) => m.kickoffUtc.getTime() <= now + ODDS_WINDOW)
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());

  /* 2. drop ones priced within the TTL, cap how many we fetch this tick */
  const fresh = new Map(
    db
      .select()
      .from(odds)
      .all()
      .map((o) => [o.matchId, o.updatedAt.getTime()]),
  );
  const stale = upcoming
    .filter((m) => now - (fresh.get(m.id) ?? 0) > ODDS_TTL)
    .slice(0, ODDS_MAX);
  if (!stale.length) return 0;

  /* 3. one scoreboard fetch per unique ESPN date → resolves event ids */
  const keys = [...new Set(stale.map((m) => espnDateKey(m.kickoffUtc)))];
  const byKey = new Map<string, EspnMatch[]>();
  await Promise.all(
    keys.map(async (k) =>
      byKey.set(k, await fetchEspnMatches(k).catch(() => [])),
    ),
  );

  /* 4. match → event id → 3-way odds → upsert */
  let updated = 0;
  for (const m of stale) {
    const list = byKey.get(espnDateKey(m.kickoffUtc)) ?? [];
    const found = matchEspnByCodes(
      list,
      codeForTeam(m.homeTeam),
      codeForTeam(m.awayTeam),
    );
    if (!found?.ev.id) continue;
    const o = await fetchEspnOdds(found.ev.id);
    if (!o) continue;
    const homeDec = found.swapped ? o.awayDec : o.homeDec;
    const awayDec = found.swapped ? o.homeDec : o.awayDec;
    const row = {
      provider: o.provider,
      homeDec,
      drawDec: o.drawDec,
      awayDec,
      updatedAt: new Date(now),
    };
    db.insert(odds)
      .values({ matchId: m.id, ...row })
      .onConflictDoUpdate({ target: odds.matchId, set: row })
      .run();
    updated++;
  }
  return updated;
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
