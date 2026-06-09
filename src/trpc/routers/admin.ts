import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bets, matches } from "@/db/schema";
import { isAdmin } from "@/lib/env";
import { TrpcError } from "@/lib/errors";
import { scoreBet } from "@/lib/scoring";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "../init";

export const adminRouter = createTRPCRouter({
  amAdmin: protectedProcedure.query(({ ctx }) => ({
    isAdmin: isAdmin(ctx.user.email),
  })),

  /* enter a final score → mark finished + score everyone's bets */
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
        );
        db.update(bets).set({ points: pts }).where(eq(bets.id, b.id)).run();
      }
      return { ok: true, scored: matchBets.length };
    }),

  /* undo a result (typo fix) */
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
