import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bets, comments, matches } from "@/db/schema";
import { isAdmin } from "@/lib/env";
import { TrpcError } from "@/lib/errors";
import { shapeMatch } from "@/lib/match-shape";
import { scoreBet } from "@/lib/scoring";
import {
  adminProcedure,
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "../init";

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

      const counts = db
        .select({ matchId: bets.matchId, c: sql<number>`count(*)` })
        .from(bets)
        .groupBy(bets.matchId)
        .all();
      const countMap = new Map(counts.map((r) => [r.matchId, Number(r.c)]));

      const commentCounts = db
        .select({ matchId: comments.matchId, c: sql<number>`count(*)` })
        .from(comments)
        .groupBy(comments.matchId)
        .all();
      const commentMap = new Map(
        commentCounts.map((r) => [r.matchId, Number(r.c)]),
      );

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
          commentCount: commentMap.get(m.id) ?? 0,
          nowMs,
        }),
      );

      switch (filter) {
        case "open":
          return shaped.filter((m) => !m.locked);
        case "upcoming":
          return shaped.filter((m) => !m.finished && m.kickoffMs > nowMs);
        case "live":
          return shaped.filter((m) => !m.finished && m.kickoffMs <= nowMs);
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
      const ccount = db
        .select({ c: sql<number>`count(*)` })
        .from(comments)
        .where(eq(comments.matchId, input.id))
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
      return shapeMatch(m, {
        myBet,
        betCount: Number(count?.c ?? 0),
        commentCount: Number(ccount?.c ?? 0),
      });
    }),

  amAdmin: protectedProcedure.query(({ ctx }) => ({
    isAdmin: isAdmin(ctx.user.email),
  })),

  /* ADMIN ONLY: enter the official final result, once the match has kicked
   * off (you can't pre-enter a result). Scores everyone's bets. */
  setResult: adminProcedure
    .input(
      z.object({
        matchId: z.number().int(),
        homeScore: z.number().int().min(0).max(30),
        awayScore: z.number().int().min(0).max(30),
      }),
    )
    .mutation(({ input }) => {
      const m = db
        .select()
        .from(matches)
        .where(eq(matches.id, input.matchId))
        .get();
      if (!m) throw TrpcError.notFound("Match not found.");
      if (Date.now() < m.kickoffUtc.getTime()) {
        throw TrpcError.badRequest(
          "You can only enter a result after the match has kicked off.",
        );
      }

      db.update(matches)
        .set({
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          finished: true,
          status: "finished",
        })
        .where(eq(matches.id, input.matchId))
        .run();

      const matchBets = db
        .select()
        .from(bets)
        .where(eq(bets.matchId, input.matchId))
        .all();
      for (const b of matchBets) {
        const pts = scoreBet(
          b.predHome,
          b.predAway,
          input.homeScore,
          input.awayScore,
          m.stage,
        );
        db.update(bets).set({ points: pts }).where(eq(bets.id, b.id)).run();
      }
      return { ok: true, scored: matchBets.length };
    }),

  reopen: adminProcedure
    .input(z.object({ matchId: z.number().int() }))
    .mutation(({ input }) => {
      db.update(matches)
        .set({
          finished: false,
          status: "scheduled",
          homeScore: null,
          awayScore: null,
        })
        .where(eq(matches.id, input.matchId))
        .run();
      db.update(bets)
        .set({ points: null })
        .where(eq(bets.matchId, input.matchId))
        .run();
      return { ok: true };
    }),
});
