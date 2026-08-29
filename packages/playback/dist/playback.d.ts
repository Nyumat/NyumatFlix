/** Mirrors calluspirates/web/src/lib/playback.ts */
import type { DirectStream } from "./types";
export type DirectPlaybackEngine = "movi" | "vidstack-hls" | "vidstack-direct";
type StreamNameFields = {
    name: string;
    fileName?: string;
    size?: number | string;
};
export declare const looksLikeHeavyMoviRemux: (stream: StreamNameFields) => boolean;
export declare const pickEnglishMoviLang: (tracks: ReadonlyArray<{
    lang: string;
    label: string;
}>) => string | null;
export declare const pickMoviTrackPrefs: (audioTracks: ReadonlyArray<{
    lang: string;
    label: string;
}>, subtitleTracks: ReadonlyArray<{
    lang: string;
    label: string;
}>, preferredAudioLang?: string | null) => {
    audioLang: string | null;
    subtitleLang: string | null;
};
type RankedDirectScrapeStream = StreamNameFields & {
    playback?: "hls" | "direct" | "extended";
    browserPlayable?: boolean;
    size?: number;
};
export declare const orderDirectStreamsForScrape: <T extends RankedDirectScrapeStream>(ranked: readonly T[], preferMultiTrack: boolean) => T[];
export declare function looksLikeMultiTrackStream(stream: StreamNameFields): boolean;
export declare function shouldRetainMoviEngine(stream: StreamNameFields & {
    playbackHint?: DirectStream["playbackHint"];
    size?: number | string;
}): boolean;
/** True when client-side movi decode should be the first engine tried. */
export declare function prefersMoviFirstEngine(stream: DirectStream): boolean;
/** Browser-native direct mp4 — starts quickly without movi or server transcode. */
export declare function isFastStartDirectStream(stream: DirectStream | null | undefined): boolean;
export declare function isDirectProgressiveTranscodePath(path: string): boolean;
export declare const playbackEngineLabel: (engine: DirectPlaybackEngine, sourceUrl?: string) => string;
export declare function supportsWebCodecs(): boolean;
export declare function selectInitialEngine(stream: DirectStream): DirectPlaybackEngine | null;
export declare function isStreamPlayable(stream: DirectStream): boolean;
export declare function nextFallbackEngine(stream: DirectStream, current: DirectPlaybackEngine, tried?: ReadonlySet<DirectPlaybackEngine>): DirectPlaybackEngine | null;
export declare function engineSourceUrl(stream: DirectStream, engine: DirectPlaybackEngine): string;
export declare function engineStreamKind(engine: DirectPlaybackEngine, sourceUrl?: string): "hls" | "mp4";
export declare function openDownloadUrl(stream: DirectStream): string;
export declare function playbackEngineCandidates(stream: DirectStream): DirectPlaybackEngine[];
export declare function toDirectStream(input: {
    url: string;
    fallbackUrl?: string;
    playback?: DirectStream["playback"];
    browserPlayable?: boolean;
    name?: string;
    fileName?: string;
    size?: number | string;
    hash?: string;
    playbackHint?: DirectStream["playbackHint"];
    transcodeProfile?: DirectStream["transcodeProfile"];
    notWebReady?: boolean;
}): DirectStream;
export {};
