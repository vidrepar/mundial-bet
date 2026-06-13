import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { commentReactions, commentReads, comments, user } from "@/db/schema";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";

/* allowed reaction emojis (kept in sync with the UI picker) */
export const REACTION_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🔥",
  "😮",
  "😢",
  "🐐",
  "💀",
] as const;

export const commentsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ matchId: z.number().int() }))
    .query(({ ctx, input }) => {
      /* 1. all comments for the match (flat; client builds the 2-level tree) */
      const rows = db
        .select({
          id: comments.id,
          body: comments.body,
          createdAt: comments.createdAt,
          userId: comments.userId,
          parentId: comments.parentId,
          name: user.name,
          image: user.image,
        })
        .from(comments)
        .innerJoin(user, eq(comments.userId, user.id))
        .where(eq(comments.matchId, input.matchId))
        .orderBy(asc(comments.createdAt))
        .all();

      /* 2. reactions for those comments → {emoji, count, mine} per comment */
      const reactRows = db
        .select({
          commentId: commentReactions.commentId,
          emoji: commentReactions.emoji,
          userId: commentReactions.userId,
        })
        .from(commentReactions)
        .innerJoin(comments, eq(commentReactions.commentId, comments.id))
        .where(eq(comments.matchId, input.matchId))
        .all();

      const me = ctx.user?.id;
      const byComment = new Map<
        number,
        Map<string, { count: number; mine: boolean }>
      >();
      for (const r of reactRows) {
        const m = byComment.get(r.commentId) ?? new Map();
        const cur = m.get(r.emoji) ?? { count: 0, mine: false };
        cur.count++;
        if (r.userId === me) cur.mine = true;
        m.set(r.emoji, cur);
        byComment.set(r.commentId, m);
      }

      return rows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        reactions: [...(byComment.get(c.id)?.entries() ?? [])].map(
          ([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }),
        ),
      }));
    }),

  add: protectedProcedure
    .input(
      z.object({
        matchId: z.number().int(),
        body: z.string().trim().min(1).max(500),
        parentId: z.number().int().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => {
      /* flatten to max 2 levels: a reply to a reply attaches to its top-level */
      let parentId: number | null = null;
      if (input.parentId != null) {
        const parent = db
          .select({ id: comments.id, parentId: comments.parentId })
          .from(comments)
          .where(
            and(
              eq(comments.id, input.parentId),
              eq(comments.matchId, input.matchId),
            ),
          )
          .get();
        if (parent) parentId = parent.parentId ?? parent.id;
      }
      db.insert(comments)
        .values({
          matchId: input.matchId,
          userId: ctx.user.id,
          parentId,
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

  /* toggle an emoji reaction on a comment */
  react: protectedProcedure
    .input(
      z.object({
        commentId: z.number().int(),
        emoji: z.enum(REACTION_EMOJIS),
      }),
    )
    .mutation(({ ctx, input }) => {
      const existing = db
        .select({ id: commentReactions.id })
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, input.commentId),
            eq(commentReactions.userId, ctx.user.id),
            eq(commentReactions.emoji, input.emoji),
          ),
        )
        .get();
      if (existing) {
        db.delete(commentReactions)
          .where(eq(commentReactions.id, existing.id))
          .run();
        return { ok: true, reacted: false };
      }
      db.insert(commentReactions)
        .values({
          commentId: input.commentId,
          userId: ctx.user.id,
          emoji: input.emoji,
          createdAt: new Date(),
        })
        .run();
      return { ok: true, reacted: true };
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
