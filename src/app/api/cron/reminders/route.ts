import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";

/* Coolify scheduled task hits this (e.g. hourly):
 *   curl -s "$APP_URL/api/cron/reminders?secret=$CRON_SECRET"
 * It pings the group's Telegram chat about matches kicking off soon
 * that someone still hasn't bet on. Free + zero infra.
 */

const WINDOW_HOURS = 6;

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, reason: "telegram not configured" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  return { sent: res.ok };
}

function handle(req: Request) {
  /* 1. auth the cron caller */
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  /* 2. find matches kicking off within the window, still open */
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3600_000);
  const soon = db
    .select()
    .from(matches)
    .where(and(gt(matches.kickoffUtc, now), lt(matches.kickoffUtc, until)))
    .all();

  if (soon.length === 0) {
    return NextResponse.json({ ok: true, matches: 0, reminded: false });
  }

  /* 3. who still owes a pick? (allowlisted users with no bet) */
  const users = db.select().from(user).all();
  const lines: string[] = [];
  for (const m of soon) {
    const placed = db
      .select({ userId: bets.userId })
      .from(bets)
      .where(eq(bets.matchId, m.id))
      .all();
    const placedIds = new Set(placed.map((p) => p.userId));
    const missing = users.filter((u) => !placedIds.has(u.id));
    const kickoff = m.kickoffUtc.toISOString().slice(11, 16);
    const missingTxt = missing.length
      ? `⏳ still no pick: ${missing.map((u) => u.name.split(" ")[0]).join(", ")}`
      : "✅ everyone's in";
    lines.push(
      `${m.homeFlag} ${m.homeTeam} vs ${m.awayTeam} ${m.awayFlag} — ${kickoff} UTC\n${missingTxt}`,
    );
  }

  const text = `⚽ <b>Mundial '26 — bets close soon!</b>\n\n${lines.join("\n\n")}\n\n👉 ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/bet`;
  return sendTelegram(text).then((r) =>
    NextResponse.json({ ok: true, matches: soon.length, telegram: r }),
  );
}

export function GET(req: Request) {
  return handle(req);
}

export function POST(req: Request) {
  return handle(req);
}
