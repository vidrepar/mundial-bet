import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "animate-gradient bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_auto] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
