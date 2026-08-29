/**
 * Movi Element Module
 *
 * Provides the custom HTML element wrapper for Movi Player.
 * This is the complete bundle including UI controls and gestures.
 *
 * Usage:
 * ```typescript
 * import { MoviElement } from 'movi/element';
 * // or just use <movi-player> in HTML
 * ```
 *
 * HTML Usage:
 * ```html
 * <movi-player src="video.mp4" controls autoplay></movi-player>
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
export { EncryptedHttpSource } from './source/EncryptedHttpSource';
export type { EncryptedSourceConfig } from './source/EncryptedHttpSource';
export { generateFingerprint } from './utils/Fingerprint';

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

// Player
export { MoviPlayer } from './core/MoviPlayer';

// Main export: MoviElement (custom HTML element)
export { MoviElement } from './render/MoviElement';
import type { MoviElement as MoviElementType } from './render/MoviElement';

// QoE analytics — versioned event stream + pluggable sinks.
export {
  QoECollector,
  beaconSink,
  QOE_SCHEMA_VERSION,
} from './utils/QoE';
export type { QoEEvent, QoESink, QoESession } from './utils/QoE';

/**
 * The documented `<movi-player>` attribute surface. Kept as a flat string/
 * boolean map so it can back both the HTMLElementTagNameMap typing and the
 * framework wrappers. Any attribute may also be set as a property on the
 * element instance (see MoviElement).
 */
export interface MoviPlayerAttributes {
  src?: string;
  poster?: string;
  postertime?: string;
  controls?: boolean | "";
  autoplay?: boolean | "";
  loop?: boolean | "";
  muted?: boolean | "";
  /** Play inline (don't auto-fullscreen on iOS). On any touch device, touch
   *  gestures (swipe-seek / volume) are suppressed while inline so they don't
   *  fight the page's scroll; fullscreen gestures are unaffected. Replaces
   *  `gesturefs`. */
  playsinline?: boolean | "";
  preload?: "none" | "metadata" | "auto";
  volume?: number | string;
  playbackrate?: number | string;
  theme?: "dark" | "light";
  themecolor?: string;
  title?: string;
  headers?: string;
  crossorigin?: "anonymous" | "use-credentials";
  vr?: string;
  vrpad?: boolean | "";
  audioonly?: boolean | "";
  audiooutput?: string;
  stablevolume?: boolean | "";
  ambientmode?: boolean | "";
  resume?: boolean | "";
  drm?: string;
  licenseurl?: string;
  encrypted?: boolean | "";
  lcevc?: boolean | "";
  lcevcurl?: string;
}

declare global {
  interface HTMLElementTagNameMap {
    // `document.querySelector('movi-player')` is now typed as the element.
    "movi-player": MoviElementType;
  }
}
