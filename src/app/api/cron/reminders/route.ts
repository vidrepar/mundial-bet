import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";

/* Data endpoint for the free Gmail Apps Script (apps-script/reminders.gs).
 * Returns who still owes picks on matches within the window so the script
 * can email each of them. Guarded by CRON_SECRET.
 *   GET /api/cron/reminders?secret=$CRON_SECRET
 */
const WINDOW_HOURS = 6;

function handle(req: Request) {
  /* 1. auth the caller */
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
    return NextResponse.json({ ok: true, matches: 0, recipients: [] });
  }

  /* 3. per-user: which of those matches are still unbet? */
  const users = db.select().from(user).all();
  const missingByUser = new Map<string, typeof soon>();
  for (const m of soon) {
    const placed = new Set(
      db
        .select({ u: bets.userId })
        .from(bets)
        .where(eq(bets.matchId, m.id))
        .all()
        .map((r) => r.u),
    );
    for (const u of users.filter((x) => !placed.has(x.id))) {
      const list = missingByUser.get(u.id) ?? [];
      list.push(m);
      missingByUser.set(u.id, list);
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
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
    recipients,
  });
}

export function GET(req: Request) {
  return handle(req);
}

export function POST(req: Request) {
  return handle(req);
}
