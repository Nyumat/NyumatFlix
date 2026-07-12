"use client";

import { Check, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ScrapeStatusCircleType =
  | "loading"
  | "success"
  | "error"
  | "noresult"
  | "waiting";

type ScrapeStatusCircleProps = {
  type: ScrapeStatusCircleType;
  className?: string;
};

export function ScrapeStatusCircle({
  type,
  className,
}: ScrapeStatusCircleProps) {
  return (
    <div
      className={cn(
        "flex size-4 shrink-0 items-center justify-center text-white/35",
        type === "loading" && "text-white/70",
        type === "success" && "text-white/80",
        type === "error" && "text-white/45",
        type === "noresult" && "text-white/20",
        className,
      )}
    >
      {type === "loading" ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
      ) : null}
      {type === "success" ? <Check className="size-3.5" aria-hidden /> : null}
      {type === "error" || type === "noresult" ? (
        <X className="size-3.5" aria-hidden />
      ) : null}
    </div>
  );
}
