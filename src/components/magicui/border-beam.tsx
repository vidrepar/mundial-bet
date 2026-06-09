import { cn } from "@/lib/utils";

/* crisp animated border ring — see `.border-beam` in globals.css.
 * `size` kept for API compatibility (unused by the conic approach). */
export function BorderBeam({
  className,
  duration = 6,
  delay = 0,
  size,
}: {
  className?: string;
  duration?: number;
  delay?: number;
  size?: number;
}) {
  void size;
  return (
    <span
      aria-hidden
      className={cn("border-beam", className)}
      style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
    />
  );
}
