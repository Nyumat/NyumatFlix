import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type MediaDetailFactRow = {
  label: string;
  value: ReactNode;
};

type MediaDetailFactsPanelProps = {
  title?: string;
  rows: MediaDetailFactRow[];
  className?: string;
  children?: ReactNode;
};

export const MediaDetailFactsPanel = ({
  title = "Facts",
  rows,
  className,
  children,
}: MediaDetailFactsPanelProps) => {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/15 bg-black/45 shadow-2xl backdrop-blur-xl supports-backdrop-filter:bg-black/35",
        className,
      )}
    >
      <div className="border-b border-white/10 bg-white/3 px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/70">
          {title}
        </h2>
      </div>
      {children ? (
        <div className="border-b border-white/10 px-5 py-5">{children}</div>
      ) : null}
      <div className="divide-y divide-white/10">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-6"
          >
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-400 sm:w-44">
              {row.label}
            </span>
            <div className="min-w-0 flex-1 text-sm leading-relaxed text-white/95">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
