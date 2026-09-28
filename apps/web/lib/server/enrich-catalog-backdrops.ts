import "server-only";

import {
  applyTmdbImagesToAnimeHubItem,
  isTmdbBackdropPath,
  shouldEnrichAnimeHubCatalogVisuals,
} from "@/lib/anime-hub-catalog-visuals";
import { pickLocalizedCatalogBackdropPath } from "@/lib/catalog-hub-backdrop";
import { runInChunks } from "@/lib/server/chunked-parallel";
import {
  getCachedTmdbResponse,
  tmdbMovieCacheTag,
  tmdbTvCacheTag,
} from "@/lib/server/tmdb-response-cache";
import { tmdb } from "@/tmdb/api";
import type { CanonicalCardLogo } from "@/lib/domain/typings";
import type { GetImagesResponse } from "@/tmdb/models";

type EnrichableCatalogItem = {
  id: number;
  media_type?: string;
  backdrop_path?: string | null;
  isAniListFallback?: boolean;
  localized_backdrop?: boolean;
};

type EnrichableAnimeHubVisualItem = EnrichableCatalogItem & {
  logo?: CanonicalCardLogo;
};

const ENRICH_CHUNK_SIZE = 8;

const shouldEnrichCatalogBackdrop = (item: EnrichableCatalogItem): boolean => {
  if (item.isAniListFallback) {
    return false;
  }
  if (!Number.isInteger(item.id) || item.id <= 0) {
    return false;
  }
  if (item.backdrop_path && !isTmdbBackdropPath(item.backdrop_path)) {
    return false;
  }
  return true;
};

const resolveCatalogMediaType = (
  item: EnrichableCatalogItem,
): "movie" | "tv" => (item.media_type === "tv" ? "tv" : "movie");

const loadTmdbImages = async (
  id: number,
  mediaType: "movie" | "tv",
): Promise<GetImagesResponse> =>
  getCachedTmdbResponse({
    cacheKey: `tmdb:${mediaType}:${id}:images:en,null`,
    tags: [mediaType === "movie" ? tmdbMovieCacheTag(id) : tmdbTvCacheTag(id)],
    revalidateSeconds: 60 * 60 * 24,
    memoryFallback: true,
    load: () =>
      mediaType === "movie"
        ? tmdb.movie.images({ id, langs: "en,null" })
        : tmdb.tv.images({ id, langs: "en,null" }),
  });

const enrichCatalogBackdropItem = async <T extends EnrichableCatalogItem>(
  item: T,
): Promise<T> => {
  if (!shouldEnrichCatalogBackdrop(item)) {
    return item;
  }

  const mediaType = resolveCatalogMediaType(item);

  try {
    const images = await loadTmdbImages(item.id, mediaType);
    const picked = pickLocalizedCatalogBackdropPath({
      backdrop_path: item.backdrop_path,
      images,
    });

    if (!picked.path) {
      return item;
    }

    return {
      ...item,
      backdrop_path: picked.path,
      localized_backdrop: picked.localized,
    };
  } catch {
    return item;
  }
};

export const enrichLocalizedCatalogBackdrops = async <
  T extends EnrichableCatalogItem,
>(
  items: T[],
): Promise<T[]> =>
  runInChunks(items, enrichCatalogBackdropItem, ENRICH_CHUNK_SIZE);

const enrichAnimeHubCatalogVisualItem = async <
  T extends EnrichableAnimeHubVisualItem,
>(
  item: T,
): Promise<T> => {
  if (!shouldEnrichAnimeHubCatalogVisuals(item)) {
    return item;
  }

  const mediaType = resolveCatalogMediaType(item);

  try {
    const images = await loadTmdbImages(item.id, mediaType);
    return applyTmdbImagesToAnimeHubItem(item, images);
  } catch {
    return item;
  }
};

/** TMDB backdrops + logos for Fribb-mapped anime hub/search rows. */
export const enrichAnimeHubCatalogVisuals = async <
  T extends EnrichableAnimeHubVisualItem,
>(
  items: T[],
): Promise<T[]> =>
  runInChunks(items, enrichAnimeHubCatalogVisualItem, ENRICH_CHUNK_SIZE);
