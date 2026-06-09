import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "../init";

export const statsRouter = createTRPCRouter({
  overview: baseProcedure.query(() => {
    const allBets = db.select().from(bets).all();
    const allMatches = db.select().from(matches).all();
    const scored = allBets.filter((b) => b.points != null);
    const exact = scored.filter((b) => b.points === 3).length;
    const outcomeOnly = scored.filter((b) => b.points === 1).length;
    const totalPoints = scored.reduce((s, b) => s + (b.points ?? 0), 0);
    return {
      totalBets: allBets.length,
      scoredBets: scored.length,
      finishedMatches: allMatches.filter((m) => m.finished).length,
      totalMatches: allMatches.length,
      exact,
      outcomeOnly,
      avgPoints: scored.length
        ? Math.round((totalPoints / scored.length) * 100) / 100
        : 0,
      exactRate: scored.length
        ? Math.round((exact / scored.length) * 100)
        : 0,
    };
  }),

  /* cumulative points per player across finished matches → line chart */
  pointsTimeline: baseProcedure.query(() => {
    const users = db.select().from(user).all();
    const finished = db
      .select()
      .from(matches)
      .where(eq(matches.finished, true))
      .orderBy(asc(matches.kickoffUtc))
      .all();
    const allBets = db.select().from(bets).all();
    const ptByUserMatch = new Map<string, number>();
    for (const b of allBets) {
      if (b.points != null) ptByUserMatch.set(`${b.userId}:${b.matchId}`, b.points);
    }
    const labels = finished.map((m) => ({
      id: m.id,
      label: `${m.homeFlag}${m.awayFlag}`,
      kickoff: m.kickoffUtc.toISOString(),
    }));
    const series = users.map((u) => {
      let cum = 0;
      const points = finished.map((m) => {
        cum += ptByUserMatch.get(`${u.id}:${m.id}`) ?? 0;
        return cum;
      });
      return { userId: u.id, name: u.name, image: u.image, points };
    });
    return { labels, series };
  }),
});
