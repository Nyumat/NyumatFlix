"use client";

import { GenreBadge } from "@/components/ui/genre-badge";

interface HeroGenresProps {
  genres?: { id: number; name: string }[];
  mediaType?: "movie" | "tv";
}

export function HeroGenres({ genres, mediaType = "movie" }: HeroGenresProps) {
  if (!genres || genres.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {genres.map((genre) => (
        <GenreBadge
          key={genre.id}
          genreId={genre.id}
          genreName={genre.name}
          mediaType={mediaType}
        />
      ))}
    </div>
  );
}
