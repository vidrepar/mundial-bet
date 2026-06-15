import { and, asc, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatReads, matches, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

const MAX_HISTORY = 300;
const REF_RE = /#(\d+)/g;

/* pull every #<matchNumber> token out of a batch of message bodies */
function referencedMatchNumbers(bodies: string[]): number[] {
  const nums = new Set<number>();
  for (const b of bodies) {
    for (const m of b.matchAll(REF_RE)) nums.add(Number(m[1]));
  }
  return [...nums];
}

export const chatRouter = createTRPCRouter({
  /* the whole room, oldest→newest, plus a lookup of any matches referenced
   * inline so the client can render rich match chips without extra calls */
  list: protectedProcedure.query(() => {
    const rows = db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        userId: chatMessages.userId,
        name: user.name,
        image: user.image,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.userId, user.id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(MAX_HISTORY)
      .all()
      .reverse();

    const refNums = referencedMatchNumbers(rows.map((r) => r.body));
    const refMatches = refNums.length
      ? db
          .select()
          .from(matches)
          .where(inArray(matches.matchNumber, refNums))
          .all()
      : [];

    const matchLookup: Record<number, ReturnType<typeof shapeChip>> = {};
    for (const m of refMatches) matchLookup[m.matchNumber] = shapeChip(m);

    return {
      messages: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      matches: matchLookup,
    };
  }),

  send: protectedProcedure
    .input(z.object({ body: z.string().trim().min(1).max(1000) }))
    .mutation(({ ctx, input }) => {
      const now = new Date();
      const res = db
        .insert(chatMessages)
        .values({ userId: ctx.user.id, body: input.body, createdAt: now })
        .run();
      /* sender has implicitly read the room up to their own message */
      db.insert(chatReads)
        .values({ userId: ctx.user.id, lastReadAt: now })
        .onConflictDoUpdate({
          target: chatReads.userId,
          set: { lastReadAt: now },
        })
        .run();
      return { ok: true, id: Number(res.lastInsertRowid) };
    }),

  markRead: protectedProcedure.mutation(({ ctx }) => {
    const now = new Date();
    db.insert(chatReads)
      .values({ userId: ctx.user.id, lastReadAt: now })
      .onConflictDoUpdate({ target: chatReads.userId, set: { lastReadAt: now } })
      .run();
    return { ok: true };
  }),

  /* count of others' messages newer than my last read → FAB badge */
  unread: protectedProcedure.query(({ ctx }) => {
    const read = db
      .select({ lastReadAt: chatReads.lastReadAt })
      .from(chatReads)
      .where(eq(chatReads.userId, ctx.user.id))
      .get();
    const since = read?.lastReadAt ?? new Date(0);
    const row = db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(
        and(
          ne(chatMessages.userId, ctx.user.id),
          gt(chatMessages.createdAt, since),
        ),
      )
      .orderBy(asc(chatMessages.id))
      .all();
    return { count: row.length };
  }),
});

/* compact match shape for an inline chat chip */
function shapeChip(m: typeof matches.$inferSelect) {
  return {
    id: m.id,
    matchNumber: m.matchNumber,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeFlag: m.homeFlag,
    awayFlag: m.awayFlag,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
    finished: m.finished,
    stageLabel: m.stageLabel,
    kickoff: m.kickoffUtc.toISOString(),
  };
}
