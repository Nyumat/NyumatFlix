/**
 * Movi Demuxer & Decoder Module
 *
 * Provides media file parsing, packet extraction, and decoding functionality.
 * This module can be used independently for metadata extraction, demuxing, and decoding.
 *
 * Usage:
 * ```typescript
 * import { Demuxer, HttpSource, MoviVideoDecoder } from 'movi/demuxer';
 * const source = HttpSource('video.mp4');
 * const demuxer = new Demuxer(source);
 * await demuxer.open();
 *
 * const decoder = new MoviVideoDecoder();
 * await decoder.configure(videoTrack);
 * ```
 */

// Core Types
export type {
  Track,
  TrackType,
  VideoTrack,
  AudioTrack,
  SubtitleTrack,
  SubtitleCue,
  SourceConfig,
  CacheConfig,
  RendererType,
  DecoderType,
  PlayerConfig,
  MediaInfo,
  VideoDecoderConfig,
  AudioDecoderConfig,
  Packet,
  DecodedVideoFrame,
  DecodedAudioFrame,
  PlayerState,
  PlayerEventMap,
} from "./types";

// Utilities
export { Logger, LogLevel } from "./utils/Logger";
export { Time, TIME_BASE } from "./utils/Time";
export {
  ThumbnailRenderer,
  type ThumbnailRenderOptions,
} from "./utils/ThumbnailRenderer";

// Events
export { EventEmitter } from "./events/EventEmitter";

// WASM bindings (singleton pattern)
export {
  WasmBindings,
  ThumbnailBindings,
  type DataSource,
} from "./wasm/bindings";
export {
  loadWasmModule,
  loadWasmModuleNew,
  getWasmModule,
  isWasmModuleLoaded,
} from "./wasm/FFmpegLoader";
export type { MoviWasmModule, StreamInfo, PacketInfo } from "./wasm/types";

// Source adapters (required for Demuxer)
export type { SourceAdapter } from "./source/SourceAdapter";
export { HttpSource, createHttpSource } from "./source/HttpSource";
export { FileSource, createFileSource } from "./source/FileSource";
export {
  ThumbnailHttpSource,
  createThumbnailHttpSource,
} from "./source/ThumbnailHttpSource";

// Decoders
export { MoviVideoDecoder } from "./decode/VideoDecoder";
export { MoviAudioDecoder } from "./decode/AudioDecoder";
export { SubtitleDecoder } from "./decode/SubtitleDecoder";
export { SoftwareVideoDecoder } from "./decode/SoftwareVideoDecoder";
export { SoftwareAudioDecoder } from "./decode/SoftwareAudioDecoder";
export { CodecParser } from "./decode/CodecParser";

// Cache (useful for advanced usage)
export { LRUCache } from "./cache/LRUCache";

// Main export: Demuxer
export { Demuxer } from "./demux/Demuxer";
