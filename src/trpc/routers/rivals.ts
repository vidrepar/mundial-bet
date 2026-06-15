import { eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bets, rivals, user } from "@/db/schema";
import { TrpcError } from "@/lib/errors";
import { createTRPCRouter, protectedProcedure } from "../init";

export const rivalsRouter = createTRPCRouter({
  /* my rival + the head-to-head record + everyone I could pick */
  get: protectedProcedure.query(({ ctx }) => {
    const me = ctx.user.id;
    const members = db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .where(ne(user.id, me))
      .all();

    const row = db.select().from(rivals).where(eq(rivals.userId, me)).get();
    const rival = row ? members.find((m) => m.id === row.rivalId) ?? null : null;
    if (!rival) return { rival: null, members, h2h: null };

    /* compare points on every match both of us were scored on */
    const score = (uid: string) => {
      const map = new Map<number, number>();
      for (const b of db.select().from(bets).where(eq(bets.userId, uid)).all()) {
        if (b.points != null) map.set(b.matchId, b.points);
      }
      return map;
    };
    const mine = score(me);
    const theirs = score(rival.id);
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let myPts = 0;
    let rivalPts = 0;
    for (const [mid, mp] of mine) {
      if (!theirs.has(mid)) continue;
      const rp = theirs.get(mid) ?? 0;
      myPts += mp;
      rivalPts += rp;
      if (mp > rp) wins++;
      else if (mp < rp) losses++;
      else draws++;
    }
    return {
      rival,
      members,
      h2h: { wins, draws, losses, myPts, rivalPts, matches: wins + draws + losses },
    };
  }),

  set: protectedProcedure
    .input(z.object({ rivalId: z.string() }))
    .mutation(({ ctx, input }) => {
      if (input.rivalId === ctx.user.id) {
        throw TrpcError.badRequest("You can't rival yourself.");
      }
      const exists = db.select({ id: user.id }).from(user).where(eq(user.id, input.rivalId)).get();
      if (!exists) throw TrpcError.notFound("No such player.");
      db.insert(rivals)
        .values({ userId: ctx.user.id, rivalId: input.rivalId, createdAt: new Date() })
        .onConflictDoUpdate({ target: rivals.userId, set: { rivalId: input.rivalId } })
        .run();
      return { ok: true };
    }),

  clear: protectedProcedure.mutation(({ ctx }) => {
    db.delete(rivals).where(eq(rivals.userId, ctx.user.id)).run();
    return { ok: true };
  }),
});
