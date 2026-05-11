"use client";

import { PosterCard } from "@/components/cards";
import { formatYear } from "@/lib/cards";
import { hasPosterPath } from "@/lib/media-poster-path";
import { type TvShow } from "@/tmdb/models";

export type TvCardProps = TvShow & {
  variant?: "default" | "linkOnly";
};

export const TvCard: React.FC<TvCardProps> = (props) => {
  const { variant: _variant, ...show } = props;

  if (!hasPosterPath(show)) {
    return null;
  }

  return (
    <PosterCard
      item={{
        ...show,
        media_type: "tv",
        title: show.name,
        href: `/tvshows/${show.id}`,
        date: show.first_air_date,
        year: formatYear(show.first_air_date),
      }}
    />
  );
};
