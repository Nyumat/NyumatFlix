"use client";

import { ContentCard } from "@/components/content/content-card";
import {
  hasCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { formatYear } from "@/lib/cards/formatters";
import { type Movie } from "@/tmdb/models";

export type MovieCardProps = Movie & {
  variant?: "default" | "linkOnly";
};

export const MovieCard: React.FC<MovieCardProps> = (props) => {
  const { variant: _variant, ...movie } = props;
  const catalogCardStyle = useCatalogCardStyle();

  if (!hasCatalogCardArt(movie, catalogCardStyle)) {
    return null;
  }

  return (
    <ContentCard
      item={{
        ...movie,
        media_type: "movie",
        title: movie.title,
        href:
          "href" in movie && typeof movie.href === "string"
            ? movie.href
            : `/movies/${movie.id}`,
        date: movie.release_date,
        year: formatYear(movie.release_date),
      }}
      isMobile={false}
    />
  );
};
