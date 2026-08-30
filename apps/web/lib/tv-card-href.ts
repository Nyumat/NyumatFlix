import {
  buildAnilistTvDetailHref,
  normalizeAnilistAnimeDetailHref,
} from "@/lib/anilist-route-id";
import { isRemoteImagePath } from "@/lib/media-poster-path";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";

export const resolveTvCardHref = (
  show: {
    id: number;
    href?: string | null;
    poster_path?: string | null;
  },
  catalog?: TvDetailCatalog | null,
): string => {
  if (typeof show.href === "string" && show.href.trim().length > 0) {
    return normalizeAnilistAnimeDetailHref(show.href);
  }

  if (isRemoteImagePath(show.poster_path)) {
    return buildAnilistTvDetailHref(show.id);
  }

  if (catalog === "anime") {
    return buildTmdbAnimeDetailHref(show.id);
  }

  return `/tvshows/${show.id}`;
};
