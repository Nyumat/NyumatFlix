import "server-only";

import { tmdb } from "@/tmdb/api";

/**
 * Resolves a TMDB movie/tv id to its IMDb id via the TMDB detail endpoint with
 * `append_to_response=external_ids`. Used by the trailer route so cards that
 * only carry a TMDB id (TMDB discover rows, Fribb-mapped anime) can still play
 * an IMDb-backed trailer stream.
 *
 * Positive and negative results are cached in-memory for 24h to keep hover
 * previews from hammering TMDB.
 */

const RESOLVE_TTL_MS = 24 * 60 * 60 * 1000;
const RESOLVE_CACHE_MAX = 512;

type ResolveCacheEntry = { expiresAt: number; imdbId: string | null };

const resolveCache = new Map<string, ResolveCacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

const readCache = (key: string): ResolveCacheEntry | undefined => {
  const entry = resolveCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    resolveCache.delete(key);
    return undefined;
  }
  return entry;
};

const writeCache = (key: string, imdbId: string | null) => {
  resolveCache.set(key, { expiresAt: Date.now() + RESOLVE_TTL_MS, imdbId });
  while (resolveCache.size > RESOLVE_CACHE_MAX) {
    const oldest = resolveCache.keys().next().value;
    if (oldest === undefined) break;
    resolveCache.delete(oldest);
  }
};

const normalizeImdbId = (value: unknown): string | null =>
  typeof value === "string" && /^tt\d+$/.test(value.trim())
    ? value.trim()
    : null;

type MovieExternalIds = {
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null } | null;
};

type TvExternalIds = {
  external_ids?: { imdb_id?: string | null } | null;
};

const fetchImdbIdFromTmdb = async (
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<string | null> => {
  try {
    if (mediaType === "movie") {
      const detail = await tmdb.movie.detail<MovieExternalIds>({
        id: tmdbId,
        append: "external_ids",
      });
      return (
        normalizeImdbId(detail.imdb_id) ??
        normalizeImdbId(detail.external_ids?.imdb_id)
      );
    }

    const detail = await tmdb.tv.detail<TvExternalIds>({
      id: tmdbId,
      append: "external_ids",
    });
    return normalizeImdbId(detail.external_ids?.imdb_id);
  } catch {
    return null;
  }
};

export const resolveImdbIdFromTmdb = async (
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<string | null> => {
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return null;

  const key = `${mediaType}:${tmdbId}`;

  const cached = readCache(key);
  if (cached) return cached.imdbId;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchImdbIdFromTmdb(tmdbId, mediaType)
    .then((imdbId) => {
      writeCache(key, imdbId);
      return imdbId;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
};

export const resetTrailerImdbResolveCacheForTests = () => {
  resolveCache.clear();
  inflight.clear();
};
