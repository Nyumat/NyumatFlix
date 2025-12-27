"use client";

import { MediaLogo } from "@/components/media/media-logo";
import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import { cn } from "@/lib/utils";
import type { Genre } from "@/utils/typings";
import { Clock, Star } from "lucide-react";

/**
 * Props for the Info component
 */
interface InfoProps {
  /** Title of the media content */
  title?: string;
  /** Logo object for displaying media logo */
  logo?: {
    file_path: string;
    width: number;
    height: number;
  };
  /** Release date for movies or first air date for TV shows */
  releaseDate?: string;
  /** Average vote rating (0-10) */
  voteAverage?: number;
  /** Runtime in minutes (for movies) */
  runtime?: number;
  /** Production countries (for TV shows) */
  country?: Array<{ iso_3166_1: string; name: string }>;
  /** Array of genre objects for displaying genre badges */
  genres?: Genre[];
  /** Type of media - used for conditional rendering */
  mediaType?: "movie" | "tv";
  /** Optional content rating (e.g., PG-13, R, etc.) */
  rating?: string;
  /**
   * Alignment of the content
   * @default "left"
   */
  align?: "left" | "center" | "right";
}

/**
 * Info component displays media information including title, rating, runtime, and genres
 * @param props - The component props
 * @returns A component displaying formatted media information
 */
export const Info = ({
  title,
  logo,
  releaseDate,
  voteAverage,
  runtime,
  country,
  genres,
  mediaType = "movie",
  rating,
  align = "left",
}: InfoProps) => {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "TBA";
    try {
      return new Date(dateString).getFullYear().toString();
    } catch {
      return "TBA";
    }
  };

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${remainingMinutes}m`;
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 py-1 text-foreground",
        align === "left" && "items-start text-left",
        align === "center" && "items-center text-center",
        align === "right" && "items-end text-right",
      )}
    >
      <MediaLogo
        logo={logo}
        title={title}
        align={align}
        className="mb-1 max-w-[200px]"
        fallbackClassName="mb-1 text-sm sm:text-base md:text-lg font-semibold leading-tight line-clamp-2 text-balance"
      />

      <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground/80 font-medium flex-wrap justify-center">
        <span>{formatDate(releaseDate)}</span>

        {voteAverage && voteAverage > 0 && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span className="text-foreground/90 font-medium">
                {voteAverage.toFixed(1)}
              </span>
            </div>
          </>
        )}

        {runtime && (
          <>
            <span className="opacity-40">•</span>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{formatRuntime(runtime)}</span>
            </div>
          </>
        )}

        <span className="opacity-40">•</span>
        <Badge
          href={mediaType === "movie" ? "/movies" : "/tvshows"}
          variant="secondary"
          className="text-[9px] py-0 h-4 px-1.5 bg-primary/10 border-primary/20 text-primary font-semibold uppercase tracking-wider rounded-sm hover:bg-primary/20 transition-colors cursor-pointer"
        >
          {mediaType === "movie" ? "Movie" : "TV"}
        </Badge>
      </div>

      <div
        className={cn(
          "flex items-center gap-1.5 flex-wrap mt-1",
          align === "center" && "justify-center",
        )}
      >
        {rating && (
          <Badge
            variant="outline"
            className="text-[9px] py-0 h-4 px-1.5 bg-white/5 border-white/20 text-white/70 font-medium rounded-sm whitespace-nowrap"
          >
            {rating}
          </Badge>
        )}

        {country && country.length > 0 && (
          <CountryBadge
            country={country[0]}
            variant="outline"
            className="text-[9px] py-0 h-4 px-1.5 bg-white/5 border-white/20 text-white/70 font-normal rounded-sm"
            size="sm"
            showName={false}
            mediaType={mediaType}
          />
        )}

        {genres && genres.length > 0 && (
          <SmartGenreBadgeGroup
            genreIds={genres.map((g) => g.id)}
            mediaType={mediaType}
            maxVisible={1}
            className="flex flex-wrap gap-1 items-center"
            badgeClassName="text-[9px] h-4 leading-none bg-white/5 text-white/70 px-1.5 py-0 border border-white/10 font-normal hover:bg-primary/20 hover:text-primary hover:border-primary/30 transition-colors rounded-sm"
            variant="outline"
          />
        )}
      </div>
    </div>
  );
};
