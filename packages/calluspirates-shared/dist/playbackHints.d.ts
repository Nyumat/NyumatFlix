export type TranscodeProfile = "light" | "heavy" | "ultra";
export type PlaybackEngineHint = "movi-first" | "hls-first";
export interface PlaybackHintInput {
  name: string;
  fileName?: string;
  description?: string;
  size?: number | string;
  playback?: string;
  browserPlayable?: boolean;
}
/** profile 5 (dvhe.05, DV without HDR) decodes magenta/green in the browser. */
export declare function isIncompatibleDolbyVision(
  stream: PlaybackHintInput,
): boolean;
export declare function shouldSkipBrowserPlayback(
  stream: PlaybackHintInput,
): boolean;
export declare function streamSizeBytes(stream: PlaybackHintInput): number;
export declare function isRemuxRelease(stream: PlaybackHintInput): boolean;
export declare function isTooHeavyForBrowserPlayback(
  stream: PlaybackHintInput,
): boolean;
export declare function hasHeavyCodecTags(stream: PlaybackHintInput): boolean;
export declare function is4KRelease(stream: PlaybackHintInput): boolean;
export declare function inferTranscodeProfile(
  stream: PlaybackHintInput,
): TranscodeProfile;
export declare function inferPlaybackEngineHint(
  stream: PlaybackHintInput,
): PlaybackEngineHint;
export declare function requiresExtendedPlayback(name: string): boolean;
export declare function isBrowserPlayableRelease(
  name: string,
  mime?: string,
): boolean;
export interface BrowserStreamCandidateInput extends PlaybackHintInput {
  playback?: string;
  fallbackUrl?: string;
  notWebReady?: boolean;
}
/**
 * True when this release is worth offering for in-browser play (movi / Vidstack).
 * Remux and HDR10-compatible Dolby Vision (profile 8) go through movi-player.
 * Profile 5 (DV without HDR) is skipped — movi cannot tonemap ICtCp.
 */
export declare function isBrowserStreamCandidate(
  stream: BrowserStreamCandidateInput,
): boolean;
export declare function filterBrowserStreams<
  T extends BrowserStreamCandidateInput,
>(streams: readonly T[]): T[];
export declare function partitionBrowserStreams<
  T extends BrowserStreamCandidateInput,
>(
  streams: readonly T[],
): {
  browser: T[];
  external: T[];
};
export declare function prefersTranscodeFirst(
  stream: PlaybackHintInput,
): boolean;
/** MP4 remuxes often lack a moov/keyframe index — HLS playlist generation fails. */
export declare function prefersProgressiveTranscode(
  stream: PlaybackHintInput,
): boolean;
export declare function isProgressiveTranscodePath(path: string): boolean;
/** HLS playlist fallback from MediaFlow → matching progressive fMP4 transcode URL. */
export declare function companionProgressiveTranscodePath(
  transcodePath: string,
): string | null;
