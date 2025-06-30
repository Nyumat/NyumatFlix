"use client";

import { CountryBadge } from "@/components/ui/country-badge";
import type { Genre } from "@/utils/typings";
import { Clock, Star } from "lucide-react";

interface InfoProps {
  title?: string;
  releaseDate?: string; // Or firstAirDate for TV
  voteAverage?: number;
  runtime?: number; // For movies
  country?: import("@/components/ui/country-badge").ProductionCountry[]; // For TV
  genres?: Genre[]; // For displaying genre badges
  mediaType?: "movie" | "tv";
}

export const Info = ({
  title,
  releaseDate,
  voteAverage,
  runtime,
  country,
  genres,
}: InfoProps) => (
  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent text-white hidden sm:block backdrop-blur-sm">
    <h3 className="font-medium text-sm mb-2 line-clamp-1 text-white/90">
      {title}
    </h3>

    <div className="flex flex-wrap items-center gap-2">
      {voteAverage !== undefined && voteAverage > 0 && (
        <span className="inline-flex items-center gap-1 text-yellow-400 h-5 px-2 py-0.5 text-xs font-medium border border-white/20 bg-white/5 rounded">
          <Star size={12} className="fill-current" />
          {voteAverage.toFixed(1)}
        </span>
      )}
      {releaseDate && (
        <span className="inline-flex items-center h-5 px-2 py-0.5 text-xs border border-white/20 bg-white/5 text-white/80 rounded">
          {releaseDate.split("-")[0]}
        </span>
      )}
      {runtime !== undefined && (
        <span className="inline-flex items-center gap-1 h-5 px-2 py-0.5 text-xs border border-white/20 bg-white/5 text-white/80 rounded">
          <Clock size={10} />
          {runtime}m
        </span>
      )}
      {genres &&
        genres.length > 0 &&
        genres.slice(0, 2).map((genre) => (
          <span
            key={genre.id}
            className="inline-flex items-center h-5 px-2 py-0.5 text-xs border border-white/20 bg-white/5 text-white/80 rounded"
          >
            {genre.name}
          </span>
        ))}
      {country &&
        country.length > 0 &&
        country
          .slice(0, 2)
          .map((c) => (
            <CountryBadge
              key={c.iso_3166_1}
              country={c}
              showFlag={true}
              showName={false}
              size="sm"
              variant="outline"
              className="inline-flex items-center h-5 px-2 py-0.5 border-white/20 bg-white/5 rounded"
            />
          ))}
    </div>
  </div>
);
