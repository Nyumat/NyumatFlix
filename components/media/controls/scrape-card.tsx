"use client";

import { AnimatePresence, motion } from "framer-motion";

import {
  ScrapeStatusCircle,
  type ScrapeStatusCircleType,
} from "@/components/media/controls/scrape-status-circle";
import type { ScrapeItemStatus } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

const statusCircleMap: Record<ScrapeItemStatus, ScrapeStatusCircleType> = {
  waiting: "waiting",
  pending: "loading",
  success: "success",
  failure: "error",
  skipped: "noresult",
};

const statusLabelMap: Partial<Record<ScrapeItemStatus, string>> = {
  pending: "Searching…",
  success: "Stream found",
  skipped: "Skipped",
};

export type ScrapeSourceRowProps = {
  id: string;
  name: string;
  status: ScrapeItemStatus;
  error?: string;
  active: boolean;
};

export function ScrapeSourceRow({
  name,
  status,
  error,
  active,
}: ScrapeSourceRowProps) {
  const detail = error ?? statusLabelMap[status];

  return (
    <motion.div
      layout
      className={cn(
        "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-200",
        active && "bg-primary/10 ring-1 ring-inset ring-primary/25",
      )}
    >
      <ScrapeStatusCircle type={statusCircleMap[status]} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium transition-colors duration-200",
            active ? "text-white" : "text-white/50",
            status === "skipped" && "text-white/30",
          )}
        >
          {name}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {detail ? (
            <motion.p
              key={detail}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "truncate text-[11px]",
                status === "failure" ? "text-red-400/70" : "text-white/35",
              )}
            >
              {detail}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
