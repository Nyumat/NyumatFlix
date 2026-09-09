import "server-only";

import { unstable_cache } from "next/cache";
import { getCoalescingMemoryCache } from "@/lib/cache/coalescing-memory-cache";

const DEFAULT_MEMORY_TTL_MS = 60 * 60 * 1000;
const DEFAULT_REVALIDATE_SECONDS = 60 * 60 * 24;

const getMemoryCache = () =>
  getCoalescingMemoryCache("tmdb-response-memory", {
    ttlMs: DEFAULT_MEMORY_TTL_MS,
    maxEntries: 500,
  });

export type TmdbResponseCacheOptions<T> = {
  cacheKey: string;
  tags: string[];
  load: () => Promise<T>;
  revalidateSeconds?: number;
  memoryFallback?: boolean;
  memoryTtlMs?: number;
};

export const tmdbMovieCacheTag = (id: string | number) => `tmdb:movie:${id}`;

export const tmdbTvCacheTag = (id: string | number) => `tmdb:tv:${id}`;

export const tmdbDiscoverCacheTag = (hash: string) => `tmdb:discover:${hash}`;

export const anilistMediaCacheTag = (id: string | number) =>
  `anilist:media:${id}`;

export const getCachedTmdbResponse = async <T>({
  cacheKey,
  tags,
  load,
  revalidateSeconds = DEFAULT_REVALIDATE_SECONDS,
  memoryFallback = false,
}: TmdbResponseCacheOptions<T>): Promise<T> => {
  const memoryCache = getMemoryCache();

  if (memoryFallback) {
    const memoryHit = memoryCache.get<T>(cacheKey);
    if (memoryHit !== undefined) {
      return memoryHit;
    }
  }

  const cachedLoader = unstable_cache(load, [cacheKey], {
    revalidate: revalidateSeconds,
    tags,
  });

  const result = await cachedLoader();

  if (memoryFallback) {
    memoryCache.set(cacheKey, result);
  }

  return result;
};
