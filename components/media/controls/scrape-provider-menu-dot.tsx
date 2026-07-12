"use client";

import { Check, Loader2 } from "lucide-react";

import type { ScrapeMenuDotVariant } from "@/lib/scrape/scrape-provider-menu-status";
import { cn } from "@/lib/utils";

export function ScrapeProviderMenuDot({
  variant,
  className,
}: {
  variant: ScrapeMenuDotVariant;
  className?: string;
}) {
  if (variant === "success") {
    return (
      <Check
        className={cn("h-3.5 w-3.5 shrink-0 text-emerald-500", className)}
        aria-hidden
      />
    );
  }

  if (variant === "probing") {
    return (
      <Loader2
        className={cn(
          "h-3.5 w-3.5 shrink-0 animate-spin text-amber-400",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={cn(
        "block h-2 w-2 shrink-0 rounded-full",
        variant === "failed" && "bg-rose-400/70",
        variant === "untested" && "bg-muted-foreground/35",
        className,
      )}
      aria-hidden
    />
  );
}
