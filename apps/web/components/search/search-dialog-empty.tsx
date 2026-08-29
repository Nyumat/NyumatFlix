"use client";

import { cn } from "@/lib/utils";
import { Clock3 } from "lucide-react";

type SearchDialogEmptyProps = {
  recentSearches: string[];
  onSelectQuery: (query: string) => void;
  onClearRecents?: () => void;
  className?: string;
};

export function SearchDialogEmpty({
  recentSearches,
  onSelectQuery,
  onClearRecents,
  className,
}: SearchDialogEmptyProps) {
  if (recentSearches.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("space-y-5 px-0.5", className)}
      data-testid="search-dialog-empty"
    >
      <section aria-label="Recent searches">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          {onClearRecents ? (
            <button
              type="button"
              onClick={onClearRecents}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="space-y-1">
          {recentSearches.map((recentSearch) => (
            <button
              key={recentSearch}
              type="button"
              onClick={() => onSelectQuery(recentSearch)}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-white/[0.06]"
            >
              <Clock3
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">{recentSearch}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
