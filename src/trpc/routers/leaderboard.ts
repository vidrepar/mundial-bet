import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { isExactScore, missedPenalty } from "@/lib/scoring";
import { baseProcedure, createTRPCRouter } from "../init";

export const leaderboardRouter = createTRPCRouter({
  standings: baseProcedure.query(() => {
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
        if (isExactScore(b.predHome, b.predAway, m.homeScore, m.awayScore))
          exact++;
      }

      /* −1 / −2 for each finished match left unbet */
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
      (a, b) =>
        b.points - a.points || b.exact - a.exact || b.hitRate - a.hitRate,
    );
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }),
});
