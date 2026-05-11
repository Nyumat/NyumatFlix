"use client";

import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import {
  getContentRatingDisplay,
  getCountryCodes,
  getDisplayYear,
  getGenreIds,
  getMediaLabel,
  getRatingDisplay,
  getRuntimeText,
} from "@/lib/cards";
import type { CanonicalMediaCard, MediaItem } from "@/utils/typings";
import { Clock, Star } from "lucide-react";

type CardMetaProps = {
  item: CanonicalMediaCard | MediaItem;
  showType?: boolean;
  showRuntime?: boolean;
  showContentRating?: boolean;
  maxGenres?: number;
  className?: string;
};

export function CardMeta({
  item,
  showType = false,
  showRuntime = true,
  showContentRating = true,
  maxGenres = 2,
  className,
}: CardMetaProps) {
  const rating = getRatingDisplay(item);
  const runtime = getRuntimeText(item);
  const contentRating = getContentRatingDisplay(item);
  const countryCodes = getCountryCodes(item);
  const genreIds = getGenreIds(item);
  const year = getDisplayYear(item);

  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-sm text-muted-foreground/80 font-medium flex-wrap">
        {year && <span>{year}</span>}

        {rating && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-foreground font-semibold">{rating}</span>
            </div>
          </>
        )}

        {showContentRating && contentRating && (
          <>
            <span className="opacity-40">•</span>
            <span className="px-1.5 py-0.5 bg-white/5 rounded-xs text-[10px] uppercase font-bold">
              {contentRating}
            </span>
          </>
        )}

        {showRuntime && runtime && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{runtime}</span>
            </div>
          </>
        )}
      </div>

      {(showType || countryCodes.length > 0 || genreIds.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {showType && (
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold uppercase tracking-widest bg-primary/15 border-primary/20 text-primary px-2 py-0.5 rounded-md"
            >
              {getMediaLabel(item)}
            </Badge>
          )}

          {countryCodes.length > 0 && (
            <CountryBadge
              country={{ iso_3166_1: countryCodes[0], name: countryCodes[0] }}
              variant="outline"
              className="text-[10px] bg-white/5 border-white/10 text-white/60 font-semibold uppercase tracking-wider h-5"
              size="sm"
              showName={false}
              mediaType={item.media_type as "movie" | "tv"}
            />
          )}

          {genreIds.length > 0 && (
            <SmartGenreBadgeGroup
              genreIds={genreIds}
              mediaType={item.media_type as "movie" | "tv"}
              maxVisible={maxGenres}
              className="flex gap-2"
              badgeClassName="text-[10px] bg-white/5 text-white/60 border-white/10 font-semibold uppercase tracking-wider h-5 hover:bg-primary/20 hover:text-primary transition-all"
              variant="outline"
            />
          )}
        </div>
      )}
    </div>
  );
}
