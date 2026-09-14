import "server-only";

import {
  readBundledJson,
  TMDB_ANILIST_LOOKUP_FILE,
} from "@/lib/anime/bundled-mapping-files";
import {
  tmdbAnilistLookupMovieKey,
  tmdbAnilistLookupTvKey,
  TMDB_ANILIST_LOOKUP_VERSION,
  type TmdbAnilistLookup,
} from "@/lib/anime/tmdb-anilist-lookup";
import { getCoalescingMemoryCache } from "@/lib/cache/coalescing-memory-cache";

const MEMORY_TTL_MS = 60 * 60 * 24 * 1000;

const entryCache = getCoalescingMemoryCache("tmdb-anilist-lookup-entries", {
  ttlMs: MEMORY_TTL_MS,
  maxEntries: 10_000,
});

type CachedLookup = {
  value: TmdbAnilistLookup | null;
  expiresAt: number;
};

let cachedLookup: CachedLookup | null = null;
let inflightLookup: Promise<TmdbAnilistLookup | null> | null = null;

const loadLookup = async (): Promise<TmdbAnilistLookup | null> =>
  readBundledJson<TmdbAnilistLookup>(TMDB_ANILIST_LOOKUP_FILE);

export const getTmdbAnilistLookup =
  async (): Promise<TmdbAnilistLookup | null> => {
    const now = Date.now();
    if (cachedLookup && cachedLookup.expiresAt > now) {
      return cachedLookup.value;
    }

    if (!inflightLookup) {
      inflightLookup = loadLookup()
        .then((value) => {
          cachedLookup = {
            value:
              value && value.version === TMDB_ANILIST_LOOKUP_VERSION
                ? value
                : null,
            expiresAt: Date.now() + MEMORY_TTL_MS,
          };
          return cachedLookup.value;
        })
        .finally(() => {
          inflightLookup = null;
        });
    }

    return inflightLookup;
  };

/**
 * O(1) TMDB -> AniList resolution backed by the precomputed
 * `tmdb-anilist-lookup.json` artifact (AniBridge > Fribb > MAL index).
 * Falls back to season 1 so it mirrors `resolveTmdbShowToAnilistId`
 * without the live AniList-search tail.
 */
export const getAnilistIdFromTmdbLookup = async (
  tmdbShowId: number,
  seasonNumber?: number | null,
): Promise<number | null> => {
  if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) return null;

  const lookup = await getTmdbAnilistLookup();
  if (!lookup) return null;

  const seasonsToTry: number[] = [];
  if (
    typeof seasonNumber === "number" &&
    Number.isInteger(seasonNumber) &&
    seasonNumber > 0
  ) {
    seasonsToTry.push(seasonNumber);
  }
  if (!seasonsToTry.includes(1)) seasonsToTry.push(1);

  for (const season of seasonsToTry) {
    const cacheKey = tmdbAnilistLookupTvKey(tmdbShowId, season);
    const cached = entryCache.get<number | null>(cacheKey);
    if (cached !== undefined) {
      if (cached !== null) return cached;
      continue;
    }
    const resolved = lookup.tv[cacheKey] ?? null;
    entryCache.set(cacheKey, resolved);
    if (resolved) return resolved;
  }

  return null;
};

export const getAnilistIdFromTmdbMovieLookup = async (
  tmdbMovieId: number,
): Promise<number | null> => {
  if (!Number.isInteger(tmdbMovieId) || tmdbMovieId <= 0) return null;

  const cacheKey = tmdbAnilistLookupMovieKey(tmdbMovieId);
  const cached = entryCache.get<number | null>(cacheKey);
  if (cached !== undefined) return cached;

  const lookup = await getTmdbAnilistLookup();
  const resolved = lookup?.movie[cacheKey] ?? null;
  entryCache.set(cacheKey, resolved);
  return resolved;
};
