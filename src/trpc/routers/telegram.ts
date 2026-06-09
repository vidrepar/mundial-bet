import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramLink, user } from "@/db/schema";
import { TrpcError } from "@/lib/errors";
import { createTRPCRouter, protectedProcedure } from "../init";

export const telegramRouter = createTRPCRouter({
  status: protectedProcedure.query(({ ctx }) => {
    const u = db.select().from(user).where(eq(user.id, ctx.user.id)).get();
    return {
      linked: !!u?.telegramChatId,
      username: u?.telegramUsername ?? null,
      configured: !!process.env.TELEGRAM_BOT_USERNAME,
    };
  }),

  /* mint a one-time deep link: open it in Telegram → bot /start binds the chat */
  linkUrl: protectedProcedure.mutation(({ ctx }) => {
    const bot = process.env.TELEGRAM_BOT_USERNAME;
    if (!bot) throw TrpcError.badRequest("Telegram bot isn't configured yet.");
    const token = crypto.randomUUID().replace(/-/g, "");
    db.insert(telegramLink)
      .values({ token, userId: ctx.user.id, createdAt: new Date() })
      .run();
    return { url: `https://t.me/${bot}?start=${token}` };
  }),

  unlink: protectedProcedure.mutation(({ ctx }) => {
    db.update(user)
      .set({ telegramChatId: null, telegramUsername: null })
      .where(eq(user.id, ctx.user.id))
      .run();
    return { ok: true };
  }),
});
