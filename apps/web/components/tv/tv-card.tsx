"use client";

import { ContentCard } from "@/components/content/content-card";
import {
  hasCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { formatYear } from "@/lib/cards/formatters";
import { resolveTvCardHref } from "@/lib/tv-card-href";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import { type TvShow } from "@/tmdb/models";

export type TvCardProps = TvShow & {
  variant?: "default" | "linkOnly";
  catalog?: TvDetailCatalog | null;
  href?: string;
  sourceAnilistId?: number;
};

export const TvCard: React.FC<TvCardProps> = (props) => {
  const { variant: _variant, catalog, ...show } = props;
  const catalogCardStyle = useCatalogCardStyle();

  if (!hasCatalogCardArt(show, catalogCardStyle)) {
    return null;
  }

  const href =
    "href" in show && typeof show.href === "string" ? show.href : undefined;
  const sourceAnilistId =
    "sourceAnilistId" in show && typeof show.sourceAnilistId === "number"
      ? show.sourceAnilistId
      : undefined;

  return (
    <ContentCard
      item={{
        ...show,
        media_type: "tv",
        title: show.name,
        href: resolveTvCardHref(
          {
            id: show.id,
            href,
            poster_path: show.poster_path,
            sourceAnilistId,
          },
          catalog,
        ),
        date: show.first_air_date,
        year: formatYear(show.first_air_date),
      }}
      isMobile={false}
    />
  );
};
