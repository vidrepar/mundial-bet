import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, user } from "@/db/schema";

/* enqueue a broadcast email (to every player). Idempotent on `kind` — calling
 * twice with the same kind is a no-op, so cron re-runs never double-send. */
export function enqueueEmail(kind: string, subject: string, html: string): void {
  const recipients = db
    .select({ email: user.email })
    .from(user)
    .all()
    .map((r) => r.email)
    .join(",");
  if (!recipients) return;
  db.insert(emailOutbox)
    .values({ kind, recipients, subject, html, createdAt: new Date() })
    .onConflictDoNothing({ target: emailOutbox.kind })
    .run();
}

/* push all unsent rows to the Apps Script Web App relay, which sends them via
 * Gmail and returns the ids it sent. Mark those sent. Unsent rows retry next
 * tick. No-op (rows just wait) if the relay URL isn't configured yet. */
export async function flushOutbox(): Promise<number> {
  const url = process.env.APPSCRIPT_WEBAPP_URL;
  const pending = db
    .select()
    .from(emailOutbox)
    .where(isNull(emailOutbox.sentAt))
    .all();
  if (!pending.length || !url) return 0;

  const payload = {
    secret: process.env.CRON_SECRET,
    emails: pending.map((e) => ({
      id: e.id,
      to: e.recipients.split(",").filter(Boolean),
      subject: e.subject,
      html: e.html,
    })),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return 0;
    const data: { sent?: number[] } = await res.json();
    const ids = data.sent ?? [];
    const at = new Date();
    for (const id of ids) {
      db.update(emailOutbox).set({ sentAt: at }).where(eq(emailOutbox.id, id)).run();
    }
    return ids.length;
  } catch {
    return 0;
  }
}
