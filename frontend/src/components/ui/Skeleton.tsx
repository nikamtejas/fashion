import { cn } from "@/lib/utils";

/** A light sweep crossing the block reads as noticeably more considered
 * than uniform opacity-pulsing for the same wait — cheap to render (one
 * extra absolutely-positioned div, CSS-only animation) but the highest-
 * visibility loading state in the app, since it's used everywhere. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-foreground/10", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
    </div>
  );
}
