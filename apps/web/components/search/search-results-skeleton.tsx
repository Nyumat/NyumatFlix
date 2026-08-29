"use client";

import { cn } from "@/lib/utils";

export function SearchResultsSkeleton({
  count = 6,
  variant = "row",
  className,
}: {
  count?: number;
  variant?: "row" | "card";
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-2", className)}
      aria-hidden
      data-testid="search-results-skeleton"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "flex animate-pulse items-center gap-3 px-2 py-2",
            variant === "card" && "border border-white/5 bg-white/[0.02]",
          )}
        >
          <div
            className={cn(
              "shrink-0 bg-muted/40",
              variant === "row" ? "h-[4.5rem] w-10" : "h-24 w-16",
            )}
          />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/5 rounded bg-muted/40" />
            <div className="h-2.5 w-2/5 rounded bg-muted/30" />
          </div>
        </div>
      ))}
    </div>
  );
}
