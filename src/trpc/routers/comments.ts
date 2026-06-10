import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commentReads, comments, user } from "@/db/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";

export const commentsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ matchId: z.number().int() }))
    .query(({ input }) =>
      db
        .select({
          id: comments.id,
          body: comments.body,
          createdAt: comments.createdAt,
          userId: comments.userId,
          name: user.name,
          image: user.image,
        })
        .from(comments)
        .innerJoin(user, eq(comments.userId, user.id))
        .where(eq(comments.matchId, input.matchId))
        .orderBy(desc(comments.createdAt)) // latest first
        .all()
        .map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    ),

  add: protectedProcedure
    .input(
      z.object({
        matchId: z.number().int(),
        body: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(({ ctx, input }) => {
      db.insert(comments)
        .values({
          matchId: input.matchId,
          userId: ctx.user.id,
          body: input.body,
          createdAt: new Date(),
        })
        .run();
      /* author has implicitly read the thread */
      const now = new Date();
      db.insert(commentReads)
        .values({ userId: ctx.user.id, matchId: input.matchId, lastReadAt: now })
        .onConflictDoUpdate({
          target: [commentReads.userId, commentReads.matchId],
          set: { lastReadAt: now },
        })
        .run();
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ ctx, input }) => {
      db.delete(comments)
        .where(and(eq(comments.id, input.id), eq(comments.userId, ctx.user.id)))
        .run();
      return { ok: true };
    }),

  /* mark a match's thread as read up to now */
  markRead: protectedProcedure
    .input(z.object({ matchId: z.number().int() }))
    .mutation(({ ctx, input }) => {
      const now = new Date();
      db.insert(commentReads)
        .values({ userId: ctx.user.id, matchId: input.matchId, lastReadAt: now })
        .onConflictDoUpdate({
          target: [commentReads.userId, commentReads.matchId],
          set: { lastReadAt: now },
        })
        .run();
      return { ok: true };
    }),

  /* unread counts (others' comments newer than my last read) → notifications */
  unread: protectedProcedure.query(({ ctx }) => {
    const all = db
      .select({
        matchId: comments.matchId,
        userId: comments.userId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .all();
    const reads = db
      .select()
      .from(commentReads)
      .where(eq(commentReads.userId, ctx.user.id))
      .all();
    const lastRead = new Map(
      reads.map((r) => [r.matchId, r.lastReadAt.getTime()]),
    );
    const byMatch: Record<number, number> = {};
    let total = 0;
    for (const c of all) {
      if (c.userId === ctx.user.id) continue;
      const lr = lastRead.get(c.matchId) ?? 0;
      if (c.createdAt.getTime() > lr) {
        byMatch[c.matchId] = (byMatch[c.matchId] ?? 0) + 1;
        total++;
      }
    }
    return { total, byMatch };
  }),

  /* who has read this thread + up to when → read receipts */
  reads: baseProcedure
    .input(z.object({ matchId: z.number().int() }))
    .query(({ input }) =>
      db
        .select({
          userId: commentReads.userId,
          name: user.name,
          image: user.image,
          lastReadAt: commentReads.lastReadAt,
        })
        .from(commentReads)
        .innerJoin(user, eq(commentReads.userId, user.id))
        .where(eq(commentReads.matchId, input.matchId))
        .all()
        .map((r) => ({ ...r, lastReadAt: r.lastReadAt.toISOString() })),
    ),
});
