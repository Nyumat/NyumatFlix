"use client";

import { PosterCard } from "@/components/cards";
import { hasPosterPath } from "@/lib/media-poster-path";
import { formatYear } from "@/lib/cards";
import { type Movie } from "@/tmdb/models";

export type MovieCardProps = Movie & {
  variant?: "default" | "linkOnly";
};

export const MovieCard: React.FC<MovieCardProps> = (props) => {
  const { variant: _variant, ...movie } = props;

  if (!hasPosterPath(movie)) {
    return null;
  }

  return (
    <PosterCard
      item={{
        ...movie,
        media_type: "movie",
        title: movie.title,
        href: `/movies/${movie.id}`,
        date: movie.release_date,
        year: formatYear(movie.release_date),
      }}
    />
  );
};
