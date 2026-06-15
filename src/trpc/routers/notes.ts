import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "../init";

/* private per-user notes — every query is scoped to the caller, never shared */
export const notesRouter = createTRPCRouter({
  list: protectedProcedure.query(({ ctx }) =>
    db
      .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt })
      .from(notes)
      .where(eq(notes.userId, ctx.user.id))
      .orderBy(desc(notes.id))
      .all()
      .map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
  ),

  add: protectedProcedure
    .input(z.object({ body: z.string().trim().min(1).max(2000) }))
    .mutation(({ ctx, input }) => {
      const res = db
        .insert(notes)
        .values({ userId: ctx.user.id, body: input.body, createdAt: new Date() })
        .run();
      return { ok: true, id: Number(res.lastInsertRowid) };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ ctx, input }) => {
      db.delete(notes)
        .where(and(eq(notes.id, input.id), eq(notes.userId, ctx.user.id)))
        .run();
      return { ok: true };
    }),
});
