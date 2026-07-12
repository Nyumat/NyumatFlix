/** Default playlist token window when embed omits explicit expires. */
export const VIXSRC_PLAYLIST_TTL_MS = 30_000;

/** Refresh ~5s before expiry so seeks stay inside the window. */
export const VIXSRC_REFRESH_BUFFER_MS = 5_000;

export const VIXSRC_REFRESH_BEFORE_MS =
  VIXSRC_PLAYLIST_TTL_MS - VIXSRC_REFRESH_BUFFER_MS;

/** Start warming the next token before the hard refresh window. */
export const VIXSRC_PROACTIVE_REFRESH_AFTER_MS = 15_000;

/** Metadata to re-mint VixSrc playlist tokens at playback time. */
export type VixsrcPlaybackRefresh = {
  providerId: "vixsrc";
  videoId: string;
  embedUrl: string;
  seedFetchedAt: number;
  /** Unix seconds from embed when available. */
  expires?: number;
};
