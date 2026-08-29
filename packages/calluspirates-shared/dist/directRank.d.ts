/** Direct provider ranking helpers shared with NyumatFlix. */
import { type StreamRankInput } from "./streamRank.js";
export type DirectStreamRankInput = StreamRankInput;
export declare function isStereoscopicDirectStream(stream: DirectStreamRankInput): boolean;
export declare function directStreamPickScore(stream: DirectStreamRankInput): number;
export declare function rankDirectStreams<T extends DirectStreamRankInput>(streams: T[]): T[];
export declare function pickBestDirectStream<T extends DirectStreamRankInput>(streams: T[]): T | null;
export declare function rankDirectMovieStreamsForPlayback<T extends DirectStreamRankInput & {
    cached?: boolean;
    size?: number | string;
}>(streams: T[]): T[];
export declare function rankDirectMovieStreams<T extends DirectStreamRankInput>(streams: T[]): T[];
export declare function pickBestDirectMovieStream<T extends DirectStreamRankInput>(streams: T[]): T | null;
