import "server-only";

import { scrapeFetchText } from "./fetch";
import type { VixsrcPlaybackRefresh } from "./vixsrc-constants";
import {
  VIXSRC_PROACTIVE_REFRESH_AFTER_MS,
  VIXSRC_REFRESH_BEFORE_MS,
  VIXSRC_REFRESH_BUFFER_MS,
} from "./vixsrc-constants";
import {
  buildVixsrcPlaylistUrl,
  extractVixsrcPlaylistParams,
  isVixsrcPlaylistUrl,
  VIXSRC_ORIGIN,
} from "./vixsrc-shared";

export {
  VIXSRC_PLAYLIST_TTL_MS,
  VIXSRC_PROACTIVE_REFRESH_AFTER_MS,
  VIXSRC_REFRESH_BEFORE_MS,
  VIXSRC_REFRESH_BUFFER_MS,
} from "./vixsrc-constants";
export type { VixsrcPlaybackRefresh } from "./vixsrc-constants";

type VixsrcSession = {
  playlistUrl: string;
  fetchedAt: number;
  expires?: number;
};

const sessionCache = new Map<string, VixsrcSession>();
const inflightRefreshes = new Map<string, Promise<VixsrcSession | null>>();
const MAX_SESSION_CACHE_ENTRIES = 500;

const sessionKeyFor = (refresh: VixsrcPlaybackRefresh): string =>
  `${refresh.videoId}:${refresh.embedUrl}`;

const setSessionCache = (key: string, session: VixsrcSession): void => {
  sessionCache.delete(key);
  sessionCache.set(key, session);

  while (sessionCache.size > MAX_SESSION_CACHE_ENTRIES) {
    const oldestKey = sessionCache.keys().next().value;
    if (!oldestKey) break;
    sessionCache.delete(oldestKey);
  }
};

export const invalidateVixsrcSession = (refresh: VixsrcPlaybackRefresh) => {
  sessionCache.delete(sessionKeyFor(refresh));
};

const expiresStillValid = (
  expires: number | undefined,
  nowMs: number,
): boolean => {
  if (!expires) {
    return false;
  }
  const bufferSec = VIXSRC_REFRESH_BUFFER_MS / 1000;
  return expires - bufferSec > nowMs / 1000;
};

const sessionStillValid = (session: VixsrcSession, nowMs: number): boolean => {
  if (expiresStillValid(session.expires, nowMs)) {
    return true;
  }
  return nowMs - session.fetchedAt < VIXSRC_REFRESH_BEFORE_MS;
};

export const fetchVixsrcPlaylistUrl = async (
  refresh: VixsrcPlaybackRefresh,
): Promise<string | null> => {
  const embed = await scrapeFetchText(refresh.embedUrl, {
    Referer: `${VIXSRC_ORIGIN}/`,
    Origin: VIXSRC_ORIGIN,
  });

  if (embed.status !== 200) {
    return null;
  }

  const params = extractVixsrcPlaylistParams(embed.text);
  if (!params || params.videoId !== refresh.videoId) {
    return null;
  }

  return buildVixsrcPlaylistUrl(params);
};

const refreshVixsrcSession = async (
  refresh: VixsrcPlaybackRefresh,
  key: string,
): Promise<VixsrcSession | null> => {
  const inflight = inflightRefreshes.get(key);
  if (inflight) {
    return inflight;
  }

  const promise = (async () => {
    try {
      const playlistUrl = await fetchVixsrcPlaylistUrl(refresh);
      if (!playlistUrl) {
        return null;
      }

      let expires = refresh.expires;
      try {
        const parsed = new URL(playlistUrl);
        const raw = parsed.searchParams.get("expires");
        if (raw) {
          expires = Number.parseInt(raw, 10);
        }
      } catch {
        void 0;
      }

      const session: VixsrcSession = {
        playlistUrl,
        fetchedAt: Date.now(),
        expires: Number.isFinite(expires) ? expires : undefined,
      };
      setSessionCache(key, session);
      return session;
    } finally {
      inflightRefreshes.delete(key);
    }
  })();

  inflightRefreshes.set(key, promise);
  return promise;
};

const maybeProactivelyRefreshVixsrcSession = (
  refresh: VixsrcPlaybackRefresh,
  cached: VixsrcSession,
  key: string,
  now: number,
) => {
  const ageMs = now - cached.fetchedAt;
  if (ageMs < VIXSRC_PROACTIVE_REFRESH_AFTER_MS) {
    return;
  }

  if (inflightRefreshes.has(key)) {
    return;
  }

  void refreshVixsrcSession(refresh, key);
};

export async function getOrRefreshVixsrcSession(
  refresh: VixsrcPlaybackRefresh,
  options: { force?: boolean } = {},
): Promise<VixsrcSession | null> {
  const key = sessionKeyFor(refresh);
  const cached = sessionCache.get(key);
  const now = Date.now();

  if (!options.force && cached && sessionStillValid(cached, now)) {
    maybeProactivelyRefreshVixsrcSession(refresh, cached, key, now);
    return cached;
  }

  return refreshVixsrcSession(refresh, key);
}

export async function resolveVixsrcPlaybackUrl(
  upstreamUrl: string,
  refresh: VixsrcPlaybackRefresh,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!isVixsrcPlaylistUrl(upstreamUrl, refresh.videoId)) {
    return upstreamUrl;
  }

  const session = await getOrRefreshVixsrcSession(refresh, options);
  if (!session) {
    return upstreamUrl;
  }

  return session.playlistUrl;
}

/** Cache playlist URL from the initial scrape so playback starts inside the TTL window. */
export function primeVixsrcSession(
  refresh: VixsrcPlaybackRefresh,
  streamUrl: string,
): void {
  if (!isVixsrcPlaylistUrl(streamUrl, refresh.videoId)) {
    return;
  }

  let expires = refresh.expires;
  try {
    const parsed = new URL(streamUrl);
    const raw = parsed.searchParams.get("expires");
    if (raw) {
      expires = Number.parseInt(raw, 10);
    }
  } catch {
    void 0;
  }

  setSessionCache(sessionKeyFor(refresh), {
    playlistUrl: streamUrl,
    fetchedAt: refresh.seedFetchedAt,
    expires: Number.isFinite(expires) ? expires : undefined,
  });
}

export const isRetryableVixsrcUpstreamStatus = (status: number) =>
  status === 401 ||
  status === 403 ||
  status === 404 ||
  status === 410 ||
  status === 502 ||
  status === 503;
