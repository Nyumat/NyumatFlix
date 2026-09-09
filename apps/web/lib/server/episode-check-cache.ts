import "server-only";

import type { EpisodeInfo } from "@/lib/domain/episodes";
import { checkEpisodesForShow } from "@/lib/server/episode-check-service";

const cache = new Map<string, { data: EpisodeInfo; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const inflightRequests = new Map<string, Promise<EpisodeInfo | null>>();

export function makeEpisodeCheckCacheKey(
  userId: string,
  contentId: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
  status?: string,
): string {
  const progressKey = [
    lastWatchedSeason ?? "none",
    lastWatchedEpisode ?? "none",
  ].join("-");

  const parts = ["episode-data", userId, String(contentId)];
  if (status) {
    parts.push(status);
  }
  parts.push(progressKey);
  return parts.join(":");
}

export function getCachedEpisodeInfo(key: string): EpisodeInfo | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  cache.delete(key);
  return null;
}

export function setCachedEpisodeInfo(key: string, data: EpisodeInfo): void {
  cache.set(key, { data, timestamp: Date.now() });

  if (cache.size <= MAX_CACHE_ENTRIES) {
    return;
  }

  const oldestKey = cache.keys().next().value;
  if (oldestKey) {
    cache.delete(oldestKey);
  }
}

export async function resolveEpisodeInfoWithCache(
  key: string,
  load: () => Promise<EpisodeInfo | null>,
): Promise<EpisodeInfo | null> {
  const cached = getCachedEpisodeInfo(key);
  if (cached) {
    return cached;
  }

  const pending = inflightRequests.get(key);
  if (pending) {
    return pending;
  }

  const promise = load()
    .then((episodeInfo) => {
      if (episodeInfo) {
        setCachedEpisodeInfo(key, episodeInfo);
      }
      return episodeInfo;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, promise);
  return promise;
}

export async function resolveEpisodeCheckForShow(
  contentId: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
  cacheKey?: string,
): Promise<EpisodeInfo | null> {
  if (!cacheKey) {
    return checkEpisodesForShow(
      contentId,
      lastWatchedSeason,
      lastWatchedEpisode,
    );
  }

  return resolveEpisodeInfoWithCache(cacheKey, () =>
    checkEpisodesForShow(contentId, lastWatchedSeason, lastWatchedEpisode),
  );
}
