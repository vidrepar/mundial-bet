import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { tgSend } from "@/lib/telegram";

/* Coolify scheduled task hits this (e.g. hourly):
 *   curl -s "$APP_URL/api/cron/reminders?secret=$CRON_SECRET"
 * DMs each linked user about matches they still haven't bet on (within 6h),
 * and optionally posts a summary to the group chat. Free + zero infra.
 */
const WINDOW_HOURS = 6;

async function handle(req: Request) {
  /* 1. auth the cron caller */
  const url = new URL(req.url);
  if (
    !process.env.CRON_SECRET ||
    url.searchParams.get("secret") !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  /* 2. matches kicking off within the window */
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3600_000);
  const soon = db
    .select()
    .from(matches)
    .where(and(gt(matches.kickoffUtc, now), lt(matches.kickoffUtc, until)))
    .all();
  if (soon.length === 0) {
    return NextResponse.json({ ok: true, matches: 0, dms: 0 });
  }

  /* 3. who is missing which pick? */
  const users = db.select().from(user).all();
  const missingByUser = new Map<string, typeof soon>();
  const groupLines: string[] = [];
  for (const m of soon) {
    const placed = new Set(
      db
        .select({ u: bets.userId })
        .from(bets)
        .where(eq(bets.matchId, m.id))
        .all()
        .map((r) => r.u),
    );
    const missing = users.filter((u) => !placed.has(u.id));
    for (const u of missing) {
      const list = missingByUser.get(u.id) ?? [];
      list.push(m);
      missingByUser.set(u.id, list);
    }
    const kk = m.kickoffUtc.toISOString().slice(11, 16);
    groupLines.push(
      `${m.homeFlag} ${m.homeTeam} v ${m.awayTeam} ${m.awayFlag} — ${kk} UTC` +
        (missing.length
          ? ` · ⏳ ${missing.map((u) => u.name.split(" ")[0]).join(", ")}`
          : " · ✅"),
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  /* 4. personal DMs to linked users with outstanding picks */
  let dms = 0;
  for (const u of users) {
    if (!u.telegramChatId) continue;
    const mm = missingByUser.get(u.id);
    if (!mm?.length) continue;
    const lines = mm
      .map(
        (m) =>
          `• ${m.homeFlag} ${m.homeTeam} v ${m.awayTeam} ${m.awayFlag} — ${m.kickoffUtc
            .toISOString()
            .slice(11, 16)} UTC`,
      )
      .join("\n");
    const r = await tgSend(
      u.telegramChatId,
      `⚽ <b>Bets closing soon!</b>\nYou still owe picks on:\n${lines}\n\n👉 ${appUrl}/bet`,
    );
    if (r.ok) dms++;
  }

  /* 5. optional group summary */
  let group = false;
  if (process.env.TELEGRAM_CHAT_ID) {
    const r = await tgSend(
      process.env.TELEGRAM_CHAT_ID,
      `⚽ <b>Mundial '26 — next ${WINDOW_HOURS}h</b>\n\n${groupLines.join("\n")}\n\n👉 ${appUrl}/bet`,
    );
    group = r.ok;
  }

  /* 6. structured payload so a free Gmail Apps Script can email everyone
   *    who still owes picks (no OAuth client / SMTP creds needed). */
  const recipients = users
    .filter((u) => (missingByUser.get(u.id)?.length ?? 0) > 0)
    .map((u) => {
      const mm = missingByUser.get(u.id) ?? [];
      return {
        email: u.email,
        name: u.name,
        count: mm.length,
        lines: mm.map(
          (m) =>
            `${m.homeFlag} ${m.homeTeam} v ${m.awayTeam} ${m.awayFlag} — ${m.kickoffUtc
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")} UTC`,
        ),
      };
    });

  return NextResponse.json({
    ok: true,
    matches: soon.length,
    betUrl: `${appUrl}/bet`,
    dms,
    group,
    recipients,
  });
}

export function GET(req: Request) {
  return handle(req);
}

export function POST(req: Request) {
  return handle(req);
}
