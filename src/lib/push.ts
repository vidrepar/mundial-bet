import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import type { PushPayload } from "./push.types";

let configured: boolean | null = null;

/* lazily wire up VAPID creds; returns false if they aren't set (push disabled) */
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@fifa.vidrepar.com",
    pub,
    priv,
  );
  configured = true;
  return true;
}

function statusOf(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    const sc = err.statusCode;
    if (typeof sc === "number") return sc;
  }
  return 0;
}

async function send(
  subs: (typeof pushSubscriptions.$inferSelect)[],
  payload: PushPayload,
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent++;
      } catch (err) {
        const code = statusOf(err);
        if (code === 404 || code === 410) {
          db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, s.endpoint))
            .run();
        }
      }
    }),
  );
  return sent;
}

/* fan a notification out to every subscription except the actor's */
export async function notifyUsers(excludeUserId: string, payload: PushPayload): Promise<void> {
  const subs = db
    .select()
    .from(pushSubscriptions)
    .all()
    .filter((s) => s.userId !== excludeUserId);
  await send(subs, payload);
}

/* notify a single user across their devices; returns how many were delivered */
export async function notifyUser(userId: string, payload: PushPayload): Promise<number> {
  const subs = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all();
  return send(subs, payload);
}
