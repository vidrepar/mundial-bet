import { type RefObject, useEffect } from "react";

/* keep a full-screen mobile panel pinned to the *visual* viewport so the
 * on-screen keyboard resizes it (composer stays visible) instead of shoving
 * the fixed layout off-screen. No-op on desktop / unsupported browsers. */
export function useKeyboardPanel(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    const el = ref.current;
    if (!vv || !el) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => {
      if (mq.matches) {
        el.style.height = `${vv.height}px`;
        el.style.top = `${vv.offsetTop}px`;
        el.style.bottom = "auto";
      } else {
        el.style.height = "";
        el.style.top = "";
        el.style.bottom = "";
      }
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    mq.addEventListener("change", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      mq.removeEventListener("change", apply);
      el.style.height = "";
      el.style.top = "";
      el.style.bottom = "";
    };
  }, [ref]);
}
