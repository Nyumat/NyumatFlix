"use client";

import { motion } from "framer-motion";
import { Check, Loader2, Minus, X } from "lucide-react";

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

const springTransition = {
  type: "spring",
  stiffness: 420,
  damping: 28,
} as const;

export function ScrapeStatusCircle({
  type,
  className,
}: ScrapeStatusCircleProps) {
  return (
    <div className={cn("relative size-6 shrink-0", className)}>
      {type === "loading" ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/25"
          animate={{ scale: [1, 1.55, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      <motion.div
        key={type}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springTransition}
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full border",
          type === "loading" && "border-primary/40 bg-primary/15 text-primary",
          type === "waiting" && "border-white/15 bg-white/[0.03] text-white/25",
          type === "error" && "border-red-500/40 bg-red-500/15 text-red-400",
          type === "success" &&
            "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
          type === "noresult" &&
            "border-white/15 bg-white/[0.04] text-white/30",
        )}
      >
        {type === "loading" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : null}
        {type === "success" ? <Check className="size-3.5" aria-hidden /> : null}
        {type === "error" ? <X className="size-3.5" aria-hidden /> : null}
        {type === "noresult" ? (
          <Minus className="size-3.5" aria-hidden />
        ) : null}
      </motion.div>
    </div>
  );
}
