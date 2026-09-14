import "server-only";

import {
  getAniBridgeMappings,
  resolveAniBridgeTmdbShowIdForAnilist,
} from "@/lib/anime/anibridge-mappings";
import {
  overrideAnilistIdForTmdbShow,
  overrideMalIdForTmdbShow,
} from "@/lib/anime/mapping-overrides";
import {
  getAnilistIdFromTmdbLookup,
  getAnilistIdFromTmdbMovieLookup,
} from "@/lib/anime/tmdb-anilist-lookup-server";
import {
  getCachedTmdbResponse,
  tmdbMovieCacheTag,
  tmdbTvCacheTag,
} from "@/lib/server/tmdb-response-cache";
import { getAnilistIdFromFribb, getTmdbIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { fetchAnilistIdByMal } from "@/lib/scrape/anime/anilist-meta";

/**
 * TMDB -> AniList resolution. Hot path is a single O(1) lookup against the
 * precomputed `tmdb-anilist-lookup.json` artifact (AniBridge > Fribb > MAL
 * index, baked at build time). The 14MB graph parse + live AniList search
 * only run when the lookup misses. Results are cached 24h
 * (`unstable_cache` + memory) so catalog enrichment and detail pages share
 * one source of truth.
 */
const loadTmdbShowAnilistId = async (
  tmdbShowId: number,
  seasonNumber?: number | null,
): Promise<number | null> => {
  const fromLookup = await getAnilistIdFromTmdbLookup(tmdbShowId, seasonNumber);
  if (fromLookup) return fromLookup;

  const fromFribb = await getAnilistIdFromFribb(tmdbShowId, "tv");
  if (fromFribb) return fromFribb;

  const fromMalIndex = await resolveTmdbToAnilistFromMappings(
    tmdbShowId,
    "tv",
    seasonNumber ?? undefined,
  );
  if (fromMalIndex) return fromMalIndex;

  const malOverride = overrideMalIdForTmdbShow(tmdbShowId);
  if (malOverride) {
    const fromMalLive = await fetchAnilistIdByMal(malOverride);
    if (fromMalLive) return fromMalLive;
  }

  return null;
};

export const resolveTmdbShowToAnilistId = async (
  tmdbShowId: number,
  seasonNumber?: number | null,
): Promise<number | null> => {
  if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) {
    return null;
  }

  const fromOverride = overrideAnilistIdForTmdbShow(tmdbShowId);
  if (fromOverride) return fromOverride;

  const seasonSuffix =
    typeof seasonNumber === "number" &&
    Number.isInteger(seasonNumber) &&
    seasonNumber > 0
      ? `:s${seasonNumber}`
      : "";
  return getCachedTmdbResponse({
    cacheKey: `tmdb-anilist:tv:${tmdbShowId}${seasonSuffix}`,
    tags: [tmdbTvCacheTag(tmdbShowId)],
    revalidateSeconds: 60 * 60 * 24,
    memoryFallback: true,
    load: () => loadTmdbShowAnilistId(tmdbShowId, seasonNumber),
  });
};

export const resolveTmdbMediaToAnilistId = async (
  tmdbId: number,
  mediaType: "movie" | "tv",
  seasonNumber?: number | null,
): Promise<number | null> => {
  if (mediaType === "tv") {
    return resolveTmdbShowToAnilistId(tmdbId, seasonNumber);
  }

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return null;
  }

  return getCachedTmdbResponse({
    cacheKey: `tmdb-anilist:movie:${tmdbId}`,
    tags: [tmdbMovieCacheTag(tmdbId)],
    revalidateSeconds: 60 * 60 * 24,
    memoryFallback: true,
    load: async () => {
      const fromLookup = await getAnilistIdFromTmdbMovieLookup(tmdbId);
      if (fromLookup) return fromLookup;

      const fromFribb = await getAnilistIdFromFribb(tmdbId, "movie");
      if (fromFribb) return fromFribb;

      return resolveTmdbToAnilistFromMappings(
        tmdbId,
        "movie",
        seasonNumber ?? undefined,
      );
    },
  });
};

export const resolveAnilistToTmdbShow = async (
  anilistId: number,
): Promise<{ tmdbShowId: number; seasonNumber: number | null } | null> => {
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return null;
  }

  try {
    const mappings = await getAniBridgeMappings();
    const fromAniBridge = resolveAniBridgeTmdbShowIdForAnilist(
      mappings,
      anilistId,
    );
    if (fromAniBridge?.tmdbShowId) {
      return {
        tmdbShowId: fromAniBridge.tmdbShowId,
        seasonNumber: fromAniBridge.seasonNumber,
      };
    }
  } catch {
    // fall through to Fribb
  }

  const fromFribb = await getTmdbIdFromFribb(anilistId);
  if (fromFribb?.type === "tv" && fromFribb.id > 0) {
    return {
      tmdbShowId: fromFribb.id,
      seasonNumber: fromFribb.season ?? null,
    };
  }

  return null;
};

export const resolveAnilistToTmdbShowId = async (
  anilistId: number,
): Promise<number | null> => {
  const resolved = await resolveAnilistToTmdbShow(anilistId);
  return resolved?.tmdbShowId ?? null;
};
