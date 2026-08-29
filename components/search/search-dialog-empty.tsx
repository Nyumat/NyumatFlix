"use client";

import { useSearchPrompts } from "@/hooks/use-search-prompts";
import { cn } from "@/lib/utils";
import { Clock3, Search, TrendingUp } from "lucide-react";

type SearchDialogEmptyProps = {
  recentSearches: string[];
  onSelectQuery: (query: string) => void;
  onClearRecents?: () => void;
  className?: string;
};

const SearchPromptsSkeleton = () => (
  <div className="flex flex-wrap gap-1.5" aria-hidden>
    {[...Array(6)].map((_, index) => (
      <div
        key={index}
        className="h-7 w-20 animate-pulse rounded-md border border-white/8 bg-white/[0.04]"
      />
    ))}
  </div>
);

export function SearchDialogEmpty({
  recentSearches,
  onSelectQuery,
  onClearRecents,
  className,
}: SearchDialogEmptyProps) {
  const { prompts, isLoading, isError } = useSearchPrompts();
  const showSuggestedSection = isLoading || (!isError && prompts.length > 0);

  return (
    <div
      className={cn("space-y-5 px-0.5", className)}
      data-testid="search-dialog-empty"
    >
      {recentSearches.length > 0 ? (
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
      ) : null}

      {showSuggestedSection ? (
        <section aria-label="Suggested searches">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-3.5" aria-hidden />
            Try searching
          </p>

          {isLoading ? (
            <SearchPromptsSkeleton />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => onSelectQuery(prompt.query)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:border-white/15 hover:bg-white/[0.08]"
                >
                  <Search
                    className="size-3 text-muted-foreground"
                    aria-hidden
                  />
                  {prompt.label}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
