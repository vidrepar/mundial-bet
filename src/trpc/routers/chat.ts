import { and, asc, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatMessages, chatReactions, chatReads, matches, pushSubscriptions, user } from "@/db/schema";
import { emitChat } from "@/lib/chat-bus";
import { notifyUsers } from "@/lib/push";
import { createTRPCRouter, protectedProcedure } from "../init";

const MAX_HISTORY = 500;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😮", "😢", "🐐", "💀"] as const;

/* only accept push endpoints that belong to a real browser push service —
 * the endpoint is later fetched by web-push, so an open value is an SSRF sink */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com"];
function isAllowedPushEndpoint(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return PUSH_HOSTS.includes(h) || PUSH_HOST_SUFFIXES.some((s) => h.endsWith(s));
  } catch {
    return false;
  }
}

export const chatRouter = createTRPCRouter({
  /* whole room as a flat list (top-level + replies) with reactions and a
   * lookup of referenced matches; the client builds the 2-level tree */
  list: protectedProcedure.query(({ ctx }) => {
    const rows = db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        userId: chatMessages.userId,
        parentId: chatMessages.parentId,
        matchId: chatMessages.matchId,
        name: user.name,
        image: user.image,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.userId, user.id))
      .orderBy(desc(chatMessages.id))
      .limit(MAX_HISTORY)
      .all()
      .reverse();

    /* reactions grouped per message */
    const reactRows = db
      .select({
        messageId: chatReactions.messageId,
        emoji: chatReactions.emoji,
        userId: chatReactions.userId,
      })
      .from(chatReactions)
      .all();
    const me = ctx.user.id;
    const byMsg = new Map<number, Map<string, { count: number; mine: boolean }>>();
    for (const r of reactRows) {
      const m = byMsg.get(r.messageId) ?? new Map();
      const cur = m.get(r.emoji) ?? { count: 0, mine: false };
      cur.count++;
      if (r.userId === me) cur.mine = true;
      m.set(r.emoji, cur);
      byMsg.set(r.messageId, m);
    }

    /* resolve referenced matches */
    const matchIds = [
      ...new Set(rows.map((r) => r.matchId).filter((x): x is number => !!x)),
    ];
    const refMatches = matchIds.length
      ? db.select().from(matches).where(inArray(matches.id, matchIds)).all()
      : [];
    const matchLookup: Record<number, ReturnType<typeof shapeChip>> = {};
    for (const m of refMatches) matchLookup[m.id] = shapeChip(m);

    return {
      messages: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reactions: [...(byMsg.get(r.id)?.entries() ?? [])].map(([emoji, v]) => ({
          emoji,
          count: v.count,
          mine: v.mine,
        })),
      })),
      matches: matchLookup,
    };
  }),

  members: protectedProcedure.query(() =>
    db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .orderBy(asc(user.name))
      .all(),
  ),

  send: protectedProcedure
    .input(
      z.object({
        body: z.string().trim().max(1000),
        parentId: z.number().int().nullish(),
        matchId: z.number().int().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => {
      if (!input.body && !input.matchId) return { ok: false, id: 0 };
      /* replies flatten to max 2 levels and never carry a match reference */
      let parentId: number | null = null;
      let matchId: number | null = input.matchId ?? null;
      if (input.parentId != null) {
        const parent = db
          .select({ id: chatMessages.id, parentId: chatMessages.parentId })
          .from(chatMessages)
          .where(eq(chatMessages.id, input.parentId))
          .get();
        if (parent) {
          parentId = parent.parentId ?? parent.id;
          matchId = null;
        }
      }
      const now = new Date();
      const res = db
        .insert(chatMessages)
        .values({ userId: ctx.user.id, body: input.body, parentId, matchId, createdAt: now })
        .run();
      db.insert(chatReads)
        .values({ userId: ctx.user.id, lastReadAt: now })
        .onConflictDoUpdate({ target: chatReads.userId, set: { lastReadAt: now } })
        .run();

      emitChat({ kind: "refresh" });
      const preview = input.body || "shared a match ⚽";
      void notifyUsers(ctx.user.id, {
        title: "Mundial Group",
        body: `${ctx.user.name}: ${preview}`.slice(0, 140),
        url: "/",
        tag: "mundial-chat",
      }).catch(() => {});
      return { ok: true, id: Number(res.lastInsertRowid) };
    }),

  react: protectedProcedure
    .input(z.object({ messageId: z.number().int(), emoji: z.enum(REACTION_EMOJIS) }))
    .mutation(({ ctx, input }) => {
      const existing = db
        .select({ id: chatReactions.id })
        .from(chatReactions)
        .where(
          and(
            eq(chatReactions.messageId, input.messageId),
            eq(chatReactions.userId, ctx.user.id),
            eq(chatReactions.emoji, input.emoji),
          ),
        )
        .get();
      if (existing) {
        db.delete(chatReactions).where(eq(chatReactions.id, existing.id)).run();
      } else {
        db.insert(chatReactions)
          .values({
            messageId: input.messageId,
            userId: ctx.user.id,
            emoji: input.emoji,
            createdAt: new Date(),
          })
          .run();
      }
      emitChat({ kind: "refresh" });
      return { ok: true };
    }),

  /* ephemeral typing ping → fanned out over SSE, nothing persisted */
  setTyping: protectedProcedure.mutation(({ ctx }) => {
    emitChat({ kind: "typing", userId: ctx.user.id, name: ctx.user.name });
    return { ok: true };
  }),

  markRead: protectedProcedure.mutation(({ ctx }) => {
    const now = new Date();
    db.insert(chatReads)
      .values({ userId: ctx.user.id, lastReadAt: now })
      .onConflictDoUpdate({ target: chatReads.userId, set: { lastReadAt: now } })
      .run();
    emitChat({ kind: "seen" });
    return { ok: true };
  }),

  unread: protectedProcedure.query(({ ctx }) => {
    const read = db
      .select({ lastReadAt: chatReads.lastReadAt })
      .from(chatReads)
      .where(eq(chatReads.userId, ctx.user.id))
      .get();
    const since = read?.lastReadAt ?? new Date(0);
    const rows = db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(and(ne(chatMessages.userId, ctx.user.id), gt(chatMessages.createdAt, since)))
      .all();
    return { count: rows.length };
  }),

  /* who has read the room + up to when → seen receipts */
  seen: protectedProcedure.query(() =>
    db
      .select({
        userId: chatReads.userId,
        name: user.name,
        image: user.image,
        lastReadAt: chatReads.lastReadAt,
      })
      .from(chatReads)
      .innerJoin(user, eq(chatReads.userId, user.id))
      .all()
      .map((r) => ({ ...r, lastReadAt: r.lastReadAt.toISOString() })),
  ),

  pushSubscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url().refine(isAllowedPushEndpoint, "unsupported push endpoint"),
        p256dh: z.string().max(255),
        auth: z.string().max(255),
      }),
    )
    .mutation(({ ctx, input }) => {
      db.insert(pushSubscriptions)
        .values({
          endpoint: input.endpoint,
          userId: ctx.user.id,
          p256dh: input.p256dh,
          auth: input.auth,
          createdAt: new Date(),
        })
        /* on conflict only update MY own row — never hijack another user's */
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { p256dh: input.p256dh, auth: input.auth },
          where: eq(pushSubscriptions.userId, ctx.user.id),
        })
        .run();
      return { ok: true };
    }),

  pushUnsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(({ ctx, input }) => {
      db.delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, input.endpoint),
            eq(pushSubscriptions.userId, ctx.user.id),
          ),
        )
        .run();
      return { ok: true };
    }),
});

/* compact match shape for an inline chat chip / thread header */
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
