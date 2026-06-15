"use client";

import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function isInstalled(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator;
  return "standalone" in nav && Boolean(nav.standalone);
}

/* persistent "Install app" button — visible until the PWA is installed, then
 * it disappears. Uses the native prompt where available; falls back to an
 * Add-to-Home-Screen hint on iOS Safari (which has no programmatic install). */
export function InstallButton() {
  const [mounted, setMounted] = useState(false);
  const [installed, setInstalled] = useState(false);
  const deferred = useRef<Event | null>(null);

  useEffect(() => {
    setMounted(true);
    setInstalled(isInstalled());

    const onBIP = (e: Event) => {
      e.preventDefault();
      deferred.current = e;
    };
    const onInstalled = () => {
      setInstalled(true);
      deferred.current = null;
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = () => setInstalled(isInstalled());

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener("change", onMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onMode);
    };
  }, []);

  if (!mounted || installed) return null;

  function install() {
    const ev = deferred.current;
    if (ev && "prompt" in ev && typeof ev.prompt === "function") {
      ev.prompt();
      deferred.current = null;
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(
      isIOS
        ? "Tap the Share icon, then “Add to Home Screen” to install."
        : "Open your browser menu and choose “Install app”.",
      { duration: 6000 },
    );
  }

  return (
    <Button size="sm" variant="secondary" onClick={install} className="gap-1.5" title="Install app">
      <Download className="size-4" />
      <span className="hidden sm:inline">Install</span>
    </Button>
  );
}
