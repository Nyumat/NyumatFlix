/**
 * Compat entry — web component + stream/native wrappers without eager WASM.
 * MKV/WebCodecs sources require the full `movi-player` bundle.
 */

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
  PresentationMode,
  DecoderType,
  PlayerConfig,
  MediaInfo,
  PlayerState,
  PlayerEventMap,
  ExternalQualityEntry,
  ChapterMarker,
  PlayerErrorInfo,
} from "./types";

export { Logger, LogLevel } from "./utils/Logger";
export { EventEmitter } from "./events/EventEmitter";
export { MoviPlayer } from "./core/MoviPlayer";
export { MoviElement } from "./render/MoviElement";
export {
  resolvePresentationMode,
  isAdaptiveStreamUrl,
  isProgressiveNativeUrl,
} from "./core/presentation";

import { MoviElement } from "./render/MoviElement";

if (typeof customElements !== "undefined" && !customElements.get("movi-player")) {
  customElements.define("movi-player", MoviElement);
}
