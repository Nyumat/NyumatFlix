"use client";

import { PosterCard } from "@/components/cards/poster-card";
import { formatYear } from "@/lib/cards/formatters";
import { hasPosterPath } from "@/lib/media-poster-path";
import { resolveTvCardHref } from "@/lib/tv-card-href";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import { type TvShow } from "@/tmdb/models";

export type TvCardProps = TvShow & {
  variant?: "default" | "linkOnly";
  catalog?: TvDetailCatalog | null;
};

export const TvCard: React.FC<TvCardProps> = (props) => {
  const { variant: _variant, catalog, ...show } = props;

  if (!hasPosterPath(show)) {
    return null;
  }

  const href =
    "href" in show && typeof show.href === "string" ? show.href : undefined;

  return (
    <PosterCard
      item={{
        ...show,
        media_type: "tv",
        title: show.name,
        href: resolveTvCardHref(
          {
            id: show.id,
            href,
            poster_path: show.poster_path,
          },
          catalog,
        ),
        date: show.first_air_date,
        year: formatYear(show.first_air_date),
      }}
    />
  );
};
