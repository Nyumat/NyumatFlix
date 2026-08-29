import type { SearchPreviewResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SearchPosterThumb } from "./search-poster-thumb";
import { useEffect, useId, type ReactNode } from "react";
import { HighlightedText } from "./highlighted-text";

export const SEARCH_AUTOCOMPLETE_MAX_RESULTS = 6;

export type SearchAutocompleteFooter = "none" | "view-all" | "go-to-search";

export type SearchAutocompleteSelection =
  | { type: "result"; value: SearchPreviewResult }
  | { type: "footer" };

export function getSearchAutocompleteOptionId(
  listboxId: string,
  index: number,
): string {
  return `${listboxId}-option-${index}`;
}

export function getSearchAutocompleteItemCount(
  results: SearchPreviewResult[],
  options?: {
    maxResults?: number;
    includeFooter?: boolean;
  },
): number {
  const maxResults = options?.maxResults ?? SEARCH_AUTOCOMPLETE_MAX_RESULTS;
  const includeFooter = options?.includeFooter ?? false;
  const displayedResults = results.slice(0, maxResults);

  if (displayedResults.length === 0) {
    return 0;
  }

  return includeFooter ? displayedResults.length + 1 : displayedResults.length;
}

export function resolveSearchAutocompleteSelection(
  results: SearchPreviewResult[],
  selectedIndex: number,
  options?: {
    maxResults?: number;
    includeFooter?: boolean;
  },
): SearchAutocompleteSelection | null {
  if (selectedIndex < 0) {
    return null;
  }

  const maxResults = options?.maxResults ?? SEARCH_AUTOCOMPLETE_MAX_RESULTS;
  const includeFooter = options?.includeFooter ?? false;
  const displayedResults = results.slice(0, maxResults);

  if (selectedIndex < displayedResults.length) {
    const result = displayedResults[selectedIndex];
    return result ? { type: "result", value: result } : null;
  }

  if (includeFooter && selectedIndex === displayedResults.length) {
    return { type: "footer" };
  }

  return null;
}

export function getSearchResultHref(result: SearchPreviewResult): string {
  if (result.href?.startsWith("/")) {
    return result.href;
  }

  const mediaType = result.media_type === "movie" ? "movies" : "tvshows";
  return `/${mediaType}/${result.id}`;
}

export function getSearchResultTitle(result: SearchPreviewResult): string {
  return result.title || result.name || "Unknown Title";
}

function getFooterLabel(footer: SearchAutocompleteFooter): string {
  switch (footer) {
    case "go-to-search":
      return "Go to search page";
    case "view-all":
      return "Show all results";
    case "none":
      return "";
    default: {
      const _exhaustive: never = footer;
      return _exhaustive;
    }
  }
}

export interface SearchAutocompleteProps {
  query: string;
  results: SearchPreviewResult[];
  isLoading: boolean;
  error?: string | null;
  selectedIndex: number;
  footer?: SearchAutocompleteFooter;
  listboxId?: string;
  placement?: "popover" | "panel";
  className?: string;
  listClassName?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onOptionFocus?: (index: number) => void;
  onOptionKeyDown?: (event: React.KeyboardEvent, index: number) => void;
  onSelectResult: (result: SearchPreviewResult) => void;
  onFooterAction?: () => void;
  onPrefetchResult?: (href: string) => void;
}

