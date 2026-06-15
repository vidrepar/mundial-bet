import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { isExactScore, missedPenalty, scoreBet } from "@/lib/scoring";
import type { StandingRow } from "./standings.types";

/* Pool standings: points from scored bets minus −1/−2 per unbet finished match.
 * Shared by the leaderboard router and the savage result emails. */
export function computeStandings(): StandingRow[] {
  const users = db.select().from(user).all();
  const allBets = db.select().from(bets).all();
  const finished = db
    .select()
    .from(matches)
    .where(eq(matches.finished, true))
    .all();
  const mById = new Map(finished.map((m) => [m.id, m]));

  const betsByUser = new Map<string, (typeof bets.$inferSelect)[]>();
  for (const b of allBets) {
    const arr = betsByUser.get(b.userId) ?? [];
    arr.push(b);
    betsByUser.set(b.userId, arr);
  }

  const rows = users.map((u) => {
    const ub = betsByUser.get(u.id) ?? [];
    const betMatchIds = new Set(ub.map((b) => b.matchId));

    let points = 0;
    let exact = 0;
    let hits = 0;
    let scored = 0;
    for (const b of ub) {
      if (b.points == null) continue;
      const m = mById.get(b.matchId);
      if (!m || m.homeScore == null || m.awayScore == null) continue;
      scored++;
      points += b.points;
      if (b.points > 0) hits++;
      if (isExactScore(b.predHome, b.predAway, m.homeScore, m.awayScore)) exact++;
    }

    let missed = 0;
    for (const m of finished) {
      if (!betMatchIds.has(m.id)) {
        points -= missedPenalty(m.stage);
        missed++;
      }
    }

    return {
      userId: u.id,
      name: u.name,
      image: u.image,
      points,
      exact,
      hits,
      scored,
      missed,
      total: ub.length,
      hitRate: scored ? Math.round((hits / scored) * 100) : 0,
    };
  });

  rows.sort(
    (a, b) => b.points - a.points || b.exact - a.exact || b.hitRate - a.hitRate,
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/* provisional standings *as if live matches ended right now* — confirmed
 * points plus live-score points, re-ranked, with each player's rank movement.
 * Returns [] when nothing is live. */
export function computeLiveStandings() {
  const liveMatches = db
    .select()
    .from(matches)
    .where(eq(matches.status, "live"))
    .all()
    .filter((m) => !m.finished && m.homeScore != null && m.awayScore != null);
  if (liveMatches.length === 0) return [];

  const confirmed = computeStandings();
  const liveById = new Map(liveMatches.map((m) => [m.id, m]));
  const allBets = db.select().from(bets).all();

  const provByUser = new Map<string, number>();
  for (const b of allBets) {
    const m = liveById.get(b.matchId);
    if (!m || m.homeScore == null || m.awayScore == null) continue;
    const pts = scoreBet(b.predHome, b.predAway, m.homeScore, m.awayScore, m.stage);
    provByUser.set(b.userId, (provByUser.get(b.userId) ?? 0) + pts);
  }

  const ranked = confirmed
    .map((r) => {
      const prov = provByUser.get(r.userId) ?? 0;
      return { ...r, prov, livePoints: r.points + prov };
    })
    .sort((a, b) => b.livePoints - a.livePoints || b.exact - a.exact);

  return ranked.map((r, i) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    points: r.points,
    prov: r.prov,
    livePoints: r.livePoints,
    liveRank: i + 1,
    delta: r.rank - (i + 1), // +ve = climbing
  }));
}
