"use client";

import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import {
  getDisplayTitle,
  getDisplayYear,
  getHref,
  getPosterPath,
  getRatingDisplay,
  getSearchMediaTypeLabel,
  isAnimeSearchCard,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { Film, Star, Tv } from "lucide-react";
import { SearchAnimeMark } from "./search-anime-mark";
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
  const mediaTypeLabel = getSearchMediaTypeLabel(item);
  const isAnime = isAnimeSearchCard(item);
  const isMovie = item.media_type === "movie" && !isAnime;
  const { schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(item, href);

  const typeIcon = isAnime ? (
    <SearchAnimeMark className="size-3 text-[11px]" />
  ) : isMovie ? (
    <Film className="size-3 shrink-0" aria-hidden />
  ) : (
    <Tv className="size-3 shrink-0" aria-hidden />
  );

  const posterFallbackIcon = isAnime ? (
    <SearchAnimeMark className="text-sm" />
  ) : isMovie ? (
    <Film className="size-4" aria-hidden />
  ) : (
    <Tv className="size-4" aria-hidden />
  );

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
      className={cn("gap-3.5 py-2.5", className)}
      data-testid={`${testIdPrefix}-${item.id}`}
      data-media-type={isAnime ? "anime" : item.media_type}
      data-selected={isSelected ? "true" : undefined}
    >
      <SearchPosterThumb
        posterPath={posterPath}
        alt={title}
        className="h-20 w-14"
        imageSize="w342"
        sizes="56px"
        fallback={
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/70">
            {posterFallbackIcon}
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
            {typeIcon}
            {mediaTypeLabel}
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