export function SearchAutocomplete({
  query,
  results,
  isLoading,
  error = null,
  selectedIndex,
  footer = "none",
  listboxId: listboxIdProp,
  placement = "popover",
  className,
  listClassName,
  onMouseEnter,
  onMouseLeave,
  onOptionFocus,
  onOptionKeyDown,
  onSelectResult,
  onFooterAction,
  onPrefetchResult,
}: SearchAutocompleteProps) {
  const generatedListboxId = useId();
  const listboxId = listboxIdProp ?? generatedListboxId;
  const displayedResults = results.slice(0, SEARCH_AUTOCOMPLETE_MAX_RESULTS);
  const includeFooter = footer !== "none";
  const hasContent = isLoading || displayedResults.length > 0;
  const statusMessage = isLoading
    ? "Loading results"
    : hasContent
      ? `${displayedResults.length} results available. Use arrow keys to navigate.`
      : query.trim().length > 0
        ? "No results found"
        : "Start typing to search";

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }

    document
      .getElementById(getSearchAutocompleteOptionId(listboxId, selectedIndex))
      ?.scrollIntoView({ block: "nearest" });
  }, [listboxId, selectedIndex]);

  const renderOption = (
    index: number,
    content: ReactNode,
    onActivate: () => void,
    optionLabel: string,
  ) => (
    <button
      key={getSearchAutocompleteOptionId(listboxId, index)}
      type="button"
      id={getSearchAutocompleteOptionId(listboxId, index)}
      role="option"
      aria-selected={selectedIndex === index}
      aria-label={optionLabel}
      tabIndex={selectedIndex === index ? 0 : -1}
      onMouseDown={(event) => {
        event.preventDefault();
        onActivate();
      }}
      onFocus={() => onOptionFocus?.(index)}
      onKeyDown={(event) => onOptionKeyDown?.(event, index)}
      className={cn(
        "flex w-full cursor-pointer text-left outline-none transition-colors duration-150",
        "hover:bg-white/[0.04]",
        "focus-visible:bg-white/[0.06]",
        selectedIndex === index && "bg-white/[0.06]",
      )}
    >
      {content}
    </button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-white/20 bg-black/60 shadow-xl backdrop-blur-md",
        placement === "popover"
          ? "absolute top-full left-0 right-0 z-50 mt-2 max-h-80"
          : "relative mt-3 w-full max-h-[min(50vh,400px)]",
        className,
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <div
        id={listboxId}
        role="listbox"
        aria-label="Search results"
        className={cn(
          placement === "panel" ? "max-h-[min(50vh,400px)]" : "max-h-72",
          "overflow-y-auto overscroll-contain",
          listClassName,
        )}
      >
        {error ? (
          <div className="border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
        {isLoading ? (
          <div className="p-3" aria-hidden="true">
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-muted/40 animate-pulse" />
                  <div className="space-y-1 flex-1">
                    <div className="h-3 w-32 rounded bg-muted/40 animate-pulse" />
                    <div className="h-2 w-24 rounded bg-muted/30 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : query.trim().length > 0 && hasContent ? (
          <>
            {displayedResults.length > 0 && (
              <div role="group" aria-label="Matching titles" className="py-1">
                {displayedResults.map((item, index) => {
                  const title = getSearchResultTitle(item);
                  const href = getSearchResultHref(item);
                  const optionIndex = index;
                  const metadata = [
                    "sourceAnilistId" in item &&
                    typeof item.sourceAnilistId === "number"
                      ? "anime"
                      : item.media_type,
                    item.genre_names?.[0],
                    (item.release_date || item.first_air_date)?.split("-")[0],
                  ]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <div
                      key={`${item.id}-${item.media_type}`}
                      onMouseEnter={() => onPrefetchResult?.(href)}
                    >
                      {renderOption(
                        optionIndex,
                        <div className="flex w-full items-center gap-2 p-2">
                          <SearchPosterThumb
                            posterPath={item.poster_path}
                            alt=""
                            className="h-12 w-8"
                            sizes="32px"
                            aria-hidden
                            fallback={
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                ?
                              </div>
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-medium">
                              <HighlightedText text={title} query={query} />
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {item.media_type}
                              {item.genre_names?.[0] &&
                                ` • ${item.genre_names[0]}`}
                              {(item.release_date || item.first_air_date) &&
                                ` • ${(item.release_date || item.first_air_date)?.split("-")[0]}`}
                            </p>
                          </div>
                        </div>,
                        () => onSelectResult(item),
                        `${title}${metadata ? `, ${metadata}` : ""}`,
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {includeFooter &&
              onFooterAction &&
              renderOption(
                displayedResults.length,
                <div className="flex w-full items-center justify-between border-t border-border p-2 text-xs text-muted-foreground">
                  <span>{getFooterLabel(footer)}</span>
                  <span aria-hidden>→</span>
                </div>,
                onFooterAction,
                getFooterLabel(footer),
              )}
          </>
        ) : query.trim().length > 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">No results found</p>
            {includeFooter && onFooterAction ? (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onFooterAction();
                }}
                className="mt-1 text-xs text-primary hover:underline"
              >
                {footer === "go-to-search"
                  ? "Search anyway"
                  : "Show all results"}
              </button>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Press Enter to search
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Start typing to search...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function getSearchComboboxInputProps({
  isOpen,
  listboxId,
  activeOptionId,
  ariaLabel = "Search movies and TV shows",
}: {
  isOpen: boolean;
  listboxId: string;
  activeOptionId?: string;
  ariaLabel?: string;
}) {
  return {
    role: "combobox" as const,
    "aria-label": ariaLabel,
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? listboxId : undefined,
    "aria-activedescendant": activeOptionId,
    "aria-autocomplete": "list" as const,
    "aria-haspopup": "listbox" as const,
  };
}
