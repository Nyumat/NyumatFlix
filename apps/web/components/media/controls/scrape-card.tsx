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
  onSelect?: (id: string) => void;
};

export function ScrapeSourceRow({
  id,
  name,
  status,
  active,
  onSelect,
}: ScrapeSourceRowProps) {
  const showIcon = status !== "waiting" || active;
  const className = cn(
    "flex w-full items-center gap-3 py-1.5 text-left",
    active ? "text-white/90" : "text-white/40",
    (status === "skipped" ||
      status === "unavailable" ||
      status === "failure") &&
      !active &&
      "text-white/25",
    onSelect && "rounded-md px-1 -mx-1 hover:bg-white/8 hover:text-white/80",
  );

  const content = (
    <>
      <div className="w-5 shrink-0">
        {showIcon ? (
          <ScrapeStatusCircle type={statusCircleMap[status]} />
        ) : (
          <span className="block size-2 rounded-full bg-white/15" />
        )}
      </div>
      <p className="text-base">{name}</p>
    </>
  );

  if (!onSelect) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onSelect(id)}
      aria-label={`Use ${name}`}
    >
      {content}
    </button>
  );
}
