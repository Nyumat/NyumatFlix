import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import type { MediaItem } from "@/lib/domain/typings";
import { normalizeTvContentKey } from "@/lib/tv-watch-target";

/** TMDB tv id attached to AniList-backed detail payloads when a mapping exists. */
export function readMappedTmdbTvIdFromMedia(media: MediaItem): number | null {
  const value = (media as { mappedTmdbTvId?: number | null }).mappedTmdbTvId;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/** TMDB id for stream discovery / direct playback — never the AniList route slug. */
export function resolveTvPlaybackTmdbId(
  tvShowId: string | null,
  media: MediaItem,
  catalog: TvDetailCatalog | null = null,
): number | null {
  if (!tvShowId) {
    return normalizeTvContentKey(media.id);
  }

  if (isAnilistBackedTvRouteId(tvShowId, catalog)) {
    return readMappedTmdbTvIdFromMedia(media);
  }

  return normalizeTvContentKey(tvShowId);
}

export function isDirectPlaybackEligible(input: {
  directScrapeProviderAvailable: boolean;
  mediaType: "movie" | "tv";
  mediaId: number;
  isAdultAnime: boolean;
  resolvedTmdbTvId: number | null;
}): boolean {
  if (!input.directScrapeProviderAvailable) {
    return false;
  }

  if (input.mediaType === "movie") {
    return Number.isInteger(input.mediaId) && input.mediaId > 0;
  }

  if (input.isAdultAnime) {
    return false;
  }

  return input.resolvedTmdbTvId !== null;
}

export function excludeDirectScrapeProvider<T extends { providerId: string }>(
  options: readonly T[],
  directEligible: boolean,
): T[] {
  if (directEligible) {
    return [...options];
  }

  return options.filter((option) => option.providerId !== "direct");
}
