import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { telegramLink, user } from "@/db/schema";
import { tgSend } from "@/lib/telegram";

/* Telegram calls this on every bot update. Register once after deploy:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://YOUR_DOMAIN/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 * Handles `/start <token>` deep links to bind a chat to a user.
 */
export async function POST(req: Request) {
  /* 1. verify it's really Telegram (optional secret) */
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    secret &&
    req.headers.get("x-telegram-bot-api-secret-token") !== secret
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const text: string = msg?.text ?? "";
  const chatId = msg?.chat?.id;

  /* 2. handle the /start <token> link */
  if (chatId && text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      await tgSend(chatId, "👋 Open the link from the app to connect your account.");
      return NextResponse.json({ ok: true });
    }
    const link = db
      .select()
      .from(telegramLink)
      .where(eq(telegramLink.token, token))
      .get();
    if (!link) {
      await tgSend(chatId, "⚠️ That link expired — generate a new one in the app.");
      return NextResponse.json({ ok: true });
    }
    db.update(user)
      .set({
        telegramChatId: String(chatId),
        telegramUsername: msg.from?.username ?? null,
      })
      .where(eq(user.id, link.userId))
      .run();
    db.delete(telegramLink).where(eq(telegramLink.token, token)).run();
    await tgSend(
      chatId,
      "✅ <b>Connected!</b> You'll get personal reminders before matches you haven't bet on.",
    );
  }

  return NextResponse.json({ ok: true });
}
