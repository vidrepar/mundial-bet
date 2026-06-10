import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { isExactScore, missedPenalty } from "@/lib/scoring";
import { baseProcedure, createTRPCRouter } from "../init";

export const statsRouter = createTRPCRouter({
  overview: baseProcedure.query(() => {
    const allBets = db.select().from(bets).all();
    const allMatches = db.select().from(matches).all();
    const mById = new Map(allMatches.map((m) => [m.id, m]));
    const scored = allBets.filter((b) => b.points != null);

    let exact = 0;
    let totalPoints = 0;
    for (const b of scored) {
      totalPoints += b.points ?? 0;
      const m = mById.get(b.matchId);
      if (m && m.homeScore != null && m.awayScore != null) {
        if (isExactScore(b.predHome, b.predAway, m.homeScore, m.awayScore))
          exact++;
      }
    }

    return {
      totalBets: allBets.length,
      scoredBets: scored.length,
      finishedMatches: allMatches.filter((m) => m.finished).length,
      totalMatches: allMatches.length,
      exact,
      avgPoints: scored.length
        ? Math.round((totalPoints / scored.length) * 100) / 100
        : 0,
      exactRate: scored.length ? Math.round((exact / scored.length) * 100) : 0,
    };
  }),

  /* cumulative points per player across finished matches (incl. miss penalties) */
  pointsTimeline: baseProcedure.query(() => {
    const users = db.select().from(user).all();
    const finished = db
      .select()
      .from(matches)
      .where(eq(matches.finished, true))
      .orderBy(asc(matches.kickoffUtc))
      .all();
    const allBets = db.select().from(bets).all();
    const betByUserMatch = new Map<string, (typeof bets.$inferSelect)>();
    for (const b of allBets) betByUserMatch.set(`${b.userId}:${b.matchId}`, b);

    const labels = finished.map((m) => ({
      id: m.id,
      label: `${m.homeFlag}${m.awayFlag}`,
      kickoff: m.kickoffUtc.toISOString(),
    }));
    const series = users.map((u) => {
      let cum = 0;
      const points = finished.map((m) => {
        const b = betByUserMatch.get(`${u.id}:${m.id}`);
        if (!b) cum -= missedPenalty(m.stage);
        else if (b.points != null) cum += b.points;
        return cum;
      });
      return { userId: u.id, name: u.name, image: u.image, points };
    });
    return { labels, series };
  }),
});
