import "server-only";

import { scrapeVidKing } from "./providers/vidking";
import type { ScrapeMediaInput } from "./types";
import { scrapeMediaKeyFor } from "./types";
import {
  extractVidKingCdnToken,
  isVidKingCdnUrl,
  parseVidKingCdnUrl,
  rebuildVidKingCdnUrl,
} from "./vidking-cdn-url";
import type { ScrapePlaybackRefresh } from "./playback-refresh";
import { isVidsrcPlaybackRefresh } from "./playback-refresh";
import type { VidKingPlaybackRefresh } from "./vidking-constants";
import { resolveVidsrcPlaybackUrl } from "./vidsrc-playback";
import {
  VIDKING_PROACTIVE_REFRESH_AFTER_MS,
  VIDKING_REFRESH_BEFORE_MS,
} from "./vidking-constants";

export {
  VIDKING_PROACTIVE_REFRESH_AFTER_MS,
  VIDKING_REFRESH_BEFORE_MS,
  VIDKING_REFRESH_BUFFER_MS,
  VIDKING_SEED_TTL_MS,
} from "./vidking-constants";
export type { VidKingPlaybackRefresh } from "./vidking-constants";
export {
  extractVidKingCdnToken,
  isVidKingCdnUrl,
  parseVidKingCdnUrl,
  rebuildVidKingCdnUrl,
  swapVidKingCdnToken,
} from "./vidking-cdn-url";

type VidKingSession = {
  cdnToken: string;
  referer?: string;
  fetchedAt: number;
};

const sessionCache = new Map<string, VidKingSession>();
const inflightRefreshes = new Map<string, Promise<VidKingSession | null>>();
const MAX_SESSION_CACHE_ENTRIES = 500;

const setSessionCache = (mediaKey: string, session: VidKingSession): void => {
  sessionCache.delete(mediaKey);
  sessionCache.set(mediaKey, session);

  while (sessionCache.size > MAX_SESSION_CACHE_ENTRIES) {
    const oldestKey = sessionCache.keys().next().value;
    if (!oldestKey) break;
    sessionCache.delete(oldestKey);
  }
};

const isRetryableUpstreamStatus = (status: number) =>
  status === 401 ||
  status === 403 ||
  status === 404 ||
  status === 410 ||
  status === 502 ||
  status === 503;

export const invalidateVidKingSession = (refresh: VidKingPlaybackRefresh) => {
  sessionCache.delete(scrapeMediaKeyFor(refresh));
};

const scrapeInputFromRefresh = (
  refresh: VidKingPlaybackRefresh,
): ScrapeMediaInput => ({
  mediaType: refresh.mediaType,
  tmdbId: refresh.tmdbId,
  seasonNumber: refresh.seasonNumber,
  episodeNumber: refresh.episodeNumber,
});

const refreshVidKingSession = async (
  refresh: VidKingPlaybackRefresh,
  mediaKey: string,
): Promise<VidKingSession | null> => {
  const inflight = inflightRefreshes.get(mediaKey);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    try {
      const result = await scrapeVidKing(scrapeInputFromRefresh(refresh));
      if (!result.ok) {
        return null;
      }

      const cdnToken = extractVidKingCdnToken(result.streamUrl);
      if (!cdnToken) {
        return null;
      }

      const session: VidKingSession = {
        cdnToken,
        referer: result.referer,
        fetchedAt: Date.now(),
      };
      setSessionCache(mediaKey, session);
      return session;
    } finally {
      inflightRefreshes.delete(mediaKey);
    }
  })();

  inflightRefreshes.set(mediaKey, promise);
  return promise;
};

const maybeProactivelyRefreshVidKingSession = (
  refresh: VidKingPlaybackRefresh,
  cached: VidKingSession,
  mediaKey: string,
  now: number,
) => {
  const ageMs = now - cached.fetchedAt;
  if (ageMs < VIDKING_PROACTIVE_REFRESH_AFTER_MS) {
    return;
  }

  if (inflightRefreshes.has(mediaKey)) {
    return;
  }

  void refreshVidKingSession(refresh, mediaKey);
};

export async function getOrRefreshVidKingSession(
  refresh: VidKingPlaybackRefresh,
  options: { force?: boolean } = {},
): Promise<VidKingSession | null> {
  const mediaKey = scrapeMediaKeyFor(refresh);
  const cached = sessionCache.get(mediaKey);
  const now = Date.now();

  if (
    !options.force &&
    cached &&
    now - cached.fetchedAt < VIDKING_REFRESH_BEFORE_MS
  ) {
    maybeProactivelyRefreshVidKingSession(refresh, cached, mediaKey, now);
    return cached;
  }

  return refreshVidKingSession(refresh, mediaKey);
}

export async function resolveVidKingPlaybackUrl(
  upstreamUrl: string,
  refresh: VidKingPlaybackRefresh,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!isVidKingCdnUrl(upstreamUrl)) {
    return upstreamUrl;
  }

  const parsed = parseVidKingCdnUrl(upstreamUrl);
  if (!parsed) {
    return upstreamUrl;
  }

  const session = await getOrRefreshVidKingSession(refresh, options);
  if (!session) {
    return upstreamUrl;
  }

  if (session.cdnToken === parsed.token) {
    return upstreamUrl;
  }

  return rebuildVidKingCdnUrl(parsed, session.cdnToken);
}

export async function resolveScrapePlaybackUpstreamUrl(
  upstreamUrl: string,
  refresh: ScrapePlaybackRefresh | undefined,
  options: { force?: boolean } = {},
): Promise<string> {
  if (refresh?.providerId === "vidking") {
    return resolveVidKingPlaybackUrl(upstreamUrl, refresh, options);
  }

  if (isVidsrcPlaybackRefresh(refresh)) {
    return resolveVidsrcPlaybackUrl(upstreamUrl, refresh);
  }

  return upstreamUrl;
}

/** Cache CDN token from the initial scrape so playback starts inside the TTL window. */
export function primeVidKingSession(
  refresh: VidKingPlaybackRefresh,
  streamUrl: string,
  referer?: string,
): void {
  const cdnToken = extractVidKingCdnToken(streamUrl);
  if (!cdnToken) {
    return;
  }

  setSessionCache(scrapeMediaKeyFor(refresh), {
    cdnToken,
    referer,
    fetchedAt: refresh.seedFetchedAt,
  });
}

export { isRetryableUpstreamStatus as isRetryableVidKingUpstreamStatus };
