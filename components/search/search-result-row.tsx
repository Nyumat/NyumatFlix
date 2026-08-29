"use client";

import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import {
  getDisplayTitle,
  getDisplayYear,
  getHref,
  getPosterPath,
  getRatingDisplay,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { Film, Star, Tv } from "lucide-react";
import { HighlightedText } from "./highlighted-text";
import { SearchListRow } from "./search-list-row";
import { SearchPosterThumb } from "./search-poster-thumb";

type SearchResultRowProps = {
  item: CanonicalMediaCard;
  query?: string;
  testIdPrefix?: string;
  className?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onPrefetch?: () => void;
  optionIndex?: number;
};

export function SearchResultRow({
  item,
  query,
  testIdPrefix = "search-result-row",
  className,
  isSelected = false,
  onSelect,
  onPrefetch,
  optionIndex,
}: SearchResultRowProps) {
  const title = getDisplayTitle(item);
  const href = getHref(item);
  const posterPath = getPosterPath(item) ?? undefined;
  const year = getDisplayYear(item);
  const rating = getRatingDisplay(item);
  const isMovie = item.media_type === "movie";
  const { schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(item, href);

  return (
    <SearchListRow
      role="option"
      aria-selected={isSelected}
      id={
        optionIndex !== undefined
          ? `search-result-option-${optionIndex}`
          : undefined
      }
      onClick={onSelect}
      onPointerEnter={() => {
        schedulePrefetch();
        onPrefetch?.();
      }}
      onPointerLeave={cancelPrefetch}
      onFocus={onPrefetch}
      isSelected={isSelected}
      className={className}
      data-testid={`${testIdPrefix}-${item.id}`}
      data-media-type={item.media_type}
      data-selected={isSelected ? "true" : undefined}
    >
      <SearchPosterThumb
        posterPath={posterPath}
        alt={title}
        className="h-14 w-10"
        sizes="40px"
        fallback={
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">
            {isMovie ? (
              <Film className="size-3.5" aria-hidden />
            ) : (
              <Tv className="size-3.5" aria-hidden />
            )}
          </div>
        }
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium transition-colors",
            isSelected ? "text-foreground" : "text-foreground/95",
          )}
        >
          {query ? <HighlightedText text={title} query={query} /> : title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {isMovie ? (
              <Film className="size-3 shrink-0" aria-hidden />
            ) : (
              <Tv className="size-3 shrink-0" aria-hidden />
            )}
            {isMovie ? "Movie" : "TV"}
          </span>
          {year ? <span>{year}</span> : null}
          {rating ? (
            <span className="inline-flex items-center gap-0.5 text-yellow-400/90">
              <Star className="size-3 shrink-0 fill-current" aria-hidden />
              {rating}
            </span>
          ) : null}
        </div>
      </div>
    </SearchListRow>
  );
}
