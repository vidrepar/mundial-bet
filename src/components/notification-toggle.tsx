"use client";

import { useMutation } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { subscribeBrowserPush } from "@/lib/push-client";
import { useTRPC } from "@/trpc/client";

/* Bell toggle in the chat header: requests notification permission and
 * registers a Web Push subscription. Works in installed iOS Safari PWAs. */
export function NotificationToggle() {
  const trpc = useTRPC();
  const subscribe = useMutation(trpc.chat.pushSubscribe.mutationOptions());
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setOn(Notification.permission === "granted");
    }
  }, []);

  async function enable() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Notifications aren't supported here.");
      return;
    }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      toast.error("Push isn't configured.");
      return;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Notifications were blocked. On iPhone, add the app to your Home Screen first.");
        return;
      }
      const sub = await subscribeBrowserPush(key);
      if (!sub.endpoint) throw new Error("no subscription");
      await subscribe.mutateAsync(sub);
      setOn(true);
      toast.success("Notifications on 🔔");
    } catch {
      toast.error("Couldn't enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      title={on ? "Notifications on" : "Enable notifications"}
      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {on ? (
        <BellRing className="size-4 text-primary" />
      ) : (
        <Bell className="size-4" />
      )}
    </button>
  );
}
