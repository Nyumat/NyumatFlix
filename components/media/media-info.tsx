"use client";

import { CountryBadgeList } from "@/components/ui/country-badge";
import type { Genre } from "@/utils/typings";
import { Clock, Star } from "lucide-react";

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
  country?: import("@/components/ui/country-badge").ProductionCountry[];
  /** Array of genre objects for displaying genre badges */
  genres?: Genre[];
  /** Type of media - used for conditional rendering */
  mediaType?: "movie" | "tv";
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
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/80 to-transparent p-5 text-foreground">
      <h3 className="text-lg font-bold truncate">{title}</h3>
      <span className="text-muted-foreground">{formatDate(releaseDate)}</span>

      <div className="flex items-center gap-4 mb-3 text-base">
        {voteAverage && voteAverage > 0 && (
          <div className="flex items-center gap-1.5">
            <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
            <span>{voteAverage.toFixed(1)}</span>
          </div>
        )}

        {runtime && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-5 h-5" />
            <span>{formatRuntime(runtime)}</span>
          </div>
        )}
      </div>

      {mediaType === "tv" && country && country.length > 0 && (
        <div className="mb-3">
          <CountryBadgeList countries={country} size="sm" maxDisplay={2} />
        </div>
      )}

      {genres && genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {genres.slice(0, 3).map((genre) => (
            <span
              key={genre.id}
              className="px-2.5 py-1.5 bg-white/20 rounded-md text-sm"
            >
              {genre.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
