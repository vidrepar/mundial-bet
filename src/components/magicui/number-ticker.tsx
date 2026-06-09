"use client";

import { useInView, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function NumberTicker({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 120 });
  const inView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [motionValue, inView, value]);

  useEffect(() => {
    return spring.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(Number(latest.toFixed(decimals)));
      }
    });
  }, [spring, decimals]);

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      0
    </span>
  );
}
