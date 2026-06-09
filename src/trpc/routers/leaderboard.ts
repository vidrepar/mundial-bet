import { sql } from "drizzle-orm";
import { db } from "@/db";
import { bets, user } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "../init";

export const leaderboardRouter = createTRPCRouter({
  standings: baseProcedure.query(() => {
    const users = db.select().from(user).all();
    const agg = db
      .select({
        userId: bets.userId,
        points: sql<number>`coalesce(sum(${bets.points}),0)`,
        exact: sql<number>`coalesce(sum(case when ${bets.points}=3 then 1 else 0 end),0)`,
        outcome: sql<number>`coalesce(sum(case when ${bets.points}=1 then 1 else 0 end),0)`,
        scored: sql<number>`coalesce(sum(case when ${bets.points} is not null then 1 else 0 end),0)`,
        total: sql<number>`count(*)`,
      })
      .from(bets)
      .groupBy(bets.userId)
      .all();
    const map = new Map(agg.map((a) => [a.userId, a]));

    const rows = users.map((u) => {
      const a = map.get(u.id);
      const points = Number(a?.points ?? 0);
      const exact = Number(a?.exact ?? 0);
      const outcome = Number(a?.outcome ?? 0);
      const scored = Number(a?.scored ?? 0);
      const total = Number(a?.total ?? 0);
      return {
        userId: u.id,
        name: u.name,
        image: u.image,
        points,
        exact,
        outcome,
        scored,
        total,
        hitRate: scored ? Math.round(((exact + outcome) / scored) * 100) : 0,
      };
    });

    rows.sort(
      (a, b) =>
        b.points - a.points || b.exact - a.exact || b.hitRate - a.hitRate,
    );
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }),
});
