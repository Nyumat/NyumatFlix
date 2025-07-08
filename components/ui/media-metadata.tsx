"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getCountryFlagEmoji,
  getPrimaryCountry,
} from "@/utils/country-helpers";
import {
  getAirDate,
  getTitle,
  MediaItem,
  ProductionCountry,
} from "@/utils/typings";
import { Star } from "lucide-react";

interface MediaMetadataProps {
  /** The media item containing all the metadata */
  item: MediaItem;
  /** The type of media item */
  type: "movie" | "tv";
  /** Content rating (certification for movies, content rating for TV) */
  rating?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Variant for different layouts */
  variant?: "default" | "compact" | "minimal";
  /** Whether to show country flag */
  showCountry?: boolean;
  /** Whether to show year */
  showYear?: boolean;
  /** Whether to show rating/vote average */
  showVoteAverage?: boolean;
  /** Whether to show content rating */
  showContentRating?: boolean;
  /** Whether to truncate title */
  truncateTitle?: boolean;
  /** Maximum title length before truncation */
  maxTitleLength?: number;
  /** Whether this item is coming soon (no rating or future release) */
  isComingSoon?: boolean;
}

/**
 * Unified metadata component for all media cards
 * Features glassmorphic background and responsive design
 */
export function MediaMetadata({
  item,
  type,
  rating,
  className,
  variant = "default",
  showCountry = true,
  showYear = true,
  showVoteAverage = true,
  showContentRating = true,
  truncateTitle = true,
  maxTitleLength = 40,
  isComingSoon = false,
}: MediaMetadataProps) {
  // Extract data from item using helper functions
  const title = getTitle(item);
  const airDate = getAirDate(item);
  const year = airDate?.substring(0, 4);

  const voteAverage = item.vote_average;
  const contentRating = rating || item.content_rating;

  // Get country info safely
  const countryCode = getPrimaryCountry(
    "origin_country" in item && Array.isArray(item.origin_country)
      ? item.origin_country
      : "production_countries" in item &&
          Array.isArray(item.production_countries)
        ? item.production_countries
            .map((pc: ProductionCountry) => pc.iso_3166_1)
            .filter(Boolean)
        : undefined,
  );
  const countryFlag = countryCode ? getCountryFlagEmoji(countryCode) : null;

  // Title handling
  const displayTitle =
    truncateTitle && title && title.length > maxTitleLength
      ? `${title.substring(0, maxTitleLength)}...`
      : title;

  // Variant-specific styling
  const variantStyles = {
    default: {
      container: "p-3",
      title: "text-sm font-semibold mb-2",
      metadata: "text-xs",
      badge: "text-[10px] h-4 px-1.5",
    },
    compact: {
      container: "p-2",
      title: "text-xs font-medium mb-1.5",
      metadata: "text-[10px]",
      badge: "text-[9px] h-3 px-1",
    },
    minimal: {
      container: "p-1.5",
      title: "text-xs font-medium mb-1",
      metadata: "text-[9px]",
      badge: "text-[8px] h-3 px-1",
    },
  };

  const styles = variantStyles[variant];

  return (
    <>
      {/* Coming Soon Banner */}
      {isComingSoon && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold py-1 px-3 rounded-bl-lg shadow-lg transform rotate-0 origin-top-right">
            Coming Soon
          </div>
        </div>
      )}

      <div
        className={cn(
          // Base glassmorphic styling
          "absolute bottom-0 left-0 right-0",
          "bg-black/60 backdrop-blur-md",
          "border-t border-white/20",
          "text-white",
          "transition-all duration-300",
          styles.container,
          className,
        )}
      >
        {/* Title */}
        {title && (
          <h3 className={cn("leading-tight line-clamp-2", styles.title)}>
            {displayTitle}
          </h3>
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between gap-1">
          {/* Left side - Country, Year, Rating */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Country Flag */}
            {showCountry && countryFlag && (
              <span
                className="text-sm flex-shrink-0"
                title={`Country: ${countryCode}`}
              >
                {countryFlag}
              </span>
            )}

            {/* Year */}
            {showYear && year && (
              <Badge
                variant="outline"
                className={cn(
                  "bg-white/10 border-white/20 text-white font-normal",
                  styles.badge,
                )}
              >
                {year}
              </Badge>
            )}

            {/* Media Type */}
            {type && (
              <Badge
                variant="outline"
                className={cn(
                  "bg-white/10 border-white/20 text-white font-normal",
                  styles.badge,
                )}
              >
                {type === "movie" ? "Movie" : "TV"}
              </Badge>
            )}

            {/* Content Rating */}
            {showContentRating && contentRating && (
              <Badge
                variant="outline"
                className={cn(
                  "bg-white/15 border-white/30 text-white font-medium",
                  styles.badge,
                )}
              >
                {contentRating}
              </Badge>
            )}
          </div>

          {/* Right side - Vote Average */}
          {showVoteAverage && voteAverage && voteAverage > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star
                className={cn(
                  "fill-yellow-400 text-yellow-400",
                  variant === "minimal" ? "w-2.5 h-2.5" : "w-3 h-3",
                )}
              />
              <span className={cn("font-medium text-white", styles.metadata)}>
                {voteAverage.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Simplified metadata for mobile/small cards
 */
export function CompactMediaMetadata({
  item,
  type,
  rating,
  className,
  isComingSoon,
}: {
  item: MediaItem;
  type: "movie" | "tv";
  rating?: string | null;
  className?: string;
  isComingSoon?: boolean;
}) {
  return (
    <MediaMetadata
      item={item}
      type={type}
      rating={rating}
      variant="compact"
      maxTitleLength={25}
      className={className}
      isComingSoon={isComingSoon}
    />
  );
}

/**
 * Minimal metadata for very small cards
 */
export function MinimalMediaMetadata({
  item,
  type,
  rating,
  className,
  isComingSoon,
}: {
  item: MediaItem;
  type: "movie" | "tv";
  rating?: string | null;
  className?: string;
  isComingSoon?: boolean;
}) {
  return (
    <MediaMetadata
      item={item}
      type={type}
      rating={rating}
      variant="minimal"
      maxTitleLength={20}
      showCountry={false}
      showYear={false}
      className={className}
      isComingSoon={isComingSoon}
    />
  );
}
