/** calluspirates stream shape — kept in sync with calluspirates/web/src/lib/api.ts */
export type DirectStreamPlayback = "hls" | "direct" | "extended";
export type DirectPlaybackEngineHint = "movi-first" | "hls-first";
export type DirectTranscodeProfile = "light" | "heavy" | "ultra";
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
    playbackHint?: DirectPlaybackEngineHint;
    transcodeProfile?: DirectTranscodeProfile;
    notWebReady?: boolean;
};
export type DirectStreamsResponse = {
    streams: DirectStream[];
    message?: string;
};
export type DirectPlaybackStatus = "idle" | "loading" | "playing" | "error";
/** @deprecated use DirectPlaybackStatus */
export type DirectMoviePlaybackStatus = DirectPlaybackStatus;
