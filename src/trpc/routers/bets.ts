import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bets, matches, user } from "@/db/schema";
import { TrpcError } from "@/lib/errors";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";

const placeInput = z.object({
  matchId: z.number().int(),
  predHome: z.number().int().min(0).max(30),
  predAway: z.number().int().min(0).max(30),
});

export const betsRouter = createTRPCRouter({
  /* place or update a bet — only allowed strictly before kickoff */
  place: protectedProcedure.input(placeInput).mutation(({ ctx, input }) => {
    /* 1. match must exist */
    const m = db
      .select()
      .from(matches)
      .where(eq(matches.id, input.matchId))
      .get();
    if (!m) throw TrpcError.notFound("Match not found.");

    /* 2. betting closes at kickoff */
    if (m.finished || Date.now() >= m.kickoffUtc.getTime()) {
      throw TrpcError.badRequest("Betting is closed for this match.");
    }

    /* 3. upsert the bet */
    const now = new Date();
    db.insert(bets)
      .values({
        userId: ctx.user.id,
        matchId: input.matchId,
        predHome: input.predHome,
        predAway: input.predAway,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [bets.userId, bets.matchId],
        set: {
          predHome: input.predHome,
          predAway: input.predAway,
          updatedAt: now,
        },
      })
      .run();
    return { ok: true };
  }),

  mine: protectedProcedure.query(({ ctx }) =>
    db.select().from(bets).where(eq(bets.userId, ctx.user.id)).all(),
  ),

  /* everyone's picks for a match — hidden until the match locks */
  forMatch: baseProcedure
    .input(z.object({ matchId: z.number().int() }))
    .query(({ input }) => {
      const m = db
        .select()
        .from(matches)
        .where(eq(matches.id, input.matchId))
        .get();
      if (!m) return { locked: false, bets: [] };
      const locked = m.finished || Date.now() >= m.kickoffUtc.getTime();
      if (!locked) return { locked: false, bets: [] };
      const rows = db
        .select({
          userId: bets.userId,
          name: user.name,
          image: user.image,
          predHome: bets.predHome,
          predAway: bets.predAway,
          points: bets.points,
        })
        .from(bets)
        .innerJoin(user, eq(bets.userId, user.id))
        .where(eq(bets.matchId, input.matchId))
        .all();
      return { locked: true, bets: rows };
    }),
});
