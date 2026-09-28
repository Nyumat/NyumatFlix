"use client";

import { contentRowTabIndicatorClassName } from "@/lib/content-row-select-trigger";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/domain/typings";
export type CatalogMediaKind = "movie" | "tv";

export type CatalogShowcaseRow = {
  rowId: string;
  title: string;
  href: string;
  items: MediaItem[];
};

export function MoviesSeriesTabs({
  value,
  onChange,
}: {
  value: CatalogMediaKind;
  onChange: (value: CatalogMediaKind) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Movies or series"
      className="flex shrink-0 items-end gap-7 md:gap-8"
    >
      {(
        [
          { kind: "movie", label: "Movies" },
          { kind: "tv", label: "Series" },
        ] as const
      ).map(({ kind, label }) => {
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(kind)}
            className={cn(
              "relative px-0 pb-2.5 text-base font-semibold tracking-tight text-foreground after:absolute after:-inset-x-3 after:-inset-y-1 after:content-[''] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-lg",
            )}
          >
            <span className="relative inline-block">
              {label}
              {selected ? (
                <span
                  className={cn(
                    "absolute -bottom-2.5 left-0 right-0 h-0.75 rounded-full",
                    contentRowTabIndicatorClassName,
                  )}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
