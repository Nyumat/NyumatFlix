"use client";

import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/media/controls/country-badge";
import { SmartGenreBadgeGroup } from "@/components/media/controls/genre-badge";
import {
  getContentRatingDisplay,
  getCountryCodes,
  getDisplayYear,
  getGenreIds,
  getMediaLabel,
  getRatingDisplay,
  getRuntimeText,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { Clock, Star } from "lucide-react";

type CardMetaProps = {
  item: CanonicalMediaCard | MediaItem;
  showType?: boolean;
  showRuntime?: boolean;
  showContentRating?: boolean;
  maxGenres?: number;
  className?: string;
  variant?: "default" | "compact";
};

export function CardMeta({
  item,
  showType = false,
  showRuntime = true,
  showContentRating = true,
  maxGenres = 2,
  className,
  variant = "default",
}: CardMetaProps) {
  const isCompact = variant === "compact";
  const isAnimeItem =
    "sourceAnilistId" in item && typeof item.sourceAnilistId === "number";
  const rating = getRatingDisplay(item);
  const runtime = getRuntimeText(item);
  const contentRating = getContentRatingDisplay(item);
  const countryCodes = getCountryCodes(item);
  const genreIds = isAnimeItem ? [] : getGenreIds(item);
  const year = getDisplayYear(item);

  return (
    <div className={className}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-muted-foreground/80",
          isCompact ? "text-xs" : "text-sm",
        )}
      >
        {rating ? (
          <div className="inline-flex items-center gap-1 rounded-md border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-yellow-400">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-100">
              {rating}
            </span>
          </div>
        ) : null}

        {year ? (
          <span className={cn(isCompact ? "text-muted-foreground" : "")}>
            {year}
          </span>
        ) : null}

        {showContentRating && contentRating ? (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-white/5">
            {contentRating}
          </span>
        ) : null}

        {showRuntime && runtime ? (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            <span>{runtime}</span>
          </div>
        ) : null}
      </div>

      {(showType || countryCodes.length > 0 || genreIds.length > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            isCompact ? "mt-2" : "mt-3",
          )}
        >
          {showType ? (
            <Badge
              variant="secondary"
              className={cn(
                "rounded-md border-primary/25 bg-primary/12 font-semibold uppercase tracking-wide text-primary",
                isCompact
                  ? "h-5 px-1.5 text-[10px]"
                  : "px-2 py-0.5 text-[10px] tracking-widest",
              )}
            >
              {getMediaLabel(item)}
            </Badge>
          ) : null}

          {countryCodes.length > 0 ? (
            <CountryBadge
              country={{ iso_3166_1: countryCodes[0], name: countryCodes[0] }}
              variant="outline"
              className={cn(
                "h-5 border-white/10 bg-transparent font-medium uppercase text-muted-foreground",
                isCompact ? "text-[10px]" : "text-[10px] tracking-wider",
              )}
              size="sm"
              showName={false}
              mediaType={item.media_type as "movie" | "tv"}
            />
          ) : null}

          {genreIds.length > 0 ? (
            <SmartGenreBadgeGroup
              genreIds={genreIds}
              mediaType={item.media_type as "movie" | "tv"}
              maxVisible={isCompact ? genreIds.length : maxGenres}
              className="flex flex-wrap gap-1"
              badgeClassName={cn(
                "h-5 rounded-md border-white/8 bg-white/[0.03] font-normal normal-case tracking-normal text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                isCompact
                  ? "px-1.5 text-[10px]"
                  : "text-[10px] font-semibold uppercase tracking-wider",
              )}
              variant="outline"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
