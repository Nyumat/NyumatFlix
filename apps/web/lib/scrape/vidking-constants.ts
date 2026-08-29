import type { ScrapeMediaInput, ScrapeMediaType } from "./types";
import {
  getWingsApiRuntime,
  isRegisteredWingsApiHostname,
} from "./wings-api-runtime";

/** Shared VidEasy/VidKing API. Replaced api.wingsdatabase.com (NXDOMAIN as of 2026-08). */
export const WINGS_API_BASE = "https://api.speedracelight.com";
export const WINGS_API_HOSTNAME = new URL(WINGS_API_BASE).hostname;

export const VIDEASY_PLAYER_ORIGIN = "https://player.videasy.to";
export const VIDKING_PLAYER_ORIGIN = "https://www.vidking.net";

/** Wings mirror fetches + seed discovery can exceed the default 8s play-probe budget. */
export const WINGS_SOURCE_FETCH_TIMEOUT_MS = 12_000;

export const getWingsApiBase = (): string =>
  getWingsApiRuntime()?.apiBase ?? WINGS_API_BASE;

export const getVideasyPlayerOrigin = (): string =>
  getWingsApiRuntime()?.videasyPlayerOrigin ?? VIDEASY_PLAYER_ORIGIN;

export const getVidkingPlayerOrigin = (): string =>
  getWingsApiRuntime()?.vidkingPlayerOrigin ?? VIDKING_PLAYER_ORIGIN;

export const isWingsApiHostname = (hostname: string): boolean => {
  if (hostname === WINGS_API_HOSTNAME) {
    return true;
  }
  if (isRegisteredWingsApiHostname(hostname)) {
    return true;
  }
  try {
    return hostname === new URL(getWingsApiBase()).hostname;
  } catch {
    return false;
  }
};

export const wingsSeedUrl = (tmdbId: number): string =>
  `${getWingsApiBase()}/seed?mediaId=${encodeURIComponent(String(tmdbId))}`;

export type WingsSourceQuery = {
  title: string;
  mediaType: ScrapeMediaType;
  year: string;
  tmdbId: number;
  imdbId: string;
  seasonId: string;
  episodeId: string;
  seed: string;
};

export const wingsSourceUrl = (
  endpoint: string,
  query: WingsSourceQuery,
): string => {
  const params = new URLSearchParams({
    title: query.title,
    mediaType: query.mediaType,
    year: query.year,
    episodeId: query.episodeId,
    seasonId: query.seasonId,
    tmdbId: String(query.tmdbId),
    imdbId: query.imdbId,
    enc: "2",
    seed: query.seed,
  });
  return `${getWingsApiBase()}/${endpoint}?${params.toString()}`;
};

export const getWingsCdnReferers = (): string[] => [
  ...new Set([
    `${getVidkingPlayerOrigin()}/`,
    `${VIDKING_PLAYER_ORIGIN}/`,
    "https://vidking.net/",
    `${getVideasyPlayerOrigin()}/`,
    `${VIDEASY_PLAYER_ORIGIN}/`,
    "https://player.videasy.net/",
  ]),
];

export const wingsApiHeaders = (origin: string): Record<string, string> => {
  const normalized = origin.replace(/\/$/, "");
  return {
    Origin: normalized,
    Referer: `${normalized}/`,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
};

/** VidKing seed TTL from /seed (`ttlMs: 30000`). */
export const VIDKING_SEED_TTL_MS = 30_000;

/** Refresh ~5s before expiry so range requests and seeks stay inside the window. */
export const VIDKING_REFRESH_BUFFER_MS = 5_000;

export const VIDKING_REFRESH_BEFORE_MS =
  VIDKING_SEED_TTL_MS - VIDKING_REFRESH_BUFFER_MS;

/** Start warming the next CDN token before the cached one expires. */
export const VIDKING_PROACTIVE_REFRESH_AFTER_MS = 15_000;

export type VidKingPlaybackRefresh = ScrapeMediaInput & {
  providerId: "vidking" | "videasy";
  seedFetchedAt: number;
};
