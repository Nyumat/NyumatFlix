/**
 * Movi Player Module
 *
 * Provides full playback orchestration including demuxing, decoding, and rendering.
 * This module includes everything needed for programmatic video playback control.
 *
 * Usage:
 * ```typescript
 * import { MoviPlayer } from 'movi/player';
 * const player = new MoviPlayer({
 *   source: { type: 'url', url: 'video.mp4' },
 *   renderer: 'canvas',
 *   canvas: document.querySelector('canvas'),
 * });
 * await player.load();
 * await player.play();
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
} from './types';

// Utilities
export { Logger, LogLevel } from './utils/Logger';
export { Time, TIME_BASE } from './utils/Time';

// Events
export { EventEmitter } from './events/EventEmitter';

// WASM bindings (singleton pattern)
export { WasmBindings, ThumbnailBindings, type DataSource } from './wasm/bindings';
export { loadWasmModule, loadWasmModuleNew, getWasmModule, isWasmModuleLoaded } from './wasm/FFmpegLoader';
export type { MoviWasmModule, StreamInfo, PacketInfo } from './wasm/types';

// Source adapters
export type { SourceAdapter } from './source/SourceAdapter';
export { HttpSource, createHttpSource } from './source/HttpSource';
export { FileSource, createFileSource } from './source/FileSource';
export { ThumbnailHttpSource, createThumbnailHttpSource } from './source/ThumbnailHttpSource';

// Cache
export { LRUCache } from './cache/LRUCache';

// Demuxer
export { Demuxer } from './demux/Demuxer';

// Decoders
export { MoviVideoDecoder } from './decode/VideoDecoder';
export { MoviAudioDecoder } from './decode/AudioDecoder';
export { SubtitleDecoder } from './decode/SubtitleDecoder';

// Renderers
export { CanvasRenderer } from './render/CanvasRenderer';
export { AudioRenderer } from './render/AudioRenderer';

// Core components
export { TrackManager } from './core/TrackManager';
export { Clock } from './core/Clock';
export { PlayerStateManager } from './core/PlayerState';
export { PlaybackController } from './core/PlaybackController';

// Main export: MoviPlayer
export { MoviPlayer } from './core/MoviPlayer';
