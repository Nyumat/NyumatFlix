import { supportsWebCodecs, type DirectPlaybackEngine } from "./playback";
export type DirectPlaybackMode = "hls" | "direct" | "extended";
export type { DirectPlaybackEngine };
export { supportsWebCodecs };
export declare function selectDirectPlaybackEngine(playback: DirectPlaybackMode, fallbackUrl?: string, mediaUrl?: string, fileName?: string, name?: string, size?: number | string, browserPlayable?: boolean, playbackHint?: "movi-first" | "hls-first"): DirectPlaybackEngine | null;
export declare function nextDirectPlaybackEngine(playback: DirectPlaybackMode, current: DirectPlaybackEngine, fallbackUrl?: string, mediaUrl?: string, fileName?: string, name?: string, playbackHint?: "movi-first" | "hls-first"): DirectPlaybackEngine | null;
export declare function directEngineSourceUrl(mediaUrl: string, fallbackUrl: string | undefined, engine: DirectPlaybackEngine): string;
export declare function directEngineStreamKind(engine: DirectPlaybackEngine, sourceUrl?: string): "hls" | "mp4";
