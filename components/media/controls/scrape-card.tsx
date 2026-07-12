"use client";

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
  unavailable: "noresult",
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
  active,
}: ScrapeSourceRowProps) {
  const showIcon = status !== "waiting" || active;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-1.5",
        active ? "text-white/90" : "text-white/40",
        (status === "skipped" ||
          status === "unavailable" ||
          status === "failure") &&
          !active &&
          "text-white/25",
      )}
    >
      <div className="w-5 shrink-0">
        {showIcon ? (
          <ScrapeStatusCircle type={statusCircleMap[status]} />
        ) : (
          <span className="block size-2 rounded-full bg-white/15" />
        )}
      </div>
      <p className="min-w-0 flex-1 truncate text-base">{name}</p>
    </div>
  );
}
