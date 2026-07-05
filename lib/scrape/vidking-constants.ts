import type { ScrapeMediaInput } from "./types";

/** VidKing seed TTL from api.wingsdatabase.com/seed (`ttlMs: 30000`). */
export const VIDKING_SEED_TTL_MS = 30_000;

/** Refresh ~5s before expiry so range requests and seeks stay inside the window. */
export const VIDKING_REFRESH_BUFFER_MS = 5_000;

export const VIDKING_REFRESH_BEFORE_MS =
  VIDKING_SEED_TTL_MS - VIDKING_REFRESH_BUFFER_MS;

/** Start warming the next CDN token before the cached one expires. */
export const VIDKING_PROACTIVE_REFRESH_AFTER_MS = 15_000;

export type VidKingPlaybackRefresh = ScrapeMediaInput & {
  providerId: "vidking";
  seedFetchedAt: number;
};
