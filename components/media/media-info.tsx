"use client";

import { Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/ui/country-badge";
import { SmartGenreBadgeGroup } from "@/components/ui/genre-badge";
import type { Genre } from "@/utils/typings";

/**
 * Props for the Info component
 */
interface InfoProps {
  /** Title of the media content */
  title?: string;
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
}

/**
 * Info component displays media information including title, rating, runtime, and genres
 * @param props - The component props
 * @returns A component displaying formatted media information
 */
export const Info = ({
  title,
  releaseDate,
  voteAverage,
  runtime,
  country,
  genres,
  mediaType = "movie",
  rating,
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
    <div className="border-t border-primary/20 p-2 sm:p-3 md:p-4 text-foreground">
      <h3 className="text-xs sm:text-sm md:text-base font-semibold mb-1 leading-tight line-clamp-2">
        {title}
      </h3>
      <div className="flex items-center gap-2 mb-2 text-xs md:text-sm flex-wrap">
        <span className="text-muted-foreground">{formatDate(releaseDate)}</span>

        {voteAverage && voteAverage > 0 && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="text-muted-foreground">
              {voteAverage.toFixed(1)}
            </span>
          </div>
        )}

        {runtime && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {formatRuntime(runtime)}
            </span>
          </div>
        )}

        {rating && (
          <Badge
            variant="outline"
            className="text-[10px] py-0 h-4 px-1.5 bg-muted/20 border-border text-muted-foreground font-normal rounded-sm whitespace-nowrap"
          >
            {rating}
          </Badge>
        )}

        <Badge
          href={mediaType === "movie" ? "/movies" : "/tvshows"}
          variant="outline"
          className="text-[10px] py-0 h-4 px-1.5 bg-primary/10 border-primary/30 text-primary font-medium rounded-sm hover:bg-primary/20 hover:border-primary/50 transition-colors cursor-pointer"
        >
          {mediaType === "movie" ? "Movie" : "TV"}
        </Badge>

        {country && country.length > 0 && (
          <CountryBadge
            country={country[0]}
            variant="outline"
            className="text-xs py-0 h-4 px-1.5 bg-muted/20 border-border text-muted-foreground font-normal rounded-sm"
            size="sm"
            showName={false}
            mediaType={mediaType}
          />
        )}
      </div>

      {genres && genres.length > 0 && (
        <SmartGenreBadgeGroup
          genreIds={genres.map((g) => g.id)}
          mediaType={mediaType}
          maxVisible={1}
          className="flex flex-wrap gap-1 items-center"
          badgeClassName="text-[10px] h-auto bg-muted/20 text-muted-foreground px-1 py-0.5 border border-border font-normal hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-colors"
          variant="outline"
        />
      )}
    </div>
  );
};
