"use client";

import { useEffect } from "react";

/* registers the service worker once on the client → makes the app installable
 * and gives an offline shell. No-op during SSR / unsupported browsers. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
