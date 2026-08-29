/** calluspirates stream shape — kept in sync with calluspirates/web/src/lib/api.ts */

export type DirectStreamPlayback = "hls" | "direct" | "extended";

export type DirectStream = {
  name: string;
  resolution: string;
  size: number | string;
  url: string;
  playback?: DirectStreamPlayback;
  fallbackUrl?: string;
  cached: boolean;
  hash: string;
  fileName?: string;
  mime?: string;
  browserPlayable?: boolean;
  source?: string;
  ready?: boolean;
  phase?: "addon" | "torbox" | "cached";
  resolveKey?: string;
};

export type DirectStreamsResponse = {
  streams: DirectStream[];
  message?: string;
};

export type DirectPlaybackStatus = "idle" | "loading" | "playing" | "error";

/** @deprecated use DirectPlaybackStatus */
export type DirectMoviePlaybackStatus = DirectPlaybackStatus;
