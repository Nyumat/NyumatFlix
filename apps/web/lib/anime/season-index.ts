import "server-only";

import {
  readBundledJson,
  SEASON_INDEX_FILE,
} from "@/lib/anime/bundled-mapping-files";
import type {
  SeasonIndex,
  SeasonIndexEntry,
} from "@/lib/anime/season-index-types";
import { seasonIndexLookupKey } from "@/lib/anime/season-index-types";
import { getCoalescingMemoryCache } from "@/lib/cache/coalescing-memory-cache";

const MEMORY_TTL_MS = 60 * 60 * 24 * 1000;

const entryCache = getCoalescingMemoryCache("season-index-entries", {
  ttlMs: MEMORY_TTL_MS,
  maxEntries: 2_000,
});

type CachedSeasonIndex = {
  value: SeasonIndex | null;
  expiresAt: number;
};

let cachedSeasonIndex: CachedSeasonIndex | null = null;
let inflightSeasonIndex: Promise<SeasonIndex | null> | null = null;

const loadSeasonIndex = async (): Promise<SeasonIndex | null> =>
  readBundledJson<SeasonIndex>(SEASON_INDEX_FILE);

export const getSeasonIndex = async (): Promise<SeasonIndex | null> => {
  const now = Date.now();
  if (cachedSeasonIndex && cachedSeasonIndex.expiresAt > now) {
    return cachedSeasonIndex.value;
  }

  if (!inflightSeasonIndex) {
    inflightSeasonIndex = loadSeasonIndex()
      .then((value) => {
        cachedSeasonIndex = {
          value,
          expiresAt: Date.now() + MEMORY_TTL_MS,
        };
        return value;
      })
      .finally(() => {
        inflightSeasonIndex = null;
      });
  }

  return inflightSeasonIndex;
};

export const getSeasonIndexEntry = async (input: {
  tmdbShowId: number;
  seasonNumber: number;
}): Promise<SeasonIndexEntry | null> => {
  const cacheKey = seasonIndexLookupKey(input.tmdbShowId, input.seasonNumber);
  const cached = entryCache.get<SeasonIndexEntry | null>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const index = await getSeasonIndex();
  if (!index || index.version !== 1) {
    entryCache.set(cacheKey, null);
    return null;
  }

  const entry = index.entries[cacheKey] ?? null;
  entryCache.set(cacheKey, entry);
  return entry;
};
