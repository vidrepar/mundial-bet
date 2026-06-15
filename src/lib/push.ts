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

/* fan a notification out to every subscription except the actor's; prune any
 * subscriptions the push service reports as gone (404/410). */
export async function notifyUsers(
  excludeUserId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = db
    .select()
    .from(pushSubscriptions)
    .all()
    .filter((s) => s.userId !== excludeUserId);
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
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
}
