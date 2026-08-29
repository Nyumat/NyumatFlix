/** Shared stream ranking: source quality and resolution beat x264/playability tiebreakers. */
export interface StreamRankInput {
    name: string;
    resolution?: string;
    fileName?: string;
    playback?: string;
    browserPlayable?: boolean;
    size?: number | string;
}
export declare function isStereoscopicRelease(value: string): boolean;
export declare function isCamOrTelesync(blob: string): boolean;
/** Score release source from torrent/file name. Higher = better. Cam/telesync = 0. */
export declare function releaseQualityScore(blob: string): number;
export declare function streamResolutionRank(name: string, resolution?: string): number;
/** Higher score = better stream for auto-play and list ordering. */
export declare function streamPickScore(stream: StreamRankInput): number;
export declare function compareStreamRank(a: StreamRankInput, b: StreamRankInput): number;
export declare function rankStreams<T extends StreamRankInput>(streams: readonly T[]): T[];
export declare function pickBestStream<T extends StreamRankInput>(streams: readonly T[]): T | null;
