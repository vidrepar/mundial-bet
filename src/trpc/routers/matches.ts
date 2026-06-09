import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";
import { shapeMatch } from "@/lib/match-shape";
import { baseProcedure, createTRPCRouter } from "../init";

const filterSchema = z
  .enum(["all", "upcoming", "live", "finished", "open"])
  .default("all");

export const matchesRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ filter: filterSchema }).optional())
    .query(({ ctx, input }) => {
      const nowMs = Date.now();
      const filter = input?.filter ?? "all";

      const all = db
        .select()
        .from(matches)
        .orderBy(asc(matches.kickoffUtc))
        .all();

      /* bet counts per match in one shot */
      const counts = db
        .select({ matchId: bets.matchId, c: sql<number>`count(*)` })
        .from(bets)
        .groupBy(bets.matchId)
        .all();
      const countMap = new Map(counts.map((r) => [r.matchId, Number(r.c)]));

      /* my bets if signed in */
      const myBetMap = new Map<number, (typeof bets.$inferSelect)>();
      if (ctx.user) {
        const mine = db
          .select()
          .from(bets)
          .where(eq(bets.userId, ctx.user.id))
          .all();
        for (const b of mine) myBetMap.set(b.matchId, b);
      }

      const shaped = all.map((m) =>
        shapeMatch(m, {
          myBet: myBetMap.get(m.id) ?? null,
          betCount: countMap.get(m.id) ?? 0,
          nowMs,
        }),
      );

      switch (filter) {
        case "open":
          return shaped.filter((m) => !m.locked);
        case "upcoming":
          return shaped.filter((m) => !m.finished && m.kickoffMs > nowMs);
        case "live":
          return shaped.filter(
            (m) => !m.finished && m.kickoffMs <= nowMs,
          );
        case "finished":
          return shaped.filter((m) => m.finished);
        default:
          return shaped;
      }
    }),

  byId: baseProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ ctx, input }) => {
      const m = db.select().from(matches).where(eq(matches.id, input.id)).get();
      if (!m) return null;
      const count = db
        .select({ c: sql<number>`count(*)` })
        .from(bets)
        .where(eq(bets.matchId, input.id))
        .get();
      let myBet = null;
      if (ctx.user) {
        myBet =
          db
            .select()
            .from(bets)
            .where(
              sql`${bets.userId} = ${ctx.user.id} and ${bets.matchId} = ${input.id}`,
            )
            .get() ?? null;
      }
      return shapeMatch(m, { myBet, betCount: Number(count?.c ?? 0) });
    }),
});
