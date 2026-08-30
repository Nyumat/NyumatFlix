/**
 * MoviPlayer - Main public API for the streaming video library
 */

import type {
  PlayerConfig,
  SourceConfig,
  Track,
  PlayerState,
  PlayerEventMap,
  MediaInfo,
  VideoTrack,
  AudioTrack,
  AudioSourceEntry,
  SubtitleTrack,
  SubtitleSourceEntry,
  SubtitleCue,
  Packet,
  PresentationMode,
  ExternalQualityEntry,
  ChapterMarker,
} from "../types";
import { getExternalSubtitleId } from "../types";
import { EventEmitter } from "../events/EventEmitter";
import {
  HttpSource,
  FileSource,
  ThumbnailHttpSource,
  EncryptedHttpSource,
  analyzeDashFallback,
  type SourceAdapter,
} from "../source";
import { LRUCache } from "../cache";
import { Demuxer } from "../demux";
import { TrackManager } from "./TrackManager";
import { Clock } from "./Clock";
import { PlayerStateManager } from "./PlayerState";
import { Logger, LogLevel } from "../utils/Logger";
import { MoviVideoDecoder } from "../decode/VideoDecoder";
import { MoviAudioDecoder } from "../decode/AudioDecoder";
import { SubtitleDecoder } from "../decode/SubtitleDecoder";
import { CanvasRenderer, type VRView } from "../render/CanvasRenderer";
import { AudioRenderer } from "../render/AudioRenderer";
import { updateAllBindingsLogLevel, ThumbnailBindings } from "../wasm/bindings";
import { loadWasmModuleNew } from "../wasm/FFmpegLoader";
import { ShakaPlayerWrapper } from "../render/ShakaPlayerWrapper";
import { HLSPlayerWrapper } from "../render/HLSPlayerWrapper";
import { DASHPlayerWrapper } from "../render/DASHPlayerWrapper";
import { ProgressiveVideoWrapper } from "../render/ProgressiveVideoWrapper";
import { ThumbnailRenderer } from "../utils/ThumbnailRenderer";
import {
  isProgressiveNativeUrl,
  resolvePresentationMode,
  shouldPreferHlsJs,
  shouldPreferNativeHls,
} from "./presentation";

// Any of the three adaptive-streaming engines (Shaka primary; hls.js / dash.js
// as fallbacks). They share the same surface; the Shaka-only extras (isLive,
// thumbnails, …) are called through optional chaining where used.
type StreamWrapper =
  | ShakaPlayerWrapper
  | HLSPlayerWrapper
  | DASHPlayerWrapper
  | ProgressiveVideoWrapper;

const TAG = "MoviPlayer";

export class MoviPlayer extends EventEmitter<PlayerEventMap> {
  // One-shot UA classification: mobile devices get the same conservative
  // decode/render budgets as 4K+ desktop, since mobile GPUs and Chrome's
  // AV1 hardware whitelist make the heavy path unaffordable at any res.
  // Memoized at class level so we don't re-parse navigator.userAgent in
  // every demux loop tick.
  private static readonly _isMobileDevice: boolean = (() => {
    if (typeof navigator === "undefined") return false;
    const uaData = (navigator as any)?.userAgentData;
    if (uaData?.mobile === true) return true;
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPod|Mobile|Opera Mini|IEMobile|BlackBerry/i.test(ua)) return true;
    // iPadOS 13+ reports as Mac — disambiguate via touch points
    if (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;
    return false;
  })();

  private config: PlayerConfig;
  private source: SourceAdapter | null = null;
  private cache: LRUCache;
  private demuxer: Demuxer | null = null;

  // Separate audio source — uses native <audio> element (zero WASM overhead)
  private nativeAudioEl: HTMLAudioElement | null = null;
  // When custom media headers are set, the native <audio> can't send them, so
  // we fetch the file ourselves and feed it a blob: URL. Track the logical
  // (pre-blob) URL for same-source detection and the object URL for revocation.
  private _nativeAudioObjectUrl: string | null = null;
  private _nativeAudioLogicalUrl: string | null = null;
  // Set when autoplay-with-sound was blocked for the native <audio> track and we
  // fell back to muted playback. Surfaces via isAudioBlockedSuspended() so the
  // element shows the "Tap to unmute" pill (mirrors the WebAudio path). Cleared
  // on a successful unmuted play or when the user unmutes.
  private _nativeAudioAutoplayBlocked: boolean = false;
  private _audioTracks: AudioSourceEntry[] = [];
  private _activeAudioLang: string = "";

  // External subtitle tracks (VTT/SRT)
  private _subtitleTracks: SubtitleSourceEntry[] = [];
  private _activeExternalSubtitleId: string = "";
  private _externalSubCues: SubtitleCue[] = [];
  private _externalSubTimer: number | null = null;
  public trackManager: TrackManager;
  private clock: Clock;
  private stateManager: PlayerStateManager;
  private mediaInfo: MediaInfo | null = null;
  private fileSize: number = -1; // Cached file size for buffer calculations
  private lastBufferedTime: number = 0;
  private streamTrackHandlerUnsubs: Array<() => void> = [];

  /**
   * Enable/disable seek-bar scrub previews on an already-constructed player.
   * Lets the `thumb` attribute be toggled at runtime (or applied after `src`,
   * whose callback creates the player first) without recreating the player.
   * The thumbnail pipeline stays lazy — it only spins up on the first hover.
   */
  setPreviewsEnabled(enabled: boolean): void {
    this.config.enablePreviews = enabled;
    // Turning previews back on clears the "gave up" latch so a prior failed
    // init (or a never-attempted one) can retry on the next hover.
    if (enabled) this.previewInitGaveUp = false;
  }

  private previewsAllowed(): boolean {
    if (!this.config.enablePreviews) return false;
    // Non-range sources keep previews ON: the thumbnail source borrows frames
    // straight from the main source's RAM window (no network), so previews work
    // for any position inside the buffered/seekable range.
    // NOTE: a file-size cap used to live here — the seek-bar thumbnail
    // pipeline opens a SECOND isolated WASM module + FFmpeg context, and on
    // large 1 GB+ sources the two heaps can exhaust the tab's memory budget,
    // making a later memory.grow() fail and trapping FFmpeg with "memory
    // access out of bounds" mid-playback. The cap was removed deliberately to
    // allow previews on big files; if OOM crashes resurface on large 4K
    // sources, reinstating a size gate here is the first thing to try.
    // No real video stream → nothing to scrub. Skipping here keeps
    // audio-only sources from opening a useless second WASM context
    // (the cover-art extractor already spins up its own short-lived one).
    if (this.trackManager.getVideoTracks().length === 0) return false;
    return true;
  }

  private wireStreamWrapper(wrapper: StreamWrapper): void {
    const events = [
      "loadStart", "loadEnd", "timeUpdate",
      "durationChange", "stateChange", "error", "seeking", "seeked",
      "waiting", "playing",
    ] as const;
    events.forEach((evt) => {
      wrapper.on(evt, (arg: unknown) => {
        this.emit(evt, arg as never);
      });
    });
    if ("trackManager" in wrapper && wrapper.trackManager) {
      wrapper.trackManager.on("tracksChange", (tracks: Track[]) => {
        this.trackManager.setTracks(tracks);
      });
    }
  }

  // Decoders and Renderers
  private videoDecoder: MoviVideoDecoder;
  private audioDecoder: MoviAudioDecoder;
  private subtitleDecoder: SubtitleDecoder | null = null;
  private videoRenderer: CanvasRenderer | null = null;

  // Stream id of the subtitle track whose entire cue list has already been
  // prefetched into the renderer cache. Used to avoid scanning twice when
  // the user nudges the delay value while the same track is active.
  private prefetchedSubtitleStream: number | null = null;
  private prefetchInFlight: boolean = false;
  private _nativeSubtitleDelay = 0;

  // Embedded cover art (ID3v2 APIC, FLAC PICTURE, MP4 covr, MKV attachment).
  // Extracted once at load time when the demuxer reports an attached_pic
  // pseudo-stream; null for plain video files or audio without artwork.
  private coverArt: ImageBitmap | null = null;

  // Active adaptive-streaming / progressive-native wrapper.
  private streamWrapper: StreamWrapper | null = null;
  private presentationMode: PresentationMode = "canvas";
  private externalQualities: ExternalQualityEntry[] = [];
  private externalChapterMarkers: ChapterMarker[] = [];

  // Preview pipeline (C-based FFmpeg software decoding)
  private thumbnailBindings: ThumbnailBindings | null = null;
  private thumbnailSource: SourceAdapter | null = null;
  private thumbnailRenderer: ThumbnailRenderer | null = null;
  private thumbnailHDREnabled: boolean = true; // HDR enabled by default
  private isPreviewGenerating: boolean = false;
  private audioRenderer: AudioRenderer;
  private previewInitPromise: Promise<void> | null = null; // Guard for preview initialization
  private previewInitAttempts: number = 0; // Bounded retries for preview pipeline init
  private previewInitGaveUp: boolean = false; // Stop retrying once init has failed too often

  // Debug flag to disable audio processing
  private disableAudio: boolean = false; // Set to true to disable audio for debugging
  // Audio-only mode (data-saver): skip video decoding to save CPU (the
  // demuxer still reads the interleaved bytes, but decode is the expensive
  // part); for adaptive streams the wrapper also drops the video renditions to
  // save bandwidth. The UI switches to the album-art / strip surface.
  private _audioOnly: boolean = false;
  private muted: boolean = false; // Mute state
  private wasPlayingBeforeRebuffer: boolean = false; // Track if we were playing before entering rebuffering state
  private _stallStartTime: number = 0; // When stall was first detected
  private _bufferingEntryTime: number = 0; // When we entered buffering state
  private _playStartTime: number = 0; // When play() was called — grace period for stall detection
  private _primingAudio = false; // true while the first-play buffer is filling its startup cushion
  private _decoderStuckSince: number = 0; // When video decoder was first detected stuck
  private _lastDesyncSeekTime: number = 0; // performance.now() of last desync-triggered resync

  // Playback Loop
  private animationFrameId: number | null = null;
  private backgroundIntervalId: number | null = null;
  private backgroundWorker: Worker | null = null; // Worker-based timer for Safari
  private isBackgrounded: boolean = false; // True when tab is hidden (background)

  // WakeLock to prevent screen sleep during playback
  private wakeLock: WakeLockSentinel | null = null;

  // Seek state - track if we need to skip to keyframe after seek
  private seekingToKeyframe: boolean = false;
  private seekingToKeyframeStartTime: number = 0;
  private static readonly KEYFRAME_SEEK_TIMEOUT = 5000; // 5 seconds timeout
  // After a seek we prefer a true IDR to restart cleanly (avoids the open-GOP
  // CRA-as-key HW rejection on mixed-keyframe HEVC). But some streams only have
  // CRA keyframes for long stretches (e.g. seeking deep into a DoVi P8 .ts whose
  // sole IDR is at the file start), so if no IDR shows up within this short
  // window we fall back to resuming on a CRA rather than staying black.
  private seekCraSeen: number = 0;
  private static readonly SEEK_IDR_WAIT_MS = 400; // wait this long for an IDR before accepting a CRA

  // Set when an audio-starve video skip drops a non-keyframe, breaking AV1's
  // reference chain. While true the demux loop keeps dropping deltas until the
  // next keyframe (even after the starve clears) so no orphaned delta ever
  // reaches the decoder — that orphan is what throws EncodingError. Cleared on
  // the next keyframe, which rebuilds the chain. See the demux loop.
  private videoChainBrokenUntilKeyframe: boolean = false;

  // Prebuffer targets — accumulate this much before reporting "ready" so
  // play() doesn't immediately stall on short videos where the demux burst
  // outruns the HTTP stream.
  private static readonly PREBUFFER_AUDIO_SECONDS = 0.5;
  private static readonly PREBUFFER_VIDEO_FRAMES = 2;
  private static readonly PREBUFFER_MAX_WALL_MS = 5000;
  private static readonly PREBUFFER_MAX_PACKETS = 400;

  // Seek target time - skip packets before this time to ensure accurate seeking
  // When seeking, FFmpeg seeks to the nearest keyframe BEFORE the target time
  // We need to decode but not display/play packets before the target time
  private seekTargetTime: number = -1;

  // Buffer audio packets while waiting for video to catch up after seek
  private waitingForVideoSync: boolean = false;
  private pendingAudioPackets: Array<{
    data: Uint8Array;
    timestamp: number;
    keyframe: boolean;
  }> = [];

  // Packets read during prebuffer — stashed unmodified so that normal
  // playback consumes them before resuming demux. We cannot decode during
  // prebuffer because (a) video frames would be dropped by the "playing"
  // state gate in setOnFrame and (b) the audio renderer eagerly schedules
  // buffers on AudioContext which would start audio playback early.
  private pendingPrebufferPackets: Packet[] = [];

  // Post-seek throttling to prevent stuttering on low-end devices
  private justSeeked: boolean = false;
  private seekTime: number = 0;
  private startTime: number = 0; // Media start time (PTS offset)
  // Per-seek "keyframe jump" offset. FFmpeg lands on the nearest keyframe
  // at-or-after the seek target, which on long-GOP containers (.ts mainly)
  // can be seconds beyond what the user asked for. Reporting the raw time
  // then makes the timeline jump from 0:00 → 0:02 right after a seek to 0.
  // Track the gap and subtract it from getCurrentTime() so the UI stays
  // pinned to what the user requested. Reset on every new seek.
  private seekKeyframeOffset: number = 0;
  private static readonly POST_SEEK_THROTTLE_MS = 1000; // Throttle aggressive buffering for 1000ms after seek to stabilize playback

  // Pause-time buffering: continue demuxing while paused so seek within buffered
  // area is instant and playback resumes without stall (like YouTube).
  // YouTube buffers ~2-5 minutes ahead while paused, then stops.
  private pauseBufferTimerId: number | null = null;
  private static readonly PAUSE_BUFFER_INTERVAL_MS = 100; // Demux every 100ms while paused
  private static readonly PAUSE_BUFFER_MAX_PACKETS = 3000; // Safety cap on packet count
  private static readonly PAUSE_BUFFER_AUDIO_SECONDS = 180; // ~3 minutes audio ahead (YouTube-like)
  private static readonly PAUSE_BUFFER_VIDEO_FRAMES = 5400; // ~3 minutes @ 30fps

  constructor(config: PlayerConfig) {
    super();

    this.config = config;
    this.presentationMode = resolvePresentationMode(config);
    this.config.presentation = this.presentationMode;
    this._audioOnly = !!config.audioOnly;
    this.cache = new LRUCache(config.cache?.maxSizeMB ?? 100);
    this.trackManager = new TrackManager();
    this.clock = new Clock();
    this.stateManager = new PlayerStateManager();

    // Disable FFmpeg logs by default
    updateAllBindingsLogLevel(LogLevel.SILENT);

    // Initialize components
    this.audioDecoder = new MoviAudioDecoder();
    this.audioRenderer = new AudioRenderer();
    this.subtitleDecoder = new SubtitleDecoder();

    // Initialize video renderer with canvas (WebCodecs)
    // Note: MSE mode is handled by MSEPlayerWrapper
    // Check if software decoding is forced via config
    const forceSoftware = config.decoder === "software";

    if (config.canvas || config.renderer === "canvas") {
      if (config.canvas) {
        // Use canvas with WebCodecs (or WASM software if forced)
        this.videoDecoder = new MoviVideoDecoder(forceSoftware);
        this.videoRenderer = new CanvasRenderer(config.canvas);

        // Connect video renderer to audio clock for A/V sync (skip if audio disabled)
        if (!this.disableAudio) {
          this.videoRenderer.setAudioTimeProvider(
            () => this.audioRenderer.getAudioClock(),
            () => this.audioRenderer.hasHealthyBuffer(),
          );
        } else {
          // When audio is disabled, video runs independently without A/V sync overhead
          this.videoRenderer.setAudioTimeProvider(null, null);
          Logger.info(
            TAG,
            "Video renderer running independently (audio disabled)",
          );
        }

        Logger.info(
          TAG,
          `Video renderer initialized with canvas (forceSoftware: ${forceSoftware})`,
        );
      } else {
        Logger.warn(
          TAG,
          "Canvas renderer requested but no canvas element provided",
        );
        this.videoDecoder = new MoviVideoDecoder(forceSoftware);
      }
    } else {
      // Default to software decoding with WebCodecs (no target element)
      this.videoDecoder = new MoviVideoDecoder(forceSoftware);
      Logger.info(
        TAG,
        "Video renderer initialized with default (WebCodecs decoder only)",
      );
    }

    // Connect audio as the master clock provider (skip if audio disabled)
    if (!this.disableAudio) {
      this.clock.setAudioProvider(this.audioRenderer);
    } else {
      // When audio is disabled, clock runs independently without audio sync overhead
      this.clock.setAudioProvider(null);
      Logger.info(TAG, "Clock running independently (audio disabled)");
    }

    // Setup decoder outputs
    if (this.videoDecoder) {
      this.videoDecoder.setOnFrame((frame) => {
        // Background mode: drop video frames silently (audio keeps playing)
        // But keep frames if PiP is active (canvas is visible in PiP window)
        if (document.hidden && !this.isPiPActive) {
          frame.close();
          return;
        }

        // Queue frames for smooth presentation with A/V sync
        // Allow processing if playing OR if we are seeking (waiting for sync)
        if (
          this.videoRenderer &&
          (this.stateManager.getState() === "playing" ||
            this.waitingForVideoSync)
        ) {
          // IMPORTANT: Drop video frames before the seek target time
          // These frames are decoded to build decoder state (reference frames),
          // but we don't display them - we want accurate seeking to the target time
          const frameTime = frame.timestamp / 1_000_000; // Convert to seconds
          // CRITICAL: Check seekTargetTime !== -1 instead of >= 0 to support negative start times
          // Some media files have negative PTS offsets (e.g., startTime = -0.105s)
          if (this.seekTargetTime !== -1 && frameTime < this.seekTargetTime) {
            // Drop this frame, it's before our target time
            frame.close();
            return;
          }

          // Video reached target! If a seek is awaiting sync, fire the
          // completion path. Otherwise the guard was set in filter-only
          // mode (first-play / post-prefetch resume) just to drop pre-target
          // frames produced by Open-GOP recovery — we just clear the guard
          // so subsequent frames flow through without re-entering this
          // branch (which would log a warn-spam every frame).
          if (this.seekTargetTime !== -1) {
            if (this.waitingForVideoSync) {
              Logger.debug(TAG, `onFrame: frameTime=${frameTime.toFixed(3)}s >= seekTargetTime=${this.seekTargetTime.toFixed(3)}s, calling notifySeekCompletion`);
              this.notifySeekCompletion(frameTime);
            } else {
              this.seekTargetTime = -1;
            }
          }

          this.videoRenderer.queueFrame(frame);
        } else {
          frame.close();
        }
      });

      this.videoDecoder.setOnError((error) => {
        Logger.error(TAG, "Video decoder error", error);
        this.emit("error", error);
        // Note: Decoder now has built-in recovery, only pauses after MAX_ERRORS
      });

      // When the decoder enters its "skip non-keyframes until next IDR" recovery
      // during normal playback (decode-error recreate, e.g. high-bitrate 1080p
      // H.264 whose HW decoder throws an EncodingError on an IDR), we deliberately
      // do NOT flip into buffering. Per request: the clock and audio keep running
      // and the video simply holds its last frame until the next keyframe lands
      // (~1 GOP), then A/V sync catches the video up with a jump. The stall
      // detector is already suppressed across this window via
      // videoDecoder.isRecentlyRecovering(), so the empty video queue here is not
      // mistaken for a stall. Seeks are handled by the seek pipeline (suppressed
      // here via the state/sync guard).
      this.videoDecoder.onKeyframeWaitChange = (waiting) => {
        const state = this.stateManager.getState();
        if (state === "seeking" || this.waitingForVideoSync) return;
        if (waiting && state === "playing") {
          Logger.debug(
            TAG,
            "Decoder waiting for keyframe mid-playback — staying in playing (audio/clock continue, video holds until next keyframe)",
          );
        }
      };
    }

    this.audioDecoder.setOnData((data) => {
      // WebCodecs / hardware path: AudioData lands here.
      this.audioRenderer.render(data);
    });

    this.audioDecoder.setOnPCM((frame) => {
      // Software path (FFmpeg/WASM) emits planar Float32 PCM so we avoid
      // the WebCodecs AudioData constructor — which Firefox on Android
      // doesn't implement.
      this.audioRenderer.renderPCM(frame);
    });

    this.audioDecoder.setOnError((error) => {
      Logger.error(TAG, "Audio decoder error", error);
      // Audio errors are less fatal - video can continue, just emit the error
      this.emit("error", error);
    });

    // Forward state changes
    this.stateManager.on("change", (state) => {
      this.emit("stateChange", state);
    });

    // Forward track changes
    // Listen for audio track changes and immediately reconfigure decoder
    this.trackManager.on("audioTrackChange", async (track) => {
      if (!track) {
        Logger.warn(TAG, "Audio track change event received but track is null");
        return;
      }

      Logger.info(
        TAG,
        `Audio track changed to track ${track.id}, reconfiguring decoder`,
      );

      // Close current audio decoder immediately
      if (this.audioDecoder) {
        this.audioDecoder.close();
      }

      // Recreate audio decoder for new track
      this.audioDecoder = new MoviAudioDecoder();

      // Set bindings
      if (this.demuxer) {
        const bindings = this.demuxer.getBindings();
        if (bindings) {
          this.audioDecoder.setBindings(bindings);
        }
      }

      this.audioDecoder.setOnData((data) => {
        this.audioRenderer.render(data);
      });

      this.audioDecoder.setOnPCM((frame) => {
        this.audioRenderer.renderPCM(frame);
      });

      this.audioDecoder.setOnError((error) => {
        Logger.error(TAG, "Audio decoder error", error);
        // Audio errors are less fatal - video can continue, just emit the error
        this.emit("error", error);
      });

      // Configure decoder for new track
      if (this.demuxer && !this.disableAudio) {
        const extradata = this.demuxer.getExtradata(track.id) ?? undefined;
        const configured = await this.audioDecoder.configure(track, extradata);
        if (configured) {
          Logger.info(
            TAG,
            `Audio decoder reconfigured for track ${track.id}: ${track.codec} ${track.sampleRate}Hz ${track.channels}ch`,
          );
          // Re-evaluate the multichannel passthrough policy on every
          // track change — switching from 7.1 TrueHD to stereo AAC
          // (or vice versa) needs the destination channelCount and
          // the WASM downmix flag to follow the new track. The
          // AudioRenderer was already initialised before the first
          // track configure landed, so reading max channels here is
          // cheap and sync.
          const sourceCh = track.channels ?? 2;
          const maxCh = this.audioRenderer.getMaxChannelCount();
          if (sourceCh > 2 && maxCh >= sourceCh) {
            this.audioDecoder.setDownmix(false);
            this.audioRenderer.setOutputChannelCount(sourceCh);
          } else {
            this.audioDecoder.setDownmix(true);
            this.audioRenderer.setOutputChannelCount(2);
          }
        } else {
          Logger.warn(
            TAG,
            `Failed to reconfigure audio decoder for track ${track.id}`,
          );
        }
      }

      // Re-apply demuxer discard: re-enable the newly-selected audio track and
      // discard the previously-active one (issue #11).
      this.applyStreamDiscard();
    });

    this.trackManager.on("tracksChange", (tracks) => {
      this.emit("tracksChange", tracks);
    });

    Logger.info(TAG, "Player created");

    // Handle visibility changes to re-acquire WakeLock if lost
    document.addEventListener("visibilitychange", this.handleVisibilityChange);

    // Handle network recovery: re-seek to current position to restart cleanly
    window.addEventListener("online", this.handleNetworkOnline);
  }

  /**
   * Load the media file
   */
  async load(sourceConfig?: SourceConfig): Promise<void> {
    if (!this.stateManager.is("idle") && !sourceConfig) {
      throw new Error("Player must be idle to load");
    }

    if (sourceConfig) {
      this.config.source = sourceConfig;
      // If we were not idle, we should essentially reset/destroy previous state if reusing instance
      // But for now, let's assume usage pattern respects idle check or we force reset
      if (this.stateManager.getState() !== "idle") {
        // Reset internal state if reloading on same instance
        // Ideally calls destroy() -> new MoviPlayer() is better, but here we can try to soft-reset
      }
    }

    this.stateManager.setState("loading");
    this.emit("loadStart", undefined);
    this.lastBufferedTime = 0;

    this.applyConfiguredSubtitleTracks();

    // Drop the previous source's cover art so a soft-reload on the same
    // instance (no destroy) doesn't keep showing stale artwork when the
    // new source has none.
    this.coverArt?.close?.();
    this.coverArt = null;

    // Clean up any existing preview pipeline
    this.destroyPreviewPipeline();

    // Adaptive streaming — only when the caller used SourceConfig (a custom
    // SourceAdapter bypasses URL detection entirely). HLS (.m3u8) and DASH
    // (.mpd) both go through Shaka Player (one engine, MSE under the hood). This
    // covers multiplexed DASH too — Shaka plays it natively, so there's no
    // FFmpeg fallback to fork on here.
    const src = this.config.source;
    const streamUrl =
      !this.config.sourceAdapter && src && src.type === "url" && src.url
        ? src.url
        : null;
    const lowerUrl = streamUrl?.toLowerCase() ?? "";
    // HLS (.m3u8), DASH (.mpd), and Smooth Streaming (.ism/.isml) all go
    // through Shaka. `.ism` also matches `.isml/manifest`.
    const isStream =
      !!streamUrl &&
      (lowerUrl.includes(".m3u8") ||
        lowerUrl.includes(".mpd") ||
        lowerUrl.includes(".ism"));

    const wireStreamTrackHandlers = (): void => {
      this.clearStreamTrackHandlers();
      this.streamTrackHandlerUnsubs.push(
        this.trackManager.on("videoTrackChange", (track) => {
          const w = this.streamWrapper;
          if (w && "selectVideoTrack" in w) {
            w.selectVideoTrack(track ? track.id : -1);
          }
        }),
        this.trackManager.on("audioTrackChange", (track) => {
          const w = this.streamWrapper;
          if (track && w && "selectAudioTrack" in w) {
            w.selectAudioTrack(track.id);
          }
        }),
        this.trackManager.on("subtitleTrackChange", (track) => {
          const w = this.streamWrapper;
          if (w && "selectSubtitleTrack" in w) {
            void w.selectSubtitleTrack(track ? track.id : null);
          }
        }),
      );
    };

    const finishStreamLoad = async (
      wrapper: StreamWrapper,
      label: string,
    ): Promise<boolean> => {
      this.streamWrapper = wrapper;
      this.wireStreamWrapper(wrapper);
      Logger.info(TAG, label);
      await wrapper.load();
      this.stateManager.setState("ready");
      return true;
    };

    if (
      streamUrl &&
      this.presentationMode === "native" &&
      isProgressiveNativeUrl(streamUrl)
    ) {
      wireStreamTrackHandlers();
      const progressive = new ProgressiveVideoWrapper(this.config);
      await finishStreamLoad(
        progressive,
        "Detected progressive URL, using native <video>",
      );
      return;
    }

    if (isStream) {
      const isHls = lowerUrl.includes(".m3u8");
      const isDash = lowerUrl.includes(".mpd");
      const kind = isHls ? "HLS" : lowerUrl.includes(".ism") ? "Smooth Streaming" : "DASH";
      wireStreamTrackHandlers();

      if (isHls && shouldPreferNativeHls(streamUrl)) {
        try {
          const hls = new HLSPlayerWrapper(this.config);
          await finishStreamLoad(hls, `Detected ${kind} stream, using native HLS`);
          return;
        } catch (eNativeHls) {
          Logger.warn(TAG, "Safari native HLS failed, falling back", eNativeHls);
          try { this.streamWrapper?.destroy(); } catch {}
          this.streamWrapper = null;
        }
      }

      if (isHls && shouldPreferHlsJs(streamUrl)) {
        try {
          const hls = new HLSPlayerWrapper(this.config);
          await finishStreamLoad(hls, `Detected ${kind} stream, using hls.js (Firefox)`);
          return;
        } catch (eHlsJs) {
          Logger.warn(TAG, "hls.js failed on Firefox, falling back to Shaka", eHlsJs);
          try { this.streamWrapper?.destroy(); } catch {}
          this.streamWrapper = null;
        }
      }

      try {
        const shaka = new ShakaPlayerWrapper(this.config);
        await finishStreamLoad(shaka, `Detected ${kind} stream, using ShakaPlayerWrapper`);
        return;
      } catch (eShaka) {
        Logger.warn(TAG, `Shaka failed on ${kind} stream`, eShaka);
        try { this.streamWrapper?.destroy(); } catch {}
        this.streamWrapper = null;

        if (isHls || isDash) {
          try {
            const fb = isHls
              ? new HLSPlayerWrapper(this.config)
              : new DASHPlayerWrapper(this.config);
            await finishStreamLoad(
              fb,
              `Shaka failed; retrying with ${isHls ? "hls.js" : "dash.js"}`,
            );
            return;
          } catch (eFallback) {
            Logger.warn(TAG, `${isHls ? "hls.js" : "dash.js"} fallback also failed`, eFallback);
            try { (this.streamWrapper as StreamWrapper | null)?.destroy(); } catch {}
            this.streamWrapper = null;
          }
        }

        let fellBack = false;
        if (isDash) {
          try {
            const plan = await analyzeDashFallback(streamUrl!, src?.headers);
            if (plan) {
              Logger.info(TAG, "Falling back to the FFmpeg demuxer");
              this.source = await this.createSource({
                type: "url",
                url: plan.videoUrl,
                headers: src?.headers,
              });
              if (plan.audioUrl) {
                this.config.audioSource = { type: "url", url: plan.audioUrl, headers: src?.headers };
              }
              fellBack = true;
            }
          } catch (eDemux) {
            Logger.warn(TAG, "FFmpeg DASH fallback failed", eDemux);
          }
        }
        if (!fellBack) {
          this.stateManager.setState("error");
          throw eShaka;
        }
      }
    }

    try {
      // Create source — honor a pre-built adapter if the caller supplied
      // one (custom protocol, encrypted blob, IndexedDB-backed source, etc.)
      // so the demuxer can read through it without going through SourceConfig.
      if (this.source) {
        // Already resolved (defensive — a prior load may have set it).
      } else if (this.config.sourceAdapter) {
        this.source = this.config.sourceAdapter;
      } else if (this.config.source) {
        this.source = await this.createSource(this.config.source);
      } else {
        throw new Error("Either config.source or config.sourceAdapter is required");
      }

      // Create demuxer (getSize will be called lazily in bindings.open())
      this.demuxer = new Demuxer(this.source, this.config.wasmBinary);

      // Open and get media info
      this.mediaInfo = await this.demuxer.open();

      // Cache file size for buffer calculations (getSize was called in bindings.open())
      this.fileSize = await this.source.getSize();

      const bindings = this.demuxer.getBindings();
      if (bindings) {
        this.videoDecoder.setBindings(bindings);
        this.audioDecoder.setBindings(bindings);
        if (this.subtitleDecoder) {
          this.subtitleDecoder.setBindings(bindings);
        }
      }

      // Separate audio source: use native <audio> element (zero WASM overhead)
      // Supports single audioSource or multi-language audioTracks
      let audioUrl: string | null = null;

      if (this.config.audioTracks && this.config.audioTracks.length > 0) {
        // Multi-language mode — store all tracks, pick first as default
        this._audioTracks = [...this.config.audioTracks];
        this._activeAudioLang = this._audioTracks[0].lang;
        audioUrl = this._audioTracks[0].url;
        Logger.info(TAG, `Multi-language audio: ${this._audioTracks.length} tracks, default=${this._activeAudioLang}`);
      } else if (this.config.audioSource?.type === "url" && this.config.audioSource.url) {
        // Single separate audio source
        audioUrl = this.config.audioSource.url;
      }

      if (audioUrl) {
        this.setupNativeAudio(audioUrl);
      }

      // Set tracks
      this.trackManager.setTracks(this.mediaInfo.tracks);

      // Extract embedded cover art (if any) once the track list is settled.
      // Fire-and-forget: a missing/corrupt artwork stream shouldn't block
      // playback. The eventual emit is what wakes the element-side painter,
      // so callers don't need to await this.
      void this.extractCoverArt();

      // Configure decoders for active tracks
      await this.configureDecoders();

      // Set duration on clock for clamping (prevents timer exceeding duration)
      // Clock operates in media time (PTS), so it runs from startTime to startTime + duration
      this.startTime = this.mediaInfo.startTime || 0;
      this.seekKeyframeOffset = 0;
      this.clock.setDuration(this.mediaInfo.duration + this.startTime);
      this.clock.seek(this.startTime);

      // Emit duration
      this.emit("durationChange", this.mediaInfo.duration);

      // Prebuffer a small amount of media so play() doesn't immediately
      // stall on short videos (see prebuffer() for details).
      await this.prebuffer();

      this.stateManager.setState("ready");
      this.emit("loadEnd", undefined);

      // Initialize preview pipeline in background (fire-and-forget).
      // Skipped only for sources with no video track — see previewsAllowed().
      if (this.previewsAllowed()) {
        // This makes the first preview faster since WASM is already loaded
        this.previewInitPromise = this.initPreviewPipeline().catch((e) => {
          Logger.warn(TAG, "Preview pipeline init failed (non-critical)", e);
          // Clear promise on error so we can retry later if needed
          this.previewInitPromise = null;
        });
      }

      Logger.info(
        TAG,
        `Loaded: duration=${this.mediaInfo.duration}s, tracks=${this.mediaInfo.tracks.length}`,
      );
    } catch (error) {
      this.stateManager.setState("error");
      this.emit("error", error as Error);
      throw error;
    }
  }

  /**
   * Create source adapter from config
   */
  private async createSource(config: SourceConfig): Promise<SourceAdapter> {
    if (config.type === "file" && config.file) {
      const fs = new FileSource(config.file, this.cache);
      fs.setOnRevoked((info) => {
        Logger.error(TAG, `File handle revoked: ${info.reason}`);
        this.emit("filerevoked", info);
      });
      fs.setOnPreloadComplete(() => {
        this.emit("preloadcomplete", undefined);
      });
      return fs;
    }

    if (config.type === "encrypted" && config.encrypted) {
      return new EncryptedHttpSource({
        ...config.encrypted,
        headers: config.headers,
      });
    }

    if (config.type === "url" && config.url) {
      const maxBufferSizeMB = this.config.cache?.maxSizeMB;
      const source = new HttpSource(
        config.url,
        config.headers,
        maxBufferSizeMB,
      );
      // Server has no Range support + file too big to cache → forward-only
      // linear playback. Surface it so the UI can drop the timeline / seeking.
      source.setOnLinearMode(() => this.emit("linearmode", undefined));
      return source;
    }

    throw new Error("Invalid source configuration");
  }

  /**
   * Configure decoders for active tracks
   */
  private async configureDecoders(): Promise<void> {
    if (!this.demuxer) return;

    // Configure video renderer/decoder
    const videoTrack = this.trackManager.getActiveVideoTrack();
    if (videoTrack && this.videoDecoder) {
      // Use WebCodecs - configure decoder
      const extradata = this.demuxer.getExtradata(videoTrack.id) ?? undefined;

      // Pass explicit frame rate override if present (for throttling)
      const targetFps = this.config.frameRate ?? 0;

      const configured = await this.videoDecoder.configure(
        videoTrack,
        extradata,
        targetFps,
      );
      if (configured) {
        Logger.info(
          TAG,
          `Video decoder configured: ${videoTrack.codec} ${videoTrack.width}x${videoTrack.height}`,
        );
        if (this.videoRenderer) {
          // Pass color space metadata for HDR detection and frame rate for 60fps conversion
          // Support manual frame rate override (fps parameter)
          const frameRate = this.config.frameRate || videoTrack.frameRate;

          this.videoRenderer.configure(
            videoTrack.width,
            videoTrack.height,
            videoTrack.colorPrimaries,
            videoTrack.colorTransfer,
            frameRate,
            videoTrack.rotation ?? 0,
            videoTrack.isHDR,
            videoTrack.pixelFormat,
          );
        }
      } else {
        Logger.warn(TAG, "Failed to configure video decoder");
      }
    }

    // Configure audio decoder (skip if disabled for debugging)
    // Configure audio decoder (skip if disabled for debugging or native audio)
    const audioTrack = this.trackManager.getActiveAudioTrack();
    if (audioTrack && !this.disableAudio) {
      const extradata = this.demuxer.getExtradata(audioTrack.id) ?? undefined;
      const configured = await this.audioDecoder.configure(
        audioTrack,
        extradata,
      );
      if (configured) {
        Logger.info(
          TAG,
          `Audio decoder configured: ${audioTrack.codec} ${audioTrack.sampleRate}Hz ${audioTrack.channels}ch`,
        );
        // Pre-initialize AudioContext during load (created suspended, no audio plays).
        // Moves ~500ms creation cost from play() to load() for instant playback start.
        // init() no longer resumes — play() handles resume on user gesture.
        if (!this.disableAudio) {
          // Await so we can read destination.maxChannelCount synchronously
          // before deciding the downmix policy. Init is cheap; the
          // perf-sensitive bit (`resume`) is still gated on the user
          // gesture in play().
          await this.audioRenderer.init();
          // Preserve native channel layout when the device can drive
          // every plane (e.g. 7.1 over HDMI / DAC reporting
          // maxChannelCount=8). Otherwise leave the WASM downmix on
          // — FFmpeg's matrix is higher quality than Web Audio's
          // automatic "speakers" interpretation fallback.
          const sourceCh = audioTrack.channels ?? 2;
          const maxCh = this.audioRenderer.getMaxChannelCount();
          if (sourceCh > 2 && maxCh >= sourceCh) {
            Logger.info(
              TAG,
              `Multichannel passthrough: source ${sourceCh}ch, destination supports ${maxCh}ch`,
            );
            this.audioDecoder.setDownmix(false);
            this.audioRenderer.setOutputChannelCount(sourceCh);
          } else if (sourceCh > 2) {
            Logger.info(
              TAG,
              `Downmixing to stereo: source ${sourceCh}ch, destination caps at ${maxCh}ch`,
            );
          }
        }
      } else {
        Logger.warn(TAG, "Failed to configure audio decoder");
      }
    } else if (audioTrack && this.disableAudio) {
      Logger.info(TAG, "Audio processing disabled for debugging");
    }

    // Drop unused audio tracks from the demuxer read path (issue #11).
    this.applyStreamDiscard();

    // Configure subtitle decoder
    const subtitleTrack = this.trackManager.getActiveSubtitleTrack();
    if (subtitleTrack && this.subtitleDecoder) {
      const extradata =
        this.demuxer.getExtradata(subtitleTrack.id) ?? undefined;
      const configured = await this.subtitleDecoder.configure(
        subtitleTrack,
        extradata,
      );
      if (configured) {
        Logger.info(
          TAG,
          `Subtitle decoder configured: ${subtitleTrack.codec} (${subtitleTrack.subtitleType || "unknown"} type)`,
        );

        // Set up subtitle cue callback
        this.subtitleDecoder.setOnCue((cue) => {
          Logger.debug(
            TAG,
            `Subtitle cue received: "${cue.text?.substring(0, 30)}..." (${cue.start.toFixed(2)}s - ${cue.end.toFixed(2)}s)`,
          );
          // Update subtitle cues on video renderer
          if (this.videoRenderer) {
            // Get current cues and add/update this one
            // For simplicity, we'll just set a single cue for now
            // In a full implementation, we'd maintain a cue list
            Logger.debug(TAG, "Setting subtitle cue on video renderer");
            this.videoRenderer.setSubtitleCues([cue]);
          } else {
            Logger.warn(
              TAG,
              "Subtitle cue received but videoRenderer is null!",
            );
          }
        });

        // Set bindings (should already be set in load(), but set again to be safe)
        const bindings = this.demuxer.getBindings();
        if (bindings) {
          this.subtitleDecoder.setBindings(bindings, false); // Don't auto-configure, we're configuring manually
        }
      } else {
        Logger.warn(
          TAG,
          `Failed to configure subtitle decoder for track ${subtitleTrack.id} (${subtitleTrack.codec}) - subtitles will not be displayed`,
        );
      }
    }
  }

  /**
   * Pre-read a small amount of media before reporting "ready" and stash the
   * packets for the normal demux loop to consume. On short videos the demux
   * burst can drain the file faster than the HTTP source delivers bytes,
   * tripping the stall detector the moment play() starts; reading ahead
   * gives the source layer more time to buffer bytes.
   *
   * We deliberately do NOT decode here — the video decoder's onFrame
   * callback drops frames whenever state !== "playing", and the audio
   * renderer starts AudioContext playback the moment samples arrive. Both
   * break if we decode during prebuffer.
   */
  /**
   * Native-audio-only playback (split-source data saver): audio-only mode AND a
   * separate <audio> track. There's no video pipeline to run, and the audio is
   * its own element, so the demuxer body is never read — only the header it
   * downloaded at open() — saving the video file's entire bandwidth on top of
   * the skipped decode. Drives playback straight off the <audio> element.
   */
  private nativeAudioOnlyPlayback(): boolean {
    return this._audioOnly && !!this.nativeAudioEl;
  }

  private async prebuffer(): Promise<void> {
    if (!this.demuxer) return;
    // Native-audio-only: nothing to prebuffer — reading video packets here would
    // start downloading the body we're trying to skip.
    if (this.nativeAudioOnlyPlayback()) return;

    const hasVideoTrack = !!this.trackManager.getActiveVideoTrack();
    const hasInFileAudio =
      !!this.trackManager.getActiveAudioTrack() &&
      !this.disableAudio &&
      !this.nativeAudioEl;

    if (!hasVideoTrack && !hasInFileAudio) return;

    const startWall = performance.now();
    let videoPacketsStashed = 0;
    let audioDurationStashed = 0;
    let eof = false;

    const videoTargetMet = () =>
      !hasVideoTrack ||
      videoPacketsStashed >= MoviPlayer.PREBUFFER_VIDEO_FRAMES;
    const audioTargetMet = () =>
      !hasInFileAudio ||
      audioDurationStashed >= MoviPlayer.PREBUFFER_AUDIO_SECONDS;

    while (
      (!videoTargetMet() || !audioTargetMet()) &&
      !eof &&
      this.pendingPrebufferPackets.length < MoviPlayer.PREBUFFER_MAX_PACKETS
    ) {
      if (performance.now() - startWall > MoviPlayer.PREBUFFER_MAX_WALL_MS) {
        Logger.warn(
          TAG,
          `Prebuffer wall-clock timeout after ${MoviPlayer.PREBUFFER_MAX_WALL_MS}ms`,
        );
        break;
      }

      let packet: Packet | null;
      try {
        packet = await this.demuxer.readPacket();
      } catch (err) {
        Logger.warn(TAG, "Prebuffer demux error, aborting prebuffer", err);
        break;
      }

      if (!packet) {
        eof = true;
        break;
      }

      this.pendingPrebufferPackets.push(packet);

      if (!this.trackManager.isActiveStream(packet.streamIndex)) continue;

      const activeVideo = this.trackManager.getActiveVideoTrack();
      const activeAudio = this.trackManager.getActiveAudioTrack();

      if (
        hasVideoTrack &&
        activeVideo &&
        activeVideo.id === packet.streamIndex
      ) {
        videoPacketsStashed++;
      } else if (
        hasInFileAudio &&
        activeAudio &&
        activeAudio.id === packet.streamIndex
      ) {
        audioDurationStashed += packet.duration > 0 ? packet.duration : 0.02;
      }
    }

    Logger.info(
      TAG,
      `Prebuffer complete: stashed=${this.pendingPrebufferPackets.length}, video=${videoPacketsStashed}, audio=${audioDurationStashed.toFixed(2)}s, eof=${eof}`,
    );
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (this.streamWrapper) {
      const streamState = this.streamWrapper.getState();
      if (streamState === "playing") {
        return;
      }
      if (streamState === "buffering" || streamState === "seeking") {
        this.wasPlayingBeforeRebuffer = true;
        Logger.info(
          TAG,
          `Play requested during ${streamState} — will resume when ready`,
        );
        return;
      }
      return this.streamWrapper.play();
    }

    // Stop pause-time buffering — we're resuming active playback
    this.stopPauseBuffering();

    if (!this.stateManager.canPlay()) {
      Logger.warn(TAG, "Cannot play in current state");
      return;
    }

    // Native-audio-only (split-source data saver): no demuxer/decode pipeline —
    // drive playback straight off the <audio> element so the video body is never
    // fetched. Handles first play, resume, and replay.
    if (this.nativeAudioOnlyPlayback()) {
      return this.playNativeAudioOnly();
    }

    const currentState = this.stateManager.getState();

    // During buffering or seeking, mark intent to resume when ready
    if (currentState === "buffering" || currentState === "seeking") {
      this.wasPlayingBeforeRebuffer = true;
      Logger.info(TAG, `Play requested during ${currentState} — will resume when ready`);
      return;
    }

    const wasEnded = currentState === "ended";

    // Replay path: delegate to seek(0). The full seek pipeline runs flush +
    // demuxer.seek + waitingForVideoSync + keyframe wait, and on first frame
    // notifySeekCompletion syncs the clock to the actual first decodable PTS
    // (matters for Open-GOP sources where the first ~2s have no usable IDR —
    // without this the clock advances from startTime while video stays
    // frozen, so EOF fires ~2s early and no buffering UI is shown). Setting
    // wasPlayingBeforeSeek after the await flips the resume path so the
    // seek completion transitions straight to "playing".
    if (wasEnded && this.demuxer) {
      Logger.debug(TAG, "Replaying from beginning after ended state");
      this.requestWakeLock();
      // Set the resume intent BEFORE awaiting seek(0). Replay data is always
      // already buffered, so notifySeekCompletion can fire synchronously
      // inside the await — if wasPlayingBeforeSeek is still false at that
      // point, seek completion takes the "paused" branch and replay stalls at
      // the first frame instead of resuming. seek() itself derives
      // wasPlayingBeforeSeek from the entry state ("ended" → false), which is
      // why we must force it true here up front rather than after the await.
      this.wasPlayingBeforeSeek = true;
      // Re-arm the play grace so the stall/desync detectors don't fire on the
      // replay-seek transient. Right after "Replaying from beginning" the video
      // renderer's currentTime is still stale at the ended position (~duration)
      // while audio resets to 0 — without a fresh grace the desync detector sees
      // a ~full-duration "behind" and kicks off a spurious resync seek (an
      // audible trip at the start of every replay).
      this._playStartTime = performance.now();
      // The replay seek(0) flushes the audio decoder like any seek, so heavy
      // software audio (TrueHD/DTS) re-primes automatically via the seek-resume
      // path — no separate first-play re-arm needed. Codec-gated, so
      // hardware/lightweight audio replays stay instant.
      try {
        await this.seek(0, { suppressSpinner: true });
        // The separate native <audio> track ended with the video; seek(0)
        // rewinds its currentTime but leaves it paused, so the replay plays
        // silent. Restart it here (the normal play() audio-resume block is
        // skipped on the wasEnded path). A manual replay is a user gesture so
        // this succeeds; an auto-loop restart that was never unmuted can still
        // be blocked — keep the muted-rolling flag so the unmute pill stays.
        if (this.nativeAudioEl && this.nativeAudioEl.paused) {
          this.nativeAudioEl.playbackRate = this.clock.getPlaybackRate();
          try {
            await this.nativeAudioEl.play();
            this._nativeAudioAutoplayBlocked = false;
          } catch (e) {
            this._nativeAudioAutoplayBlocked = true;
            Logger.warn(TAG, "Native audio replay blocked — rolling video muted", e);
          }
        }
      } catch (error) {
        this.suppressSeekSpinner = false;
        this.wasPlayingBeforeSeek = false;
        Logger.warn(TAG, "Failed to seek to start on replay", error);
      }
      return;
    }
    // If resuming from paused state, seek to current time to ensure demuxer is at correct position

    // Fire-and-forget WakeLock (no need to block play for screen sleep prevention)
    this.requestWakeLock();

    // First play after poster seek: re-seek demuxer to the clock's current
    // time. Poster seek's processLoop reads the demuxer ahead (~1s) while
    // decoding the first video frame, so the demuxer cursor is out of sync
    // with where we actually want playback to start. Re-seeking realigns it.
    //
    // IMPORTANT: respect any user seek that happened before the first play —
    // read the target from the clock (which getTime() reports as paused or
    // seeked position), NOT the hardcoded startTime. Previously we always
    // seeked to startTime here, which silently discarded a pre-play scrub
    // and restarted from the beginning.
    // Guard: only treat this as the first play when the clock is still parked
    // at the start. _playStartTime is the primary signal, but if anything ever
    // leaves it at 0 mid-session, this stops the first-play seek(0) from
    // dragging an in-progress video (clock well past startTime) back to zero.
    const atStart =
      this.clock.getTime() <= this.startTime + 1;
    if (
      this._playStartTime === 0 &&
      atStart &&
      this.demuxer &&
      !this.nativeAudioEl
    ) {
      // First play: always seek to 0. The poster seek's processLoop reads the
      // demuxer ~1s ahead while decoding the first video frame, so the cursor
      // is out of sync with the start. Re-seeking to 0 realigns it so playback
      // begins cleanly from the beginning. The full seek pipeline runs
      // waitingForVideoSync + keyframe wait and notifySeekCompletion syncs the
      // clock to the actual first decodable PTS — same path as replay, so
      // buffering UI, A/V sync and EOF timing all behave identically.
      // Set wasPlayingBeforeSeek BEFORE the await: seek() enters from the
      // "paused" state and would otherwise derive it as false, so a fast
      // (already-buffered) completion firing inside the await would take the
      // paused branch and stall instead of starting playback. seek()'s
      // re-derivation now skips when this is already true.
      const uiTarget = 0;
      this.wasPlayingBeforeSeek = true;
      try {
        await this.seek(uiTarget, { suppressSpinner: true });
        this._playStartTime = performance.now();
      } catch (error) {
        this.suppressSeekSpinner = false;
        this.wasPlayingBeforeSeek = false;
        Logger.warn(TAG, "First-play seek failed", error);
      }
      return;
    }

    if (this._playStartTime === 0 && this.demuxer) {
      const targetTime = this.clock.getTime();

      // Flush the decode pipeline before re-seeking the demuxer. The
      // poster seek's processLoop bursts ~40 packets per rAF, racing the
      // demuxer cursor ahead of pts=0 while it hunts for the first video
      // frame. Without a flush + audio reset here, the first audio packet
      // that surfaces after demuxer.seek(targetTime) can land at a stale
      // interleaved PTS (e.g. 2.6s), anchoring firstBufferMediaTime there
      // and forcing video to skip ahead to catch up — the first-play
      // stutter. Mirrors the replay path which flushes + resets first.
      await this.videoDecoder.flush();
      await this.audioDecoder.flush();
      if (this.videoRenderer) this.videoRenderer.clearQueue();
      this.audioRenderer.reset();

      // Seek the demuxer first; only after it completes do we resume the
      // audio context. Running them concurrently let the audio renderer
      // accept the very first decoded packet before the demuxer cursor
      // had finished rewinding.
      //
      // Guard the seek: the demuxer rejects with "error -1" when the source
      // opened in a degenerate state (e.g. a non-faststart file whose prebuffer
      // hit EOF with zero frames, or a rapid source-switch that tore down the
      // read path mid-open). Unguarded, it escaped as an uncaught rejection —
      // and with the caller re-issuing play() it spammed/looped. Bail cleanly
      // and mark the source unplayable so the UI can show the broken state
      // instead of retrying a seek that can never succeed.
      try {
        await this.demuxer.seek(targetTime);
      } catch (error) {
        Logger.error(TAG, "Demuxer seek on first play failed", error);
        this.wasPlayingBeforeSeek = false;
        this.suppressSeekSpinner = false;
        this.stateManager.setState("error");
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
        return;
      }
      // After Open-GOP recovery (decoder rejected the first keyframe past
      // the seek target and reset), the next decoded frames will begin at
      // the previous GOP's keyframe — often 1-2s behind targetTime. Without
      // the seekTargetTime guard those pre-target frames get presented and
      // video lags audio for the rest of the GOP. Re-arm only the filter
      // (not waitingForVideoSync) — onFrame's pre-target drop check at the
      // top of the handler reads seekTargetTime alone, while leaving
      // waitingForVideoSync false keeps notifySeekCompletion from firing
      // and clobbering the state machine that play() is about to drive
      // into "playing" right below.
      this.seekTargetTime = targetTime;
      if (!this.disableAudio) {
        await this.audioRenderer.play();
      }
      this.clock.seek(targetTime);
      this.pendingAudioPackets = [];
      // Discard pause-time buffered packets — demuxer was just re-seeked,
      // so stashed packets are stale (would feed later timestamps into the
      // decoder, making first frame jump ahead instead of starting at targetTime).
      this.pendingPrebufferPackets = [];
      this.eofReached = false;
      this.eofSince = 0;
    } else {
      // Resume from pause — just resume AudioContext
      if (!this.disableAudio) {
        await this.audioRenderer.play();
      } else {
        Logger.debug(TAG, "Audio playback skipped (disabled for debugging)");
      }

      // Drop frames left in the queue that are stale relative to the clock.
      // This handles the rapid open→play→fullscreen→track-toggle case where
      // a decoder reset (Open GOP) re-decodes from an earlier reference
      // frame, leaves those frames queued during pause, and then presents
      // them on resume — causing a multi-second video lag behind audio.
      if (this.videoRenderer) {
        this.videoRenderer.dropStaleFrames(this.clock.getTime(), 0.2);
      }
    }

    // Start video presentation loop for smooth 60Hz playback
    if (this.videoRenderer) {
      this.videoRenderer.startPresentationLoop();
    }

    // Start native audio BEFORE clock so it becomes master immediately.
    // If autoplay is blocked, abort the play() and stay paused so the user
    // can resume with a gesture — otherwise video would advance without
    // audio and the clock would never sync.
    if (this.nativeAudioEl) {
      this.nativeAudioEl.playbackRate = this.clock.getPlaybackRate();
      try {
        await this.nativeAudioEl.play();
        this._nativeAudioAutoplayBlocked = false;
      } catch {
        // Autoplay-with-sound was blocked (no user gesture yet). A bare <audio>
        // element won't autoplay even when muted (Chrome's muted-autoplay
        // allowance is really for <video>), so we can't start its audio yet —
        // but the VIDEO lives on the canvas and needs no autoplay permission.
        // Roll the video on the wall clock (while the element is paused the
        // clock's audio provider returns -1, so it falls back automatically),
        // flag the block, and let the element surface the "Tap to unmute" pill.
        // The unmute gesture (setMuted(false)) then seeks + plays the audio,
        // which re-assumes clock-master duty. Mirrors the WebAudio/in-file path,
        // where video rolls while the AudioContext stays suspended.
        Logger.warn(TAG, "Native audio autoplay blocked — rolling video muted (tap to unmute)");
        this._nativeAudioAutoplayBlocked = true;
        // Fall through — do NOT pause or stop the presentation loop.
      }
    }

    this.clock.start();
    this._playStartTime = performance.now();

    // Transition to playing state
    // At this point, state should be 'ready', 'paused', or 'seeking' (never 'ended' as it's handled above)
    const stateForPlay = this.stateManager.getState();
    if (
      stateForPlay === "ready" ||
      stateForPlay === "paused" ||
      stateForPlay === "seeking"
    ) {
      if (!this.stateManager.setState("playing")) {
        Logger.error(
          TAG,
          `Failed to transition to playing from state: ${stateForPlay}`,
        );
        this.clock.pause();
        return;
      }
    } else {
      Logger.error(
        TAG,
        `Cannot transition to playing from state: ${stateForPlay}`,
      );
      this.clock.pause();
      return;
    }

    // Start demux loop
    // Cancel any existing animation frame to prevent duplicates
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Resuming while the tab is hidden (e.g. a Media Session / lock-screen play,
    // or a media-key press with the tab in the background): the rAF-driven
    // processLoop is throttled to ~1fps in background tabs, so decode falls
    // behind and audio starves and stops within seconds. Drive decode off the
    // un-throttled background Worker timer instead — pause() tore it down, and
    // if the tab was hidden while already paused it was never started. Mirror
    // the hide path's setup (drop video presentation; frames are discarded while
    // hidden anyway). Gated on audio, matching handleVisibilityChange — a
    // no-audio hidden source would just race the demuxer to EOF.
    const resumingHidden =
      typeof document !== "undefined" &&
      document.visibilityState === "hidden" &&
      !this.isPiPActive;
    if (resumingHidden) {
      this.isBackgrounded = true;
      if (this.videoRenderer) {
        this.videoRenderer.stopPresentationLoop();
        this.videoRenderer.clearQueue();
      }
      const hasAudio =
        !!this.trackManager.getActiveAudioTrack() && !this.disableAudio;
      if (hasAudio) this.startBackgroundTimer();
    }

    this.processLoop();

    Logger.info(TAG, "Playing");
  }

  /**
   * Play in native-audio-only mode (split-source data saver). No demuxer reads,
   * no decode loop — just the <audio> element + clock. Handles first play,
   * resume, and replay (rewind on ended). Autoplay-blocked stays paused (there's
   * no video to roll), with the centre play button as the resume affordance.
   */
  private async playNativeAudioOnly(): Promise<void> {
    const audioEl = this.nativeAudioEl;
    if (!audioEl) return;
    this.requestWakeLock();

    // Replay: rewind the audio + clock before starting again.
    if (this.stateManager.getState() === "ended") {
      try {
        audioEl.currentTime = 0;
        this.clock.seek(this.startTime);
      } catch {}
      this.stateManager.setState("seeking"); // ended → seeking (valid)
    }

    audioEl.playbackRate = this.clock.getPlaybackRate();
    try {
      await audioEl.play();
      this._nativeAudioAutoplayBlocked = false;
    } catch {
      // Autoplay-with-sound blocked and there's no video to roll muted — stay
      // paused so the centre play button shows for a user gesture.
      Logger.warn(TAG, "Native audio autoplay blocked — staying paused for user gesture");
      const st = this.stateManager.getState();
      if (st !== "paused") this.stateManager.setState("paused");
      return;
    }

    this.clock.start();
    this._playStartTime = performance.now();
    const st = this.stateManager.getState();
    if (st === "ready" || st === "paused" || st === "seeking") {
      this.stateManager.setState("playing");
    }
    Logger.info(TAG, "Playing (native-audio-only)");
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.streamWrapper) {
      this.streamWrapper.pause();
      return;
    }

    if (!this.stateManager.canPause()) {
      Logger.warn(TAG, "Cannot pause in current state");
      return;
    }

    // During buffering, transition to paused and stop auto-resume
    if (this.stateManager.getState() === "buffering") {
      this.wasPlayingBeforeRebuffer = false;
      if (!this.disableAudio) this.audioRenderer.pause();
      if (this.nativeAudioEl) this.nativeAudioEl.pause();
      if (this.videoRenderer) this.videoRenderer.stopPresentationLoop();
      this.stateManager.setState("paused");
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.stopBackgroundTimer();
      this.startPauseBuffering();
      Logger.info(TAG, "Paused during buffering");
      return;
    }

    // Release WakeLock when pausing
    this.releaseWakeLock();

    this.clock.pause();
    if (!this.disableAudio) {
      this.audioRenderer.pause();
    }
    if (this.nativeAudioEl) {
      this.nativeAudioEl.pause();
    }

    // Stop video presentation loop
    if (this.videoRenderer) {
      this.videoRenderer.stopPresentationLoop();
    }

    this.stateManager.setState("paused");

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopBackgroundTimer();

    // Continue buffering ahead while paused (YouTube-like behavior)
    this.startPauseBuffering();

    Logger.info(TAG, "Paused");
  }

  /**
   * Flag to prevent concurrent async WASM operations
   */
  private demuxInFlight = false;
  private demuxInFlightStartTime: number = 0;
  private static readonly DEMUX_TIMEOUT = 35000; // 35 seconds timeout (slightly more than HTTP timeout of 30s)
  private eofReached = false;
  // Wall-clock time (performance.now) when eofReached first flipped true.
  // Used as a watchdog: if the normal drained-and-played-out conditions
  // never all line up (e.g. a marginal float mismatch between the audio
  // playout head and the last video frame), force the ended transition
  // rather than freezing one frame short of the end forever.
  private eofSince = 0;

  /**
   * Internal handler for seek completion when first target frame is found.
   * Clears the seek flag, synchronizes clock, and transitions to final state.
   */
  private notifySeekCompletion(time: number, forced: boolean = false): void {
    Logger.debug(TAG, `notifySeekCompletion called: time=${time.toFixed(3)}s, waitingForVideoSync=${this.waitingForVideoSync}, seekTargetTime=${this.seekTargetTime.toFixed(3)}s, forced=${forced}`);
    if (!this.waitingForVideoSync) {
      Logger.warn(TAG, "notifySeekCompletion: early return (waitingForVideoSync=false)");
      return;
    }
    // Bail if a newer seek has superseded the one that armed this completion.
    // A stale frame/timeout from a coalesced rapid seek would otherwise run the
    // resume/paused branch and consume wasPlayingBeforeSeek out from under the
    // live seek — intermittently leaving rapid seeks stuck paused.
    if (this.seekArmedSessionId !== this.seekSessionId) {
      Logger.warn(
        TAG,
        `notifySeekCompletion: stale session ${this.seekArmedSessionId} != ${this.seekSessionId} — ignoring`,
      );
      return;
    }

    // Forced completion (safety timeout) with no decoded video frame yet: the
    // seek didn't actually produce a picture — slow network/decode just hasn't
    // delivered one. Going straight to "playing" here advances the clock over a
    // black screen and only recovers on a manual pause→play. Instead, finish
    // the seek bookkeeping but resume into "buffering" with the play intent
    // latched, so the normal buffering→resume path flips to "playing" the
    // moment the first frame is actually decoded — no user interaction needed.
    const noVideoFrameYet =
      !!this.videoRenderer && this.videoRenderer.getQueueSize() === 0;
    const forcedWithoutFrame =
      forced && noVideoFrameYet && !!this.trackManager.getActiveVideoTrack();

    const seekTarget = this.seekTargetTime;
    this.seekTargetTime = -1;
    this.waitingForVideoSync = false;
    this.seekingToKeyframe = false; // Also clear keyframe skip flag
    // First-play/replay seek has produced its first frame — drop spinner
    // suppression so any later genuine rebuffer shows the loading UI.
    this.suppressSeekSpinner = false;

    // How far past the requested target did the first frame actually land?
    // Long-GOP .ts files can land seconds late; subtract that in
    // getCurrentTime() so the UI timeline starts where the user clicked.
    if (seekTarget >= 0) {
      this.seekKeyframeOffset = Math.max(0, time - seekTarget);
    }

    Logger.debug(
      TAG,
      `Seek completion at ${time.toFixed(3)}s (target: ${seekTarget.toFixed(3)}s)`,
    );

    // Sync correction: Match clock to actual video/audio start time.
    //
    // When video arrives late (hardware decode lag, or no keyframe at the
    // exact seek target), we have two options:
    //
    //   a) Sync clock to earliest audio packet — audio stays continuous, but
    //      video frame sits queued until clock catches up, so the user hears
    //      audio while the video is frozen/stale for the gap duration.
    //
    //   b) Sync clock to video frame time — drops the stale audio packets
    //      between seek target and video time, but A/V stays coherent.
    //
    // Small gaps (< 200ms) are imperceptible, so (a) wins. Large gaps (from
    // sparse keyframes / slow HEVC+HDR decoders) were causing bad user-facing
    // desync: video and audio visibly drifting for nearly a second. For those
    // we now prefer (b) — a brief audio skip beats sustained A/V mismatch.
    if (time > seekTarget + 0.01) {
      const AUDIO_SYNC_GAP_LIMIT = 0; // NYUMATFLIX: video-first after seek
      let syncTime = time;
      let syncedToAudio = false;

      if (this.pendingAudioPackets.length > 0) {
        const earliestAudioTime = Math.min(
          ...this.pendingAudioPackets.map((p) => p.timestamp)
        );

        if (earliestAudioTime < time) {
          const gap = time - earliestAudioTime;
          if (gap <= AUDIO_SYNC_GAP_LIMIT) {
            syncTime = earliestAudioTime;
            syncedToAudio = true;
            Logger.debug(
              TAG,
              `Video arrived late (${time.toFixed(3)}s), syncing clock to earliest audio (${syncTime.toFixed(3)}s) — gap ${(gap * 1000).toFixed(0)}ms`,
            );
          } else {
            Logger.info(
              TAG,
              `Video-audio gap ${(gap * 1000).toFixed(0)}ms exceeds ${AUDIO_SYNC_GAP_LIMIT * 1000}ms; syncing clock to video (${time.toFixed(3)}s) and dropping stale audio before that`,
            );
          }
        } else {
          Logger.debug(
            TAG,
            `Stream jumped ahead. Syncing clock to video at ${syncTime.toFixed(3)}s.`,
          );
        }
      } else {
        Logger.debug(
          TAG,
          `Stream jumped ahead. Syncing clock to ${syncTime.toFixed(3)}s.`,
        );
      }

      this.clock.seek(syncTime);

      // Filter audio packets:
      //  - synced to audio: keep everything from seek target onward
      //  - synced to video: drop audio before the video frame so AV stays
      //    aligned after the seek
      const cutoff = syncedToAudio ? seekTarget - 0.01 : syncTime - 0.01;
      this.pendingAudioPackets = this.pendingAudioPackets.filter(
        (p) => p.timestamp >= cutoff,
      );
    }

    // Transition to final state
    if (
      (this.wasPlayingBeforeSeek || this.wasPlayingBeforeRebuffer) &&
      forcedWithoutFrame
    ) {
      // Wanted to resume, but the forced timeout fired before any video frame
      // decoded. Enter buffering with the play intent kept so the process
      // loop's buffering→resume path auto-flips to "playing" on the first
      // frame — instead of advancing the clock over a black screen.
      Logger.info(
        TAG,
        "Seek forced-complete with no video frame yet — buffering until first frame",
      );
      this.wasPlayingBeforeSeek = false;
      this.wasPlayingBeforeRebuffer = true; // resume intent for buffering→play
      this._bufferingEntryTime = performance.now();
      this.stateManager.setState("buffering");
      // Heavy software audio is flushed-cold by the seek. This branch waits for
      // the first video frame — which on an open-GOP CRA source can take a few
      // seconds (HW decoder recreate + CRA wait). Without priming, the audio
      // context keeps running through that wait and drains its buffer, so when
      // the first frame finally lands and we resume, the sub-realtime cold
      // decode underruns into gap-fill jitter. Hold the context suspended so
      // the catch-up decode instead accumulates a cushion, and flag the resume
      // gate to wait for it (issue #11, seek case).
      if (this.activeAudioNeedsColdPrime()) {
        this.beginAudioPrime();
      }
      if (this._playStartTime === 0) {
        this._playStartTime = performance.now();
      }
    } else if (this.wasPlayingBeforeSeek || this.wasPlayingBeforeRebuffer) {
      // Consume the resume intent so it doesn't leak into the next seek. It's
      // never reset elsewhere, so a stale `true` would make a later paused
      // user-seek wrongly auto-resume (and would defeat seek()'s re-derivation
      // guard that now skips re-deriving when this is already true).
      this.wasPlayingBeforeSeek = false;
      this.wasPlayingBeforeRebuffer = false;
      if (this._playStartTime === 0) {
        this._playStartTime = performance.now();
      }

      // Cold-start audio prime for heavy software audio (TrueHD/DTS via WASM),
      // which decodes sub-realtime for ~1-2s while the decode path warms up. If
      // we start now, the fast HW video races ahead while audio underruns —
      // gap-fills ("atak-atak") then a ~2s A/V resync once the buffer empties.
      // Route the resume through the same buffering machinery the stall path
      // uses: hold the AudioContext suspended (isPlaying=true so decoded audio
      // still accumulates), hold the clock and video presentation, and let the
      // buffering→resume gate below start both together once a real audio
      // cushion exists. NOT one-shot — every seek flushes the decoder, so each
      // post-seek resume is a cold start that needs the cushion too, else a
      // mid-playback seek resumes thin and underruns into ~2s of jitter (issue
      // #11, seek case). Hardware audio (AAC) and lightweight software codecs
      // (Opus/FLAC/AC-3/E-AC-3) decode faster than realtime even cold, so
      // activeAudioNeedsColdPrime() gates them out — no needless buffer for them.
      if (this.activeAudioNeedsColdPrime()) {
        this.beginAudioPrime();
        this.wasPlayingBeforeRebuffer = true; // resume intent for buffering→play
        this._bufferingEntryTime = performance.now();
        this.stateManager.setState("buffering");
        this.clock.pause();
        if (this.videoRenderer) this.videoRenderer.stopPresentationLoop();
        Logger.info(TAG, "Audio cold-prime: buffering until cushion");
        return;
      }

      Logger.info(TAG, "Resuming playback after seek");
      this.stateManager.setState("playing");
      // Mark that playback has actually started. When play() is pressed during
      // the initial poster-seek it early-returns before reaching the body that
      // normally sets _playStartTime, and the seek-completion resume path takes
      // over here instead — so _playStartTime would stay 0 for the whole
      // session. A later mid-playback recovery (decode-error → buffering →
      // this.play()) would then see _playStartTime === 0, mistake itself for
      // the "first play", and seek(0) — yanking a video that's an hour in back
      // to the start. Stamp it here so the first-play branch only ever fires
      // for a genuine first play.
      if (this._playStartTime === 0) {
        this._playStartTime = performance.now();
      }
      this.clock.start();
      if (!this.disableAudio && !this.audioRenderer.isAudioPlaying()) {
        this.audioRenderer.play();
      }

      // Flush buffered audio packets AFTER play() so AudioRenderer.isPlaying=true
      // and render() accepts the decoded AudioData instead of dropping it.
      if (this.pendingAudioPackets.length > 0) {
        Logger.debug(
          TAG,
          `Flushing ${this.pendingAudioPackets.length} buffered audio packets after seek sync`,
        );
        for (const pkt of this.pendingAudioPackets) {
          this.audioDecoder.decode(pkt.data, pkt.timestamp, pkt.keyframe);
        }
        this.pendingAudioPackets = [];
      }
    } else {
      Logger.info(TAG, "Seek completed in paused state");
      this.wasPlayingBeforeSeek = false;
      this.stateManager.setState("paused");

      // Don't decode audio now (AudioRenderer not playing — would drop all data).
      // Discard stashed audio and prebuffer packets — play() will re-seek the
      // demuxer to startTime so all packets will be re-read fresh from 0.
      // Keeping stale packets causes A/V desync (prebuffer audio at 0.4s+
      // would be processed before fresh audio at 0s).
      this.pendingAudioPackets = [];
      this.pendingPrebufferPackets = [];

      // Don't start clock or audio — but continue buffering ahead
      this.startPauseBuffering();
    }

    // Emit seeked event now that we are actually ready
    // Convert back from media time to UI time
    this.emit("seeked", Math.max(0, time - this.startTime));
  }

  /**
   * Heavy lossless/complex software audio codecs (TrueHD/MLP, DTS/DCA) decode
   * sub-realtime for ~1-2s from a cold start. Every seek flushes the decoder,
   * so each post-seek resume is a cold start that needs the audio prime cushion
   * — not just the first play/replay. Hardware audio (AAC) and lightweight
   * software codecs (Opus/FLAC/AC-3/E-AC-3) decode faster than realtime even
   * cold and don't need it. (issue #11)
   */
  private activeAudioNeedsColdPrime(): boolean {
    const codec = (
      this.trackManager.getActiveAudioTrack()?.codec ?? ""
    ).toLowerCase();
    return (
      !this.disableAudio &&
      this.audioDecoder.usesSoftware &&
      /truehd|mlp|dts|dca/.test(codec)
    );
  }

  /**
   * Tell the demuxer to skip every audio track except the active one. A file
   * with a second, unused audio track (e.g. a dual-TrueHD source with ~933
   * packets/s PER track) otherwise floods the read path with packets the loop
   * immediately throws away — roughly doubling the reads needed per second. On
   * a slower engine (Safari pulls ~half the packets/s of Chromium) that starved
   * the ACTIVE audio below realtime and stalled every few seconds (issue #11).
   * AVDISCARD_ALL makes av_read_frame skip them internally so each read returns
   * a useful packet. Only audio streams are touched — video and subtitles keep
   * their demuxer defaults (subtitles are read on demand). Re-applied on every
   * audio-track switch so the newly-selected track is re-enabled.
   */
  private applyStreamDiscard(): void {
    const bindings = this.demuxer?.getBindings();
    if (!bindings) return;
    const activeAudioId = this.trackManager.getActiveAudioTrack()?.id;
    for (const t of this.trackManager.getTracks()) {
      if (t.type === "audio") {
        bindings.setStreamDiscard(t.id, t.id !== activeAudioId);
      }
    }
  }

  /**
   * Begin an audio prime: hold the AudioContext suspended (primeForBuffering,
   * which never issues a resume() so it can't drain/race), flush any pending
   * post-seek audio packets into the decoder so the cushion starts filling, and
   * flag _primingAudio so the buffering→resume gate waits for a real cushion
   * (2s) rather than the thin 0.1s default before resuming.
   */
  private beginAudioPrime(): void {
    this.audioRenderer.primeForBuffering();
    if (this.pendingAudioPackets.length > 0) {
      for (const pkt of this.pendingAudioPackets) {
        this.audioDecoder.decode(pkt.data, pkt.timestamp, pkt.keyframe);
      }
      this.pendingAudioPackets = [];
    }
    this._primingAudio = true;
  }

  /**
   * Main Playback Loop
   */
  private processLoop = async () => {
    const currentState = this.stateManager.getState();
    // Run if playing OR buffering (for rebuffering) OR if we are resolving a seek (fetching target frame)
    if (currentState !== "playing" && currentState !== "buffering" && !this.waitingForVideoSync)
      return;

    // Capture session ID at start of loop - if a new seek starts, this loop should abort
    const currentSessionId = this.seekSessionId;

    this.animationFrameId = requestAnimationFrame(this.processLoop);

    if (!this.demuxer) return;

    // Check if a new seek has started - if so, abort this loop iteration
    if (this.seekSessionId !== currentSessionId) {
      Logger.debug(TAG, "ProcessLoop aborted: new seek started");
      return;
    }

    // Check if audio is rebuffering due to playback rate change
    if (!this.disableAudio && this.audioRenderer.isRebuffering()) {
      // Enter buffering state and pause clock until rebuffering completes
      const currentState = this.stateManager.getState();
      if (currentState === "playing") {
        this.wasPlayingBeforeRebuffer = true;
        this._bufferingEntryTime = performance.now();
        this.stateManager.setState("buffering");
        this.clock.pause();
        if (this.videoRenderer) this.videoRenderer.stopPresentationLoop();
        Logger.debug(TAG, "Entered buffering state for playback rate change");
      }
      // Continue processing to allow new audio to be decoded and scheduled
    } else if (this.stateManager.getState() === "buffering" && this.wasPlayingBeforeRebuffer) {
      // Resume after minimum dwell time to accumulate enough data
      const hasAudioTrack = !!this.trackManager.getActiveAudioTrack();
      // The first-play cold prime needs a REAL cushion before it starts: the
      // software decode is still sub-realtime (and gets even slower once video
      // decode/render competes for CPU), so resuming on a thin 0.1s buffer just
      // underruns again → a second stall + a ~2s A/V resync. Require ~1.5s
      // buffered for the prime (with a generous max-dwell fallback so a very
      // slow decoder still eventually starts). A normal mid-playback rebuffer
      // keeps the lighter 0.1s threshold for responsiveness.
      const audioTargetS = this._primingAudio ? 2.0 : 0.1;
      const audioReady =
        this.disableAudio ||
        !hasAudioTrack ||
        this.audioRenderer.getBufferedDuration() > audioTargetS;
      const videoReady = !this.videoRenderer || this.videoRenderer.getQueueSize() > 0;
      const dwellMs = performance.now() - this._bufferingEntryTime;
      const minDwell = 1500; // Wait at least 1.5s to accumulate buffer
      // Cap the prime startup so a very CPU-bound decoder doesn't spin forever;
      // it starts with whatever cushion it built (a residual stall is possible
      // on such machines — the real fix is off-thread audio decode).
      const maxDwell = this._primingAudio ? 4000 : 3000;
      // Resume if: (1) both ready after minDwell, (2) audio ready after longer
      // wait, or (3) the max-dwell fallback (don't wait forever).
      const canResume = dwellMs >= minDwell && (
        (audioReady && videoReady) ||
        (audioReady && dwellMs >= 3000) ||
        dwellMs >= maxDwell
      );
      if (canResume) {
        this._primingAudio = false;
        this.stateManager.setState("paused");
        this.wasPlayingBeforeRebuffer = false;
        // Resume AudioContext before play() so audio picks up from where it was
        if (this.audioRenderer) {
          this.audioRenderer.resumeFromBuffering();
        }
        Logger.info(TAG, "Buffers refilled, resuming playback");
        this.play().catch((err) => {
          Logger.error(TAG, "Failed to resume playback after rebuffering:", err);
        });
      }
    }

    // Update FileSource preload position based on current time
    if (this.source instanceof FileSource && this.mediaInfo) {
      const currentTime = this.clock.getTime();
      const duration = this.mediaInfo.duration + this.startTime;
      if (duration > 0) {
        this.source.updatePreloadPosition(currentTime, duration);
      }
    }

    // Emit periodic time update for UI
    this.emit("timeUpdate", this.getCurrentTime());

    // Stall detection: if playing but both video and audio buffers are critically low
    // Skip near end of video to avoid false stall at EOF
    const nearEnd = this.mediaInfo && this.clock.getTime() >= (this.mediaInfo.duration + this.startTime) - 3;
    // Longer stall timeout for slow + high-FPS: stretcher / hardware rate fallback
    // causes brief audio gaps that aren't true stalls. 2s vs 500ms default.
    const currentRate = this.clock.getPlaybackRate();
    const currentFps = (this.mediaInfo as any)?.videoFrameRate ?? 30;
    const isSlowHighFps = currentRate < 0.99 && currentFps >= 50;
    const stallTimeout = isSlowHighFps ? 2000 : 500;
    // Grace period after play() starts: allow decode pipeline to fill before stall detection.
    // Without this, clicking play on a poster triggers a false stall → buffering → loading spinner.
    const playGraceMs = 3000;
    const inPlayGrace = this._playStartTime > 0 && (performance.now() - this._playStartTime) < playGraceMs;
    // Grace while the video decoder is recovering from a transient decode
    // error (recreate + wait-for-keyframe). The video queue is legitimately
    // empty for ~1 GOP there — counting it as a stall sends the player into a
    // buffering→resume loop (seen on high-bitrate 1080p H.264 whose HW decoder
    // throws an EncodingError on every IDR). The keyframe-wait handler already
    // shows buffering during the actual recovery; this just stops the stall
    // detector from piling on right after.
    const decoderRecovering =
      !!this.videoDecoder && this.videoDecoder.isRecentlyRecovering();
    if (this.stateManager.getState() === "playing" && !this.eofReached && !this.waitingForVideoSync && !nearEnd && !this.isBackgrounded && !inPlayGrace && !decoderRecovering) {
      const videoEmpty = this.videoRenderer ? this.videoRenderer.getQueueSize() === 0 : false;
      const hasAudio = !!this.trackManager.getActiveAudioTrack() && !this.disableAudio;
      const audioLow = !hasAudio || this.audioRenderer.getBufferedDuration() < 0.02; // NYUMATFLIX
      if (videoEmpty && audioLow) {
        if (!this._stallStartTime) {
          this._stallStartTime = performance.now();
        } else if (performance.now() - this._stallStartTime > stallTimeout) {
          // Only enter buffering after 500ms of continuous stall
          Logger.warn(TAG, "Stall detected: buffers empty for 500ms, entering buffering state");
          this.wasPlayingBeforeRebuffer = true;
          this._bufferingEntryTime = performance.now();
          this.stateManager.setState("buffering");
          this.clock.pause();
          // Suspend AudioContext so already-scheduled audio doesn't play ahead of video.
          // Keep isPlaying=true so render() still accepts AudioData and buffers fill up.
          if (this.audioRenderer) {
            this.audioRenderer.suspendForBuffering();
          }
          // Stop presentation loop so decoded frames accumulate in queue
          // (otherwise it keeps consuming them and videoReady never becomes true)
          if (this.videoRenderer) this.videoRenderer.stopPresentationLoop();
          this._stallStartTime = 0;
        }
      } else {
        this._stallStartTime = 0;
      }
    } else {
      this._stallStartTime = 0;
    }

    // Audio desync detection: if audio falls significantly behind video at 1x.
    // Clock syncs to audio so clock vs audio is always ~0. Compare audio against
    // maxScheduledMediaTime vs actual playback position to detect real desync.
    // Skip when muted — demux loop drops audio decode entirely (see muted check
    // in process loop), so getAudioClock() stays clamped and would falsely trip.
    if (this.stateManager.getState() === "playing" && !this.disableAudio && !this.muted && !inPlayGrace && Math.abs(this.clock.getPlaybackRate() - 1.0) < 0.01) {
      const audioTime = this.audioRenderer.getAudioClock();
      const videoTime = this.videoRenderer
        ? (this.videoRenderer as any).currentTime ?? -1
        : -1;
      if (audioTime >= 0 && videoTime > 0) {
        const audioBehind = videoTime - audioTime;
        // Cooldown: a resync seek itself takes ~1–2s, so back-to-back desync
        // detections trigger a stutter loop where almost no playback happens
        // between seeks (especially with slow software audio decoders). Wait
        // at least 5s between desync-driven seeks — better to tolerate a
        // sustained ~500ms offset than to pause every second.
        const sinceLastResync = performance.now() - this._lastDesyncSeekTime;
        if (audioBehind > 0.5 && sinceLastResync > 5000) {
          // Suppress the seek when the audio renderer already has samples
          // scheduled past the presented video frame. The gap is just the
          // buffer runway — audio playback will catch up on its own. Forcing
          // a seek here would flush already-decoded audio and cause an
          // audible trip. Most visible after foreground recovery: while
          // backgrounded the audio worker keeps scheduling buffers (out to
          // ~maxScheduledMediaTime), the demuxer-seek brings video forward
          // to that same point, and the playback head is still chewing
          // through the runway — looks like 1s of "desync" but isn't.
          const audioBufferEnd = this.audioRenderer.getMaxScheduledMediaTime();
          if (audioBufferEnd < videoTime - 0.1) {
            Logger.warn(TAG, `Audio desync detected: video=${videoTime.toFixed(2)}s, audio=${audioTime.toFixed(2)}s, behind=${(audioBehind * 1000).toFixed(0)}ms — resyncing`);
            this._lastDesyncSeekTime = performance.now();
            this.seek(this.getCurrentTime()).catch(() => {});
          }
        }
      }
    }

    // Prevent concurrent async WASM operations (Asyncify limitation)
    // Add timeout safeguard - if demux has been in flight too long, reset it
    if (this.demuxInFlight) {
      const elapsed = performance.now() - this.demuxInFlightStartTime;
      if (elapsed > MoviPlayer.DEMUX_TIMEOUT) {
        Logger.warn(
          TAG,
          `Demux operation timeout after ${elapsed}ms, resetting flag`,
        );
        this.demuxInFlight = false;
      } else {
        return;
      }
    }

    // Check if we've reached EOF and decoders are empty - transition to ended
    if (this.eofReached) {
      const currentTime = this.clock.getTime();
      const duration = this.mediaInfo?.duration ?? 0;
      const timeDone =
        currentTime >= duration + this.startTime - 0.5 || duration === 0;

      const hasAudioTrack =
        !!this.trackManager?.getActiveAudioTrack() && !this.disableAudio;

      if (hasAudioTrack) {
        const decodersDone =
          this.videoDecoder.queueSize === 0 && this.audioDecoder.queueSize === 0;
        // The audio renderer keeps playing buffers it already scheduled for
        // seconds after the decoder queue drains. The clock is synced to that
        // playout head, so it only reaches maxScheduledMediaTime once the final
        // samples are actually heard. End when the playout head has caught up to
        // the furthest scheduled audio — not when the decoder empties — or the
        // last few seconds get clipped (audible on near-end seeks of audio-only
        // files). duration===0 keeps the unknown-length fallback.
        // maxScheduled is already absolute media time (the scheduler stores
        // raw packet timestamps), same basis as clock.getTime(). Don't add
        // startTime again — on sources with a non-zero start (e.g. a .ts
        // beginning at 4200s) the double-add pushes the threshold out of
        // reach, audioPlayedOut never trips, and EOF never transitions to
        // ended (timer freezes short of duration).
        const maxScheduled = this.audioRenderer.getMaxScheduledMediaTime();
        // Normally audio is "played out" once the clock catches the furthest
        // scheduled buffer. But maxScheduled can be stale/runaway — e.g. when
        // a prior decoder instance scheduled audio out to a wrong (longer)
        // duration and the AudioRenderer carried that value into the new
        // player (HW→software fallback on the same element). The clock is also
        // clamped to the true container duration in getTime(), so it plateaus
        // at `duration` and can never reach an inflated maxScheduled. Treat
        // audio as done if EITHER the playout head is reached OR the clock has
        // arrived at the real end of content — whichever the clock can attain.
        const reachedContentEnd =
          duration > 0 && currentTime >= duration + this.startTime - 0.25;
        const audioPlayedOut =
          (maxScheduled > 0 && currentTime >= maxScheduled - 0.1) ||
          reachedContentEnd;
        // The clock is clamped to the audio playout head (getAudioClock caps
        // at maxScheduledMediaTime). When the last video frame's PTS sits past
        // that head — e.g. video runs a few ms longer than the audio track —
        // the presentation loop never reaches it, so it lingers in the queue
        // forever and a strict queue-empty check would block the ended
        // transition indefinitely (EOF reached, but never ends). Once the
        // demuxer and video decoder are both drained, treat the renderer as
        // done if its queue is empty OR only holds this unpresentable tail
        // (head frame at/after the audio playout head).
        const headFrameTime = this.videoRenderer?.getHeadFrameTime() ?? -1;
        const videoDone =
          !this.videoRenderer ||
          this.videoRenderer.getQueueSize() === 0 ||
          (decodersDone &&
            maxScheduled > 0 &&
            headFrameTime >= maxScheduled - 0.05);
        if ((decodersDone && videoDone && audioPlayedOut) || duration === 0) {
          this.handleEnded();
          return;
        }
        // Watchdog: the audio has fully played out (it's the master clock and
        // its playout head has been reached) but the strict conditions above
        // never all aligned — a marginal float mismatch between the audio tail
        // and the last video frame can leave one frame unpresentable forever.
        // Once audio is done and we've waited a beat, end rather than freeze.
        if (
          audioPlayedOut &&
          this.eofSince > 0 &&
          performance.now() - this.eofSince > 750
        ) {
          Logger.warn(
            TAG,
            "EOF watchdog: audio played out but pipeline never fully drained; forcing ended",
          );
          this.handleEnded();
          return;
        }
      } else {
        // Video-only: WebCodecs decodeQueueSize drops to 0 before all output
        // callbacks fire, making queue-based end unreliable. Use clock only.
        if (timeDone) {
          this.handleEnded();
          return;
        }
      }
      return; // Don't demux more, just wait for playback to finish
    }

    // Check backpressure - relax limits for better throughput
    // After seek, use stricter limits to prevent overwhelming low-end devices
    const isSoftware = this.isSoftwareDecoding();
    const timeSinceSeek = performance.now() - this.seekTime;
    const isPostSeek =
      this.justSeeked && timeSinceSeek < MoviPlayer.POST_SEEK_THROTTLE_MS;

    const audioBuffered = this.disableAudio
      ? 0
      : this.audioRenderer.getBufferedDuration();

    // Canvas/WebCodecs path
    const videoBuffered = this.videoRenderer?.getQueueSize() ?? 0;

    // Adaptive limits for software/hardware modes
    // During post-seek or while waiting for initial sync, we are more permissive with decoder queues
    // to ensure they have enough data to output the first few frames.
    const maxVideoQueue = isSoftware
      ? 1000
      : isPostSeek || this.waitingForVideoSync
        ? 60
        : 30;
    const maxAudioQueue = isSoftware
      ? 500
      : isPostSeek || this.waitingForVideoSync
        ? 40
        : 20;

    // Buffer targets — scale up at slow speeds so both audio and video buffers
    // hold the same wall-clock duration as at 1x. Without this, at 0.5x the 100-frame
    // video buffer lasts 3.3s wall-time while 2s audio buffer starves after 2s → stutter.
    const rate = Math.max(0.25, this.clock.getPlaybackRate());
    // Slow rates: keep the same wall-clock buffer duration (so a 2s audio
    // target doesn't underrun at 0.5x). Fast rates: give the video pipeline
    // proportional headroom too — at 1.5x the decoder is producing frames
    // 50% faster than wall-clock, and the base queue cap empties just as
    // quickly, so any decode jitter shows up as stutter. Cap at 2x scale
    // so 4x playback doesn't balloon VRAM/audio buffers on heavy sources.
    const rateScale = rate < 1.0 ? 1.0 / rate : Math.min(2.0, rate);
    const maxAudioBuffered = (isSoftware ? 5.0 : isPostSeek ? 1.5 : 2.0) * rateScale;
    // Renderer queue limits (in frames). Two separate constraints:
    //
    //  1. High-res (≥4K): per-frame VRAM cost is huge (8K HDR ≈ 50MB/frame).
    //     A deep queue locks GBs of VRAM and starves the GPU compositor,
    //     producing slips even when decode is keeping up. Hard frame cap.
    //
    //  2. Mobile at any res: weaker hardware + Chrome Android's conservative
    //     AV1 HW whitelist mean software dav1d is common; deep buffering
    //     just delays the inevitable underrun. Cap by wall-clock duration
    //     (~800ms) so the cap scales with fps — a 25fps source doesn't end
    //     up with the same tiny 16-frame buffer as 60fps, which would fire
    //     demuxer backpressure long before audio is ready to refill (this
    //     was the "audio drift" symptom).
    //
    // When both apply (e.g. 8K on mobile), use the tighter of the two.
    const activeVideo = this.trackManager.getActiveVideoTrack();
    const pixels = (activeVideo?.width ?? 0) * (activeVideo?.height ?? 0);
    const fps = Math.max(15, Math.min(120, activeVideo?.frameRate ?? 30));
    const is8KPlus = pixels >= 7680 * 4320;
    const isHighRes = pixels >= 3840 * 2160; // 4K and above
    const isMobile = MoviPlayer._isMobileDevice;
    let baseHwQueue: number;
    if (is8KPlus) {
      // 8K+ desktop: 16 frames is a VRAM-bound sweet spot (8K HDR frames are
      // ~50MB each; deeper queues stall the compositor and 100 × 50MB ≈ 5GB
      // VRAM was the original starvation cause). Mobile shifts to software
      // dav1d so a shallow queue helps the decoder catch up.
      if (isMobile) baseHwQueue = isPostSeek ? 8 : 12;
      else baseHwQueue = isPostSeek ? 12 : 16;
    } else if (isHighRes) {
      // 4K (not 8K) desktop: 4K HDR RGBA8 frames are ~33MB so 48 × 33MB ≈
      // 1.6GB VRAM — bounded but deep enough to absorb 250-500ms GC/decode
      // hiccups without draining the renderer queue. The previous uniform
      // 16-frame cap (267ms @60fps) was too shallow for 4K60 HEVC HDR: any
      // jitter emptied the queue, paused demuxing, and starved audio.
      if (isMobile) baseHwQueue = isPostSeek ? 8 : 16;
      else baseHwQueue = isPostSeek ? 24 : 48;
    } else if (isMobile) {
      // 1080p (and lighter) on mobile is smooth at the 800ms target — keep it.
      const targetMs = isPostSeek ? 400 : 800;
      baseHwQueue = Math.max(12, Math.round((fps * targetMs) / 1000));
    } else {
      baseHwQueue = isPostSeek ? 20 : 100; // desktop default
    }
    const maxVideoBuffered = Math.round((isSoftware ? 60 : baseHwQueue) * rateScale);

    // Skip video backpressure when video isn't being consumed:
    // - Background (not PiP): video decode is skipped entirely
    // - Buffering: presentation loop stopped, frames accumulate but aren't consumed
    //   (must keep demuxing so audio data flows and isRebufferingForRateChange clears)
    const skipVideoBackpressure =
      (this.isBackgrounded && !this.isPiPActive) ||
      currentState === "buffering";

    // Stuck decoder detection: if video decoder queue is full but renderer queue
    // stays empty for too long, the decoder is hung (e.g. 8K content too heavy).
    // Flush it to unstick — some frames may be lost but playback continues.
    if (this.videoDecoder.queueSize > maxVideoQueue && videoBuffered === 0) {
      if (!this._decoderStuckSince) {
        this._decoderStuckSince = performance.now();
      } else if (performance.now() - this._decoderStuckSince > 5000) {
        Logger.warn(TAG, `Video decoder stuck for 5s (queue=${this.videoDecoder.queueSize}, output=0), flushing`);
        this.videoDecoder.flush().catch(() => {});
        this._decoderStuckSince = 0;
      }
    } else {
      this._decoderStuckSince = 0;
    }

    // When video buffer/decoder queue is full but audio is starving, don't block demuxing —
    // set a flag so the demux loop skips video decode while keeping audio flowing.
    // This is critical for high-FPS content (120fps) where the video decoder queue fills
    // faster than hardware can process, which would otherwise starve the audio pipeline.
    // ONLY at non-1x rates: at 1x, video/audio are consumed at the same rate so skipping
    // video is unnecessary and causes early EOF (video never decoded → queues empty → ended).
    // Skipping non-keyframe AV1 packets also corrupts the decoder reference chain → decode
    // errors every few seconds. Mobile audio drift is fixed via queue sizing, not by
    // dropping packets at 1x.
    //
    // Threshold was 0.5s back when AudioContext used latencyHint="playback" (~200ms
    // output buffer). With latencyHint="interactive" the scheduled buffer hovers in
    // the 50-150ms range steady-state, so anything close to 500ms reads as "always
    // starving" and the skip engaged every demux tick — dropping AV1 non-keyframes
    // constantly, which fired EncodingError once per GOP on non-1x rates. 100ms
    // matches the interactive buffer's real safety margin; below it audio is
    // genuinely about to underrun and warrants the packet-drop tradeoff.
    const isNon1xRate = Math.abs(rate - 1.0) > 0.01;
    const audioStarving = !this.disableAudio && audioBuffered < 0.05; // NYUMATFLIX
    const videoDecoderFull = this.videoDecoder.queueSize > maxVideoQueue;
    const videoBufferFull = !skipVideoBackpressure && videoBuffered > maxVideoBuffered;
    const skipVideoDecodeForAudio = isNon1xRate && !this.muted && (videoBufferFull || videoDecoderFull) && audioStarving;

    if (
      (!skipVideoBackpressure && !skipVideoDecodeForAudio && this.videoDecoder.queueSize > maxVideoQueue) ||
      (!this.disableAudio && this.audioDecoder.queueSize > maxAudioQueue) ||
      (!this.disableAudio && audioBuffered > maxAudioBuffered) ||
      (!skipVideoBackpressure && !skipVideoDecodeForAudio && videoBuffered > maxVideoBuffered)
    ) {
      if (
        this.waitingForVideoSync &&
        (this.videoDecoder.queueSize > maxVideoQueue ||
          videoBuffered > maxVideoBuffered)
      ) {
        Logger.debug(
          TAG,
          `Backpressure during sync: videoDecoder=${this.videoDecoder.queueSize}, videoBuffered=${videoBuffered}`,
        );
      }
      return;
    }

    // Read packet
    try {
      // Final check before starting async operation - ensure no new seek started
      if (this.seekSessionId !== currentSessionId) {
        Logger.debug(TAG, "ProcessLoop aborted before demux: new seek started");
        return;
      }

      this.demuxInFlight = true;
      this.demuxInFlightStartTime = performance.now();

      // Determine burst size based on buffer levels, post-seek state, and FPS.
      // High-FPS content (120fps) has ~120 video packets per ~47 audio packets.
      // A burst of 20 may only yield 1-2 audio packets (~42ms) which isn't enough
      // to prevent audio buffer underruns between rAF callbacks (~16.7ms).
      const fps = this.trackManager?.getActiveVideoTrack()?.frameRate ?? 30;
      const fpsScale = Math.max(1, Math.ceil(fps / 30)); // 1x for 30fps, 2x for 60fps, 4x for 120fps
      let burstSize = 20 * fpsScale;

      if (isPostSeek) {
        burstSize = 5 * fpsScale;
        Logger.debug(
          TAG,
          `Post-seek throttling: using burst size ${burstSize}`,
        );
      } else {
        // Clear the justSeeked flag after throttle period
        if (
          this.justSeeked &&
          timeSinceSeek >= MoviPlayer.POST_SEEK_THROTTLE_MS
        ) {
          this.justSeeked = false;
          Logger.debug(TAG, "Post-seek throttle period ended");
        }

        // Normal burst size logic
        const videoQueue = this.videoRenderer?.getQueueSize() ?? 0;
        const currentAudioBuffered = this.audioRenderer.getBufferedDuration();

        // If buffers are low, increase burst size to fill faster.
        // High-FPS needs more headroom because audio packets are sparse among video packets.
        // During initial play grace period with audio active, use a gentler burst to
        // avoid overwhelming the main thread (audio decode + render + stable audio
        // processing is CPU-heavy alongside 4K video decode).
        const bufferTarget = isSoftware ? 2.0 : fps >= 60 ? 1.0 : 0.5;
        if (videoQueue < 30 || currentAudioBuffered < bufferTarget) {
          if (inPlayGrace && !this.muted && !this.disableAudio && !isSoftware) {
            burstSize = 20 * fpsScale; // Gentler ramp during initial fill with audio
          } else {
            // Burst is a PACKET cap, but what matters for a cushion is how many
            // VIDEO packets it reads — and in a heavily-interleaved file that
            // can be a tiny fraction. e.g. a dual-audio 1080p TrueHD source
            // reads ~933 pkt/s PER audio track vs ~19 video pkt/s, so a
            // 40-packet burst pulls only ~0.4 video packets and video can never
            // read ahead of realtime → no cushion → a stall on any hiccup
            // (issue #11, "stalls every ~60s" on a 2×TrueHD file). A larger cap
            // lets video outpace consumption and build a cushion; it stays
            // self-limiting because the outer backpressure gate stops reading
            // once videoBuffered/audioBuffered pass their targets, and the
            // periodic MessageChannel yield below keeps the tick non-blocking.
            burstSize = (isSoftware ? 160 : 160) * fpsScale;
          }
        }
      }

      // For video-only content, throttle submissions based on renderer queue.
      // Without audio backpressure, all packets get submitted in one burst which
      // overwhelms VP8/software WebCodecs decoders (output callbacks stop firing).
      const hasAudioForBurst = !!this.trackManager?.getActiveAudioTrack() && !this.disableAudio;
      const maxRendererQueue = 60; // ~2.4s at 25fps, enough buffer without overwhelming

      // When decoder is skipping frames (waitingForKeyframe after error), limit burst
      // to prevent the demuxer from racing through the entire file in one rAF.
      // Without this, non-keyframes skip silently → no backpressure → early EOF.
      if (this.videoDecoder.isWaitingForKeyframe) {
        burstSize = Math.min(burstSize, 5);
      }

      for (let i = 0; i < burstSize; i++) {
        // Video-only throttle: if renderer queue is full enough, stop submitting
        // and let the presentation loop consume frames before adding more.
        if (!hasAudioForBurst && this.videoRenderer && this.videoRenderer.getQueueSize() > maxRendererQueue) {
          break;
        }

        // Check both video and audio queues after seek to prevent overwhelming decoders
        // When audio is starving, don't let video queue fullness stop the burst — we need
        // to keep reading packets to find audio data (video decode is skipped below).
        if (
          (!skipVideoDecodeForAudio && this.videoDecoder.queueSize > maxVideoQueue) ||
          (!this.disableAudio && this.audioDecoder.queueSize > maxAudioQueue)
        ) {
          // Queue getting full, stop to let decoders catch up
          if (isPostSeek) {
            Logger.debug(
              TAG,
              `Post-seek: queue full (video: ${this.videoDecoder.queueSize}, audio: ${this.audioDecoder.queueSize}), pausing burst`,
            );
          }
          break;
        }

        // Yield periodically to prevent blocking the main thread, especially in software mode
        // Scale with FPS — at 120fps, packets are small and fast, yielding too often starves audio
        const yieldInterval = isPostSeek ? 2 * fpsScale : isSoftware ? 3 : 20 * fpsScale;
        if (i > 0 && i % yieldInterval === 0) {
          // Use MessageChannel for fast yielding (better than setTimeout)
          const channel = new MessageChannel();
          await new Promise((resolve) => {
            channel.port1.onmessage = resolve;
            channel.port2.postMessage(null);
          });

          // Check if a new seek started during yield
          if (this.seekSessionId !== currentSessionId) {
            Logger.debug(
              TAG,
              "ProcessLoop aborted during packet read: new seek started",
            );
            this.demuxInFlight = false; // Reset flag so new seek can proceed
            return;
          }
        }

        // Drain prebuffered packets first so play() doesn't re-read them
        // from the source. Stashed packets are pre-seek and always safe.
        let packet: Packet | null;
        if (this.pendingPrebufferPackets.length > 0) {
          packet = this.pendingPrebufferPackets.shift()!;
        } else {
          // When separate audio demuxer exists, primary demuxer only provides video/subtitle
          packet = await this.demuxer.readPacket();

          // Check again after async readPacket - seek may have started during read
          if (this.seekSessionId !== currentSessionId) {
            Logger.debug(
              TAG,
              "ProcessLoop aborted after readPacket: new seek started",
            );
            this.demuxInFlight = false; // Reset flag so new seek can proceed
            return;
          }
        }

        if (!packet) {
          // EOF reached - mark it but don't stop immediately
          // Let the decoders finish processing
          if (!this.eofReached) this.eofSince = performance.now();
          this.eofReached = true;

          // Clear seeking flag if we hit EOF before finding keyframe
          if (this.seekingToKeyframe) {
            this.seekingToKeyframe = false;
            Logger.warn(TAG, "EOF reached before finding keyframe after seek");
          }

          // If we were waiting for sync, trigger it now so player doesn't hang in loading state
          if (this.waitingForVideoSync) {
            Logger.warn(
              TAG,
              "EOF reached while waiting for seek sync, forcing completion",
            );
            this.notifySeekCompletion(this.seekTargetTime);
          }

          Logger.debug(TAG, "EOF reached");
          break;
        }

        // Dispatch to decoders/renderers
        if (this.trackManager.isActiveStream(packet.streamIndex)) {
          const activeVideo = this.trackManager.getActiveVideoTrack();
          const activeAudio = this.trackManager.getActiveAudioTrack();

          if (activeVideo && activeVideo.id === packet.streamIndex) {
            // Audio-only mode: skip ALL video decoding to save CPU. Decode is
            // the expensive part; the interleaved bytes still arrive (no single-
            // file bandwidth saving — that's the adaptive-stream wrapper's job),
            // but the GPU/CPU video pipeline stays idle. Toggling back to video
            // re-seeks to recover a keyframe (see setAudioOnly).
            if (this._audioOnly) {
              continue;
            }
            // In background (not PiP), skip video decoding entirely.
            // This prevents frame queue buildup that blocks audio demuxing via backpressure.
            // At 60fps, video queue fills in ~1.7s and starves audio.
            if (this.isBackgrounded && !this.isPiPActive) {
              continue;
            }

            // Skip video decode when video buffer is full but audio is starving.
            // This keeps audio flowing at non-1x rates where video frames accumulate
            // faster than consumed. Some video frames are lost but audio stays smooth.
            //
            // Keyframes-only during the starve: AV1's inter-frame dependency means
            // dropping a non-keyframe orphans every delta that references it, so
            // feeding those deltas to the decoder throws EncodingError → decoder
            // close → recreate→keyframe-wait recovery (noisy, and a momentary
            // freeze). Dropping ALL video (the old behavior) is even worse — the
            // next decoded delta is still an orphan, so the error fires the
            // moment the starve ends. Instead we keep decoding keyframes and skip
            // only deltas: each keyframe is a self-contained reference reset, so
            // nothing the decoder receives is ever orphaned — no EncodingError.
            // Video updates at roughly one frame per GOP (~0.5fps on a 2s GOP)
            // until audio recovers, then full-rate decode resumes at the next
            // keyframe with the reference chain intact.
            if (skipVideoDecodeForAudio && !packet.keyframe) {
              // A delta was skipped, so every following delta is now orphaned
              // until the next keyframe rebuilds the reference chain. Latch this
              // so that even after the starve clears we keep skipping deltas
              // until a keyframe — otherwise the first post-starve delta is an
              // orphan and throws the very EncodingError we're avoiding.
              this.videoChainBrokenUntilKeyframe = true;
              continue;
            }
            // Reference chain broken by an earlier skip: keep dropping deltas
            // until a keyframe resets it, regardless of current starve state.
            if (this.videoChainBrokenUntilKeyframe) {
              if (!packet.keyframe) {
                continue;
              }
              this.videoChainBrokenUntilKeyframe = false;
            }

            // After seek, skip non-keyframe video packets until we find a keyframe
            // This prevents decoder errors (decoder needs keyframe after flush)
            if (this.seekingToKeyframe) {
              // Check timeout - if we've been waiting too long, give up and accept any frame
              const elapsed =
                performance.now() - this.seekingToKeyframeStartTime;
              // Prefer a true IDR to restart: on mixed-keyframe HEVC a CRA sent
              // as `key` is rejected by the HW decoder (open-GOP) and forces a
              // software fallback, while an IDR restarts cleanly. But accept a
              // CRA if no IDR arrives quickly — some streams have only CRA
              // keyframes for long stretches (seeking deep into a DoVi P8 .ts),
              // where waiting for an IDR never resumes and the video stays black.
              const idrWaitElapsed = elapsed > MoviPlayer.SEEK_IDR_WAIT_MS;
              // A CRA at/before the seek target IS the demuxer's restart point —
              // decode straight from it (pre-target frames are dropped by the
              // onFrame filter). The IDR-preference below only helps when a true
              // IDR sits within a few frames of the target; a CRA-only stream
              // has none, and skipping the target CRA then lets the demux loop
              // (which outruns the 400ms wall-clock IDR wait) race through the
              // whole file, skipping every CRA to EOF with no frame decoded →
              // permanent "buffering". So accept the target CRA outright rather
              // than hunt for an IDR that never arrives.
              const isTargetCra =
                packet.keyframe &&
                this.seekTargetTime !== -1 &&
                packet.timestamp <= this.seekTargetTime + 0.05;
              const acceptThisKeyframe =
                packet.keyframe && (packet.isIdr || idrWaitElapsed || isTargetCra);
              if (elapsed > MoviPlayer.KEYFRAME_SEEK_TIMEOUT) {
                Logger.warn(
                  TAG,
                  `Keyframe seek timeout after ${elapsed}ms, accepting any frame`,
                );
                this.seekingToKeyframe = false;
              } else if (!acceptThisKeyframe) {
                // Not yet: skip non-keyframes, and skip CRA keyframes while still
                // within the short IDR-wait window (hoping a true IDR is near).
                if (packet.keyframe) this.seekCraSeen++;
                continue;
              } else {
                // Found a keyframe to restart on (IDR, or a CRA after the wait).
                this.seekingToKeyframe = false;
                Logger.debug(
                  TAG,
                  `Found ${packet.isIdr ? "IDR" : "CRA"} keyframe after seek (craSkipped=${this.seekCraSeen}), resuming normal playback`,
                );
                this.seekCraSeen = 0;
              }
            }

            if (this.videoDecoder) {
              // Decode and render to canvas
              // Note: All packets including pre-target are decoded to build reference frames
              // The onFrame callback filters out frames before seekTargetTime
              this.videoDecoder.decode(
                packet.data,
                packet.timestamp,
                packet.keyframe,
                packet.dts,
                packet.isIdr,
                packet.isRasl,
              );
            }
          } else if (activeAudio && activeAudio.id === packet.streamIndex) {
            // Audio can be processed normally (doesn't need keyframes)
            // Skip audio processing if disabled for debugging
            if (!this.disableAudio) {
              // IMPORTANT: Skip audio packets before the seek target time
              if (
                this.seekTargetTime !== -1 &&
                packet.timestamp < this.seekTargetTime
              ) {
                continue;
              }

              // If waiting for video frame to ensure sync, buffer audio packets
              // (even when muted — needed for clock alignment to start at 0s)
              if (
                this.waitingForVideoSync &&
                this.trackManager.getActiveVideoTrack()
              ) {
                this.pendingAudioPackets.push(packet);
                continue;
              }

              // Decode audio even when muted. AudioRenderer keeps gain at 0 so
              // it stays silent, but the audio clock advances normally — without
              // this, unmute pivots firstBufferMediaTime to wherever the demuxer
              // is (~1-3s ahead of presentation due to video buffer), and the
              // drift correction in CanvasRenderer judders the video to chase it.

              if (
                this.seekTargetTime !== -1 &&
                packet.timestamp >= this.seekTargetTime
              ) {
                Logger.debug(
                  TAG,
                  `Audio reached seek target: ${packet.timestamp.toFixed(3)}s (target: ${this.seekTargetTime.toFixed(3)}s)`,
                );
                if (!this.trackManager.getActiveVideoTrack()) {
                  this.notifySeekCompletion(packet.timestamp);
                }
              }

              this.audioDecoder.decode(
                packet.data,
                packet.timestamp,
                packet.keyframe,
              );
            }
          } else {
            // Check for subtitle track
            const activeSubtitle = this.trackManager.getActiveSubtitleTrack();
            if (
              activeSubtitle &&
              activeSubtitle.id === packet.streamIndex &&
              this.subtitleDecoder
            ) {
              let duration = packet.duration;
              if (!duration || duration <= 0) {
                duration = 0;
                Logger.debug(
                  TAG,
                  `Subtitle packet has no duration, will use fallback: timestamp=${packet.timestamp.toFixed(3)}s`,
                );
              }
              Logger.debug(
                TAG,
                `Processing subtitle packet: stream=${packet.streamIndex}, size=${packet.data.length}, timestamp=${packet.timestamp.toFixed(3)}s, duration=${duration > 0 ? duration.toFixed(3) : "fallback"}s`,
              );
              this.subtitleDecoder
                .decode(
                  packet.data,
                  packet.timestamp,
                  packet.keyframe,
                  duration,
                )
                .catch((error) => {
                  Logger.error(TAG, "Subtitle decode error", error);
                });
            }
          }
        }
      }
    } catch (e) {
      Logger.error(TAG, "Demux error", e);

      // Check for fatal errors that indicate corrupted state
      const errorMessage = (e as any).message || "";
      // WASM-level traps. Once av_read_frame or any other FFmpeg entry
      // point dereferences past the heap, the entire WASM module is
      // unrecoverable — every subsequent ccall hits the same OOB. Without
      // this branch, processLoop classifies it as transient and retries
      // every ~17ms, flooding the console and pinning the CPU until the
      // user closes the tab.
      const isWasmFatal =
        /out of bounds memory access|memory access out of bounds|RuntimeError|Aborted\(\)/i.test(
          errorMessage,
        );
      const isCorruptError =
        isWasmFatal ||
        errorMessage.includes("Invalid packet size") ||
        errorMessage.includes("Invalid typed array length") ||
        errorMessage.includes("State may be corrupted");

      // Source-level failures (HTTP 4xx/5xx, exhausted retries, CORS, etc.)
      // surface through here as the demuxer reads its bytes from the source.
      // Without classifying these as fatal, processLoop just keeps retrying
      // the demux and the buffering spinner spins indefinitely with no
      // user-visible reason. The actual messages come from HttpSource —
      // see the strings it throws in startStream/buildHeaders.
      const isSourceError =
        /^HTTP \d{3}/.test(errorMessage) ||
        errorMessage.includes("Access denied") ||
        errorMessage.includes("Authentication required") ||
        errorMessage.includes("Video not found") ||
        errorMessage.includes("Failed to fetch video resource") ||
        errorMessage.includes("Stream failed after") ||
        errorMessage.includes("Server does not support range requests");

      if (isCorruptError || isSourceError) {
        Logger.error(
          TAG,
          isSourceError
            ? `Fatal source error, pausing playback: ${errorMessage}`
            : "Fatal demux error detected, pausing playback",
        );
        this.pause();
        this.stateManager.setState("error");
        this.emit(
          "error",
          isSourceError
            ? (e instanceof Error ? e : new Error(errorMessage))
            : new Error("Playback error: corrupt data stream"),
        );
        return; // Exit process loop
      }

      // For non-fatal errors, continue (transient network glitches, etc.)
    } finally {
      this.demuxInFlight = false;
    }
  };

  /**
   * Handle playback ended
   */
  private handleEnded(): void {
    Logger.info(TAG, "Playback ended");

    // Release WakeLock when playback ends
    this.releaseWakeLock();

    this.clock.pause();
    if (!this.disableAudio) {
      this.audioRenderer.pause();
    }

    // Stop video presentation loop
    if (this.videoRenderer) {
      this.videoRenderer.stopPresentationLoop();
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Snap time to end. Drop the keyframe-jump offset so getCurrentTime()
    // reports the true duration — otherwise open-GOP sources (where the
    // first decodable IDR is ~2s in) report end ~2s short of duration.
    //
    // Audio-only caveat: VBR MP3 / OGG / similar containers expose a
    // bitrate-derived duration that's typically overestimated by a few
    // seconds vs. the actual decoded sample count. Snapping to that
    // inflated duration makes the time-display jump forward at EOF and
    // makes the source look like it ended ~4s short of "done." For
    // audio-only sources, prefer the real last-scheduled audio media
    // time and update mediaInfo.duration so the seek bar matches.
    if (this.mediaInfo) {
      this.seekKeyframeOffset = 0;
      const hasVideo = !!this.trackManager?.getActiveVideoTrack?.();
      const audioEnd = this.audioRenderer.getMaxScheduledMediaTime?.() ?? 0;
      const useAudioEnd = !hasVideo && audioEnd > 0;
      const endTime = useAudioEnd ? audioEnd : this.mediaInfo.duration;
      if (useAudioEnd && Math.abs(audioEnd - this.mediaInfo.duration) > 0.1) {
        // Correct the cached duration so getDuration() and the timeline
        // both show the real value instead of the metadata estimate.
        this.mediaInfo.duration = audioEnd;
        this.clock.setDuration(audioEnd + this.startTime);
        this.emit("durationChange", audioEnd);
      }
      this.clock.seek(endTime + this.startTime);
      this.emit("timeUpdate", endTime);
    }

    this.stateManager.setState("ended");
    this.emit("ended", undefined);
  }

  /**
   * Seek to timestamp
   */
  private seekSessionId = 0;
  // The seek session whose completion is currently armed (waitingForVideoSync).
  // notifySeekCompletion bails when this no longer matches seekSessionId, so a
  // superseded seek's late frame/timeout can't stomp state or consume intent.
  private seekArmedSessionId = 0;
  private wasPlayingBeforeSeek = false;

  // True while an internal seek with no real interruption is in flight: the
  // initial poster seek(0), first play, and replay-from-ended. These route
  // through the full seek pipeline (flush + demuxer.seek + keyframe wait) so
  // the state machine briefly enters "seeking"/"buffering" even though, from
  // the user's view, nothing is loading. The UI reads this to keep the loading
  // spinner hidden during that window. Set via seek()'s suppressSpinner opt,
  // cleared on seek completion (notifySeekCompletion).
  suppressSeekSpinner = false;

  async seek(
    seconds: number,
    opts?: { suppressSpinner?: boolean; preservePlaying?: boolean },
  ): Promise<void> {
    if (this.streamWrapper) {
      return this.streamWrapper.seek(seconds);
    }

    // Native-audio-only (split-source data saver): no demuxer/decoder pipeline —
    // just move the <audio> element and the clock. No demuxer.seek (which would
    // start reading the video body we're skipping).
    if (this.nativeAudioOnlyPlayback() && this.nativeAudioEl) {
      const t = Math.max(0, Math.min(seconds, this.getDuration() || seconds));
      try { this.nativeAudioEl.currentTime = t; } catch {}
      this.clock.seek(t + this.startTime);
      this.seekKeyframeOffset = 0;
      this.eofReached = false;
      this.eofSince = 0;
      this.emit("seeking", t);
      this.emit("timeUpdate", t);
      this.emit("seeked", t);
      return;
    }

    // A genuine user seek (no opt) clears any leftover suppression so its
    // spinner shows; play()-initiated seeks pass suppressSpinner to hide it.
    this.suppressSeekSpinner = opts?.suppressSpinner ?? false;
    // preservePlaying: a corrective seek (e.g. rate change) that must NOT flip
    // the play/pause state. If we were playing — including mid-flight from a
    // prior corrective seek (state "seeking"/"buffering") — keep the resume
    // intent so completion lands back in "playing", never "paused".
    if (opts?.preservePlaying) {
      const s = this.stateManager.getState();
      if (s !== "paused" && s !== "ended") {
        this.wasPlayingBeforeSeek = true;
      }
    }

    const currentState = this.stateManager.getState();
    Logger.info(TAG, `seek(${seconds.toFixed(2)}): state=${currentState}, waitingForVideoSync=${this.waitingForVideoSync}, demuxInFlight=${this.demuxInFlight}, seekSessionId=${this.seekSessionId}`);

    // Safety check - though PlayerState now permits it
    if (!this.stateManager.canSeek()) {
      Logger.warn(TAG, `seek blocked: canSeek=false, state=${currentState}`);
      return;
    }

    if (!this.demuxer) {
      throw new Error("Demuxer not initialized");
    }

    // Stop pause-time buffering — seek invalidates stashed packets
    this.stopPauseBuffering();

    // Track intent: if we were playing (or already seeking but originally playing), we want to resume
    // During buffering, preserve the pre-buffering play/pause intent.
    // Don't clobber an explicit pre-seek resume intent (e.g. the replay path
    // sets wasPlayingBeforeSeek=true before calling seek(0) from the "ended"
    // state — "ended" isn't "playing", so re-deriving here would wrongly reset
    // it to false and seek completion would land paused instead of replaying).
    if (currentState !== "seeking" && !this.wasPlayingBeforeSeek) {
      this.wasPlayingBeforeSeek = currentState === "playing" || (currentState === "buffering" && this.wasPlayingBeforeRebuffer);
    }

    // Pause clock so UI time doesn't advance during seek while in loading state
    this.clock.pause();

    // Drop the keyframe-jump offset from the previous seek; it gets
    // re-measured when this seek completes.
    this.seekKeyframeOffset = 0;

    const mySessionId = ++this.seekSessionId;
    this.stateManager.setState("seeking");
    this.emit("seeking", seconds);

    // CRITICAL: Cancel any running processLoop immediately to prevent WASM async conflicts
    // This must happen before waiting for demuxInFlight, otherwise processLoop may start new async operations
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    try {
      // If demuxing is in flight, wait for it to avoid WASM/Asyncify corruption
      // We loop but also check session ID to abort early if a new seek started
      // Also reset demuxInFlight if this seek is superseded
      if (this.demuxInFlight) {
        let retries = 0;
        while (this.demuxInFlight && retries < 100) {
          if (this.seekSessionId !== mySessionId) {
            // This seek was superseded, reset demuxInFlight to allow new seek to proceed
            this.demuxInFlight = false;
            return; // Superceded
          }
          await new Promise((r) => setTimeout(r, 10));
          retries++;
        }
      }

      if (this.seekSessionId !== mySessionId) return; // Superceded

      // Flush decoders
      Logger.info(TAG, `seek: flushing video decoder...`);
      await this.videoDecoder.flush();
      Logger.info(TAG, `seek: flushing audio decoder...`);
      await this.audioDecoder.flush();
      Logger.info(TAG, `seek: decoders flushed`);

      // Clear video frame queue to prevent old frames from being displayed
      if (this.videoRenderer) {
        this.videoRenderer.clearQueue();
      }

      // Flush audio renderer (clears buffers)
      this.audioRenderer.reset();

      if (this.seekSessionId !== mySessionId) return; // Superceded

      // Seek relative to start time (time 0 in UI = startTime in media)
      Logger.info(TAG, `seek: demuxer.seek(${(seconds + this.startTime).toFixed(2)}) starting...`);
      await this.demuxer.seek(seconds + this.startTime);
      // Seek native audio element (separate audio source)
      if (this.nativeAudioEl) {
        this.nativeAudioEl.currentTime = seconds;
      }
      Logger.info(TAG, `seek: demuxer.seek done`);
      this.clock.seek(seconds + this.startTime);

      // Reset EOF flag after seek - we're now at a new position
      this.eofReached = false;
      this.eofSince = 0;

      // Buffered region restarts from the new position; drop the
      // monotonic clamp so the bar can shrink to reflect the new range.
      this.lastBufferedTime = 0;

      // Mark that we need to skip to keyframe after seek
      // This prevents decoder errors from non-keyframe packets after seek
      this.seekingToKeyframe = true;
      this.seekingToKeyframeStartTime = performance.now();
      this.seekCraSeen = 0;
      // A seek is a fresh keyframe-anchored start; any pending starve-induced
      // chain break is moot.
      this.videoChainBrokenUntilKeyframe = false;

      // IMPORTANT: Set seek target time for accurate seek positioning
      // FFmpeg seeks to the nearest keyframe BEFORE the target time,
      // so packets will have timestamps earlier than 'seconds'.
      // We need to skip audio packets before target and decode (but not display) video frames.
      // Normalize target time against startTime offset
      this.seekTargetTime = seconds + this.startTime;
      this.waitingForVideoSync = true;
      // Tag which seek session armed this completion. notifySeekCompletion
      // bails if a newer seek has since superseded this one, so a stale (e.g.
      // coalesced/rapid-seek) completion can't run the resume/paused branch and
      // consume wasPlayingBeforeSeek out from under the live seek — which
      // intermittently left rapid seeks stuck paused.
      this.seekArmedSessionId = mySessionId;
      this.pendingAudioPackets = [];
      // Stashed prebuffer packets are pre-seek and now stale
      this.pendingPrebufferPackets = [];

      // Enable post-seek throttling to prevent overwhelming low-end devices
      // BUT skip throttling when seeking within already-buffered data — the bytes
      // are already local so aggressive bursting won't cause network stalls.
      const seekInBufferedRange = this.isSeekTargetBuffered(seconds);
      if (seekInBufferedRange) {
        this.justSeeked = false;
        Logger.info(TAG, "Seek within buffered range — skipping post-seek throttle");
      } else {
        this.justSeeked = true;
      }
      this.seekTime = performance.now();

      if (this.seekSessionId !== mySessionId) return; // Superceded

      // Start processing loop to find and decode the target frame/packet.
      // notifySeekCompletion will be called once the first valid frame is received.
      Logger.info(TAG, `seek: starting processLoop, waitingForVideoSync=${this.waitingForVideoSync}, state=${this.stateManager.getState()}`);
      this.processLoop();

      // Ensure the video renderer loop is running to actually draw frames as they arrive
      if (this.videoRenderer) {
        this.videoRenderer.startPresentationLoop();
      }

      // Safety timeout: force seek completion if frames don't arrive in time.
      // Shorter timeout for buffered seeks since data is already local.
      const seekTimeoutMs = seekInBufferedRange ? 1500 : 3000;
      const seekTimeout = setTimeout(() => {
        if (this.seekSessionId === mySessionId && this.waitingForVideoSync) {
          Logger.warn(TAG, `Seek timeout after ${seekTimeoutMs}ms, forcing completion at ${seconds}s`);
          this.notifySeekCompletion(seconds + this.startTime, true);
        }
      }, seekTimeoutMs);

      // Clear timeout if seek completes or is superseded
      const clearSeekTimeout = () => {
        clearTimeout(seekTimeout);
        this.off("seeked", clearSeekTimeout);
      };
      this.on("seeked", clearSeekTimeout);

      Logger.info(TAG, `Seek initiated to ${seconds}s, waiting for sync...`);
    } catch (error) {
      // Reset seeking flag on error
      this.seekingToKeyframe = false;

      if (this.seekSessionId === mySessionId) {
        this.stateManager.setState("error");
        this.emit("error", error as Error);
      }
      throw error;
    }
  }

  /**
   * Check if seek target time falls within the already-buffered byte range.
   * Uses linear byte→time estimation (same as getBufferedTime).
   */
  private isSeekTargetBuffered(seekSeconds: number): boolean {
    if (!this.mediaInfo || !this.source || this.fileSize <= 0) return false;
    const duration = this.mediaInfo.duration;
    if (duration <= 0) return false;

    if (this.source instanceof FileSource) return true;

    if (this.source instanceof HttpSource) {
      // Entire file is in memory — every seek is local
      if (this.source.isFullyCached()) return true;

      const bufferStartBytes = this.source.getBufferStart();
      const bufferEndBytes = this.source.getBufferedEnd();
      // Convert seek target to estimated byte offset
      const seekRatio = Math.min(1, (seekSeconds + this.startTime) / (duration + this.startTime));
      const seekByteEstimate = seekRatio * this.fileSize;
      // Check if estimated byte position is within buffered window (with margin for keyframe before)
      const margin = this.fileSize * 0.02; // 2% margin for keyframe before target
      return seekByteEstimate >= bufferStartBytes - margin && seekByteEstimate <= bufferEndBytes;
    }

    // For other sources with getBufferedEnd
    if ("getBufferedEnd" in this.source) {
      const bufferEndBytes = (this.source as any).getBufferedEnd();
      if (bufferEndBytes > 0) {
        const seekRatio = Math.min(1, (seekSeconds + this.startTime) / (duration + this.startTime));
        const seekByteEstimate = seekRatio * this.fileSize;
        return seekByteEstimate <= bufferEndBytes;
      }
    }

    return false;
  }

  /**
   * Initialize WebGL context for thumbnail rendering
   */

  /**
   * Generates a preview frame for the given time using C-based FFmpeg software decoding.
   * Fast and doesn't block main playback.
   */
  /**
   * Generates a preview frame for the given time using C for demuxing and WebCodecs for decoding.
   */
  async getPreviewFrame(
    time: number,
    view?: VRView | null,
  ): Promise<Blob | null> {
    if (this._audioOnly) return null; // Data-saver: never decode video for previews
    if (!this.previewsAllowed()) return null; // Disabled, or source too large for a 2nd WASM context
    // Adaptive streams: use the manifest's own thumbnail track via Shaka
    // (DASH-IF tiled thumbnails / HLS image playlists). Returns null when the
    // manifest has no thumbnail track, so the preview just stays hidden — far
    // cheaper than the FFmpeg path, which can't byte-range-seek a stream.
    if (this.streamWrapper) return (this.streamWrapper as any).getThumbnailBlob?.(time) ?? null;
    if (this.previewInitGaveUp) return null; // Init failed repeatedly — stop retrying (and re-loading WASM)
    if (this.isPreviewGenerating) return null; // Busy
    // Audio-only sources have no video track to thumbnail. Bail early
    // so a hover on the seek bar doesn't trigger a "Thumbnail bindings
    // or renderer not available" error every time.
    if (!this.trackManager.getActiveVideoTrack()) return null;
    this.isPreviewGenerating = true;

    try {
      // Initialize thumbnail pipeline if needed
      if (!this.thumbnailBindings) {
        if (this.previewInitPromise) {
          Logger.debug(TAG, "Waiting for existing preview initialization...");
          try {
            await this.previewInitPromise;
          } catch {
            // Init failed, clear promise so retry can work
            this.previewInitPromise = null;
          }
        }
        // If still no bindings (init failed or promise was cleared), retry —
        // but cap attempts so a persistent failure doesn't re-load a fresh WASM
        // module on every seek-bar hover.
        if (!this.thumbnailBindings) {
          if (++this.previewInitAttempts > 3) {
            this.previewInitGaveUp = true;
            Logger.warn(TAG, "Thumbnail pipeline init failed repeatedly — disabling previews.");
            return null;
          }
          Logger.debug(TAG, "Initializing thumbnail pipeline (retry)...");
          this.previewInitPromise = this.initPreviewPipeline();
          try {
            await this.previewInitPromise;
          } catch {
            this.previewInitPromise = null;
          }
        }
      }

      if (!this.thumbnailBindings || !this.thumbnailRenderer) {
        Logger.warn(TAG, "Thumbnail bindings or renderer not available");
        return null;
      }

      // 360°: reproject the equirect keyframe to the current viewing angle so
      // the seek-bar preview matches what's on screen. Must be set BEFORE the
      // decode/render below — draw() happens synchronously inside the WebCodecs
      // output callback. Null (2D sources) keeps the flat passthrough path.
      this.thumbnailRenderer.setProjection(view ?? null);

      // Read keyframe from thumbnailer
      // Convert time to media time (PTS) by adding startTime
      const packetSize = await this.thumbnailBindings.readKeyframe(time);
      Logger.debug(
        TAG,
        `Thumbnail readKeyframe(${time.toFixed(2)}s): size=${packetSize}`,
      );

      if (packetSize <= 0) {
        // Suppress warning for expected errors like aborted reads (-6) or generic errors during rapid seeking
        if (packetSize !== -6) {
          Logger.warn(TAG, `Thumbnail read failed or empty: ${packetSize}`);
        }
        return null;
      }

      const timestamp = this.thumbnailBindings.getPacketPts();
      const dataPtr = this.thumbnailBindings.getPacketData();

      Logger.debug(
        TAG,
        `Thumbnail packet: pts=${timestamp.toFixed(2)}s, ptr=${dataPtr}, size=${packetSize}`,
      );

      if (!dataPtr) {
        Logger.warn(TAG, "Thumbnail packet data pointer is null");
        return null;
      }

      // Get packet data from the ISOLATED thumbnail module (not main module!)
      const packetData = this.thumbnailBindings.getPacketDataCopy(packetSize);
      if (!packetData) {
        Logger.warn(TAG, "Failed to copy thumbnail packet data");
        return null;
      }

      // 1. Try WebCodecs (Hardware) through Renderer
      let rendered = false;

      try {
        rendered = await this.thumbnailRenderer!.decodeAndRender(
          packetData,
          timestamp,
        );
      } catch (e) {
        Logger.warn(TAG, "Thumbnail WebCodecs decode failed", e);
      }

      /* REMOVED OLD LOGIC START
              const videoTrack = this.mediaInfo?.tracks?.find(
                (t) => t.type === "video",
              ) as VideoTrack | undefined;
              const aspect =
                videoTrack?.width && videoTrack?.height
                  ? videoTrack.width / videoTrack.height
                  : 16 / 9;
              const width = 320;
              const height = Math.round(width / aspect);

              const rgba = this.thumbnailBindings!.decodeCurrentPacket(
                width,
                height,
              );

              if (rgba && rgba.length > 0) {
                if (!this.thumbnailCanvas) {
                  if (typeof OffscreenCanvas !== "undefined") {
                    this.thumbnailCanvas = new OffscreenCanvas(width, height);
                  } else {
                    this.thumbnailCanvas = document.createElement("canvas");
                    this.thumbnailCanvas.width = width;
                    this.thumbnailCanvas.height = height;
                  }
                  this.thumbnailContext = this.thumbnailCanvas.getContext(
                    "2d",
                    { alpha: false, willReadFrequently: true },
                  ) as any;
                }

                if (
                  this.thumbnailCanvas!.width !== width ||
                  this.thumbnailCanvas!.height !== height
                ) {
                  this.thumbnailCanvas!.width = width;
                  this.thumbnailCanvas!.height = height;
                }

                // Draw software pixels
                const imageData = new ImageData(
                  new Uint8ClampedArray(rgba),
                  width,
                  height,
                );
                this.thumbnailContext!.putImageData(imageData, 0, 0);

                // Convert to Blob
                if (this.thumbnailCanvas instanceof OffscreenCanvas) {
                  (this.thumbnailCanvas as OffscreenCanvas)
                    .convertToBlob({ type: "image/jpeg", quality: 0.7 })
                    .then((blob) => {
                      // Free C-side RGB buffer after blob creation
                      this.thumbnailBindings?.clearBuffer();
                      resolve(blob);
                    });
                } else {
                  (this.thumbnailCanvas as HTMLCanvasElement).toBlob(
                    (blob) => {
                      // Free C-side RGB buffer after blob creation
                      this.thumbnailBindings?.clearBuffer();
                      resolve(blob);
                    },
                    "image/jpeg",
                    0.7,
                  );
                }
              } else {
                Logger.warn(TAG, "Software fallback returned no data");
                resolve(null);
              }
            } catch (e) {
              Logger.error(TAG, "Software fallback exception", e);
              resolve(null);
            }
          }
        }, 500); // Fast timeout for fallback

        this.thumbnailDecoder?.setOnFrame((frame) => {
          if (resolved) {
            frame.close();
            return;
          }

          Logger.debug(
            TAG,
            `Thumbnail frame received: ${frame.codedWidth}x${frame.codedHeight}`,
          );

          // 3. Render VideoFrame to Canvas using WebGL (with HDR support)
          const videoTrack = this.mediaInfo?.tracks?.find(
            (t) => t.type === "video",
          ) as VideoTrack | undefined;
          const rotation = videoTrack?.rotation || 0;
          const isRotated = rotation % 180 !== 0;

          // Use display dimensions
          const frameW = frame.displayWidth;
          const frameH = frame.displayHeight;
          const canvasW = isRotated ? frameH : frameW;
          const canvasH = isRotated ? frameW : frameH;

          // Create canvas if needed
          if (!this.thumbnailCanvas) {
            if (typeof OffscreenCanvas !== "undefined") {
              this.thumbnailCanvas = new OffscreenCanvas(canvasW, canvasH);
            } else {
              this.thumbnailCanvas = document.createElement("canvas");
              this.thumbnailCanvas.width = canvasW;
              this.thumbnailCanvas.height = canvasH;
            }

            // Try to initialize WebGL with HDR support
            const colorSpace = this.detectThumbnailHDRColorSpace();
            const webglInitialized = this.initThumbnailWebGL(
              this.thumbnailCanvas,
              colorSpace,
            );

            // Fallback to 2D if WebGL fails
            if (!webglInitialized) {
              this.thumbnailContext = this.thumbnailCanvas.getContext("2d", {
                alpha: false,
                willReadFrequently: true,
              }) as any;
            }
          }

          // Resize canvas if dimensions changed
          if (
            this.thumbnailCanvas.width !== canvasW ||
            this.thumbnailCanvas.height !== canvasH
          ) {
            this.thumbnailCanvas.width = canvasW;
            this.thumbnailCanvas.height = canvasH;

            // Re-initialize WebGL if it was being used
            if (this.thumbnailGL) {
              const colorSpace = this.detectThumbnailHDRColorSpace();
              this.initThumbnailWebGL(this.thumbnailCanvas, colorSpace);
            }
          }

          // When rotated, ensure 2D context exists (WebGL path doesn't handle rotation)
          if (rotation !== 0 && !this.thumbnailContext && this.thumbnailCanvas) {
            this.thumbnailContext = this.thumbnailCanvas.getContext("2d", {
              alpha: false,
              willReadFrequently: true,
            }) as any;
          }

          // Render using WebGL if available (skip WebGL when rotated — 2D handles rotation)
          if (
            rotation === 0 &&
            this.thumbnailGL &&
            this.thumbnailGLProgram &&
            this.thumbnailGLTexture &&
            this.thumbnailGLVao
          ) {
            try {
              const gl = this.thumbnailGL;

              // Setup viewport
              gl.viewport(0, 0, canvasW, canvasH);
              gl.clearColor(0, 0, 0, 1);
              gl.clear(gl.COLOR_BUFFER_BIT);

              // Bind program and VAO
              gl.useProgram(this.thumbnailGLProgram);
              gl.bindVertexArray(this.thumbnailGLVao);

              // Upload frame to texture
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, this.thumbnailGLTexture);
              gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                frame,
              );

              // Draw
              gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

              Logger.debug(
                TAG,
                `Thumbnail rendered with WebGL (HDR: ${this.thumbnailHDREnabled})`,
              );
            } catch (e) {
              Logger.warn(
                TAG,
                "WebGL thumbnail rendering failed, falling back to 2D",
                e,
              );
              // Fallback to 2D rendering
              if (this.thumbnailContext) {
                if (rotation !== 0) {
                  this.thumbnailContext.save();
                  this.thumbnailContext.translate(canvasW / 2, canvasH / 2);
                  this.thumbnailContext.rotate((rotation * Math.PI) / 180);
                  this.thumbnailContext.drawImage(
                    frame,
                    -frameW / 2,
                    -frameH / 2,
                    frameW,
                    frameH,
                  );
                  this.thumbnailContext.restore();
                } else {
                  this.thumbnailContext.drawImage(frame, 0, 0, frameW, frameH);
                }
              }
            }
          } else {
            // Use 2D canvas as fallback
            if (rotation !== 0 && this.thumbnailContext) {
              this.thumbnailContext.save();
              this.thumbnailContext.translate(canvasW / 2, canvasH / 2);
              this.thumbnailContext.rotate((rotation * Math.PI) / 180);
              this.thumbnailContext.drawImage(
                frame,
                -frameW / 2,
                -frameH / 2,
                frameW,
                frameH,
              );
              this.thumbnailContext.restore();
            } else {
              this.thumbnailContext?.drawImage(frame, 0, 0, frameW, frameH);
            }
          }

          frame.close();
          resolved = true;
          clearTimeout(timeout);

          // 4. Convert to Blob
          if (this.thumbnailCanvas instanceof OffscreenCanvas) {
            (this.thumbnailCanvas as OffscreenCanvas)
              .convertToBlob({ type: "image/jpeg", quality: 0.7 })
              .then((blob) => {
                Logger.debug(
                  TAG,
                  `Thumbnail blob created: ${blob?.size} bytes`,
                );
                // Free C-side RGB buffer (if software fallback was used)
                this.thumbnailBindings?.clearBuffer();
                resolve(blob);
              });
          } else {
            (this.thumbnailCanvas as HTMLCanvasElement).toBlob(
              (blob) => {
                Logger.debug(
                  TAG,
                  `Thumbnail blob created: ${blob?.size} bytes`,
                );
                // Free C-side RGB buffer (if software fallback was used)
                this.thumbnailBindings?.clearBuffer();
                resolve(blob);
              },
              "image/jpeg",
              0.7,
            );
          }
        });

      REMOVED OLD LOGIC END */

      // 2. Fallback to Software Decoding
      if (!rendered) {
        try {
          // Get width/height from active video track
          const videoTrack = this.trackManager.getActiveVideoTrack();
          let width = 320; // Default small
          let height = 180;

          if (videoTrack) {
            width = videoTrack.width;
            height = videoTrack.height;
          }

          const rgba = this.thumbnailBindings!.decodeCurrentPacket(
            width,
            height,
          );
          if (rgba && rgba.length > 0) {
            this.thumbnailRenderer!.render(rgba, width, height);
            this.thumbnailBindings!.clearBuffer();
            rendered = true;
          } else {
            Logger.warn(TAG, "Software thumbnail decoder returned no data");
          }
        } catch (e) {
          Logger.error(TAG, "Software thumbnail fallback exception", e);
        }
      }

      if (rendered) {
        const canvas = this.thumbnailRenderer!.getCanvas();
        if ("toBlob" in canvas) {
          return new Promise<Blob | null>((resolve) => {
            // @ts-ignore
            canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
          });
        }
        // If OffscreenCanvas (unlikely here but possible if strict types used)
        if ("convertToBlob" in canvas) {
          // @ts-ignore
          return await canvas.convertToBlob({
            type: "image/jpeg",
            quality: 0.7,
          });
        }
      }

      return null;
    } catch (e) {
      Logger.warn(TAG, "Preview generation failed", e);
      return null;
    } finally {
      this.isPreviewGenerating = false;
      // Clear ThumbnailHttpSource buffer to free memory (512KB)
      // This clears the buffer after each thumbnail generation
      if (this.thumbnailSource && "clearBuffer" in this.thumbnailSource) {
        (this.thumbnailSource as any).clearBuffer();
      }
    }
  }

  /**
   * Generate timeline thumbnails at regular intervals
   * @param count Number of thumbnails to generate (default 8)
   * @param onProgress Callback for each generated thumbnail
   * @returns Array of { time, blob } objects
   */
  async generateTimeline(
    count: number = 8,
    onProgress?: (index: number, total: number, blob: Blob, time: number) => void
  ): Promise<Array<{ time: number; blob: Blob }>> {
    const duration = this.mediaInfo?.duration ?? 0;
    if (duration <= 0) return [];

    const results: Array<{ time: number; blob: Blob }> = [];
    const interval = duration / (count + 1); // Avoid first/last frames

    for (let i = 1; i <= count; i++) {
      const time = interval * i;
      const blob = await this.getPreviewFrame(time);
      if (blob) {
        results.push({ time, blob });
        onProgress?.(i, count, blob, time);
      }
    }

    return results;
  }

  private async initPreviewPipeline() {
    if (this.thumbnailBindings) return; // Already initialized

    Logger.debug(TAG, "Initializing thumbnail pipeline...");
    // Use a NEW isolated WASM module instance for thumbnails
    // This prevents onReadRequest handler conflicts with main playback
    const module = await loadWasmModuleNew({
      wasmBinary: this.config.wasmBinary,
    });
    Logger.debug(TAG, "Isolated WASM module loaded for thumbnails");

    // Encrypted playback: reuse the main EncryptedHttpSource for thumbnails.
    // A 2nd EncryptedHttpSource spins up an independent ECDH handshake +
    // token-signed GETs, which the server treats as concurrent sessions;
    // observed server behavior is 206 responses with truncated/empty
    // bodies (seen as "Stream ended before block N" errors) when both
    // instances fetch overlapping ranges. Sharing the main source also
    // makes thumbnail reads free once the block is in the main source's
    // block cache — no extra network at all for near-playhead previews.
    const sourceConfig = this.config.source;
    const isEncrypted = sourceConfig
      && typeof sourceConfig !== "string"
      && (sourceConfig as any).type === "encrypted";
    // Custom user-supplied adapter — we can't safely spin up a second reader
    // (we don't know the underlying protocol), so reuse the main source.
    // The user's read() must tolerate interleaved offsets in this case.
    if (this.config.sourceAdapter && this.source) {
      this.thumbnailSource = this.source;
    } else if (isEncrypted && this.source) {
      this.thumbnailSource = this.source;
    } else {
      // Plain HTTP / URL sources: use a dedicated ThumbnailHttpSource that
      // borrows (read-only) from the main source's metadata LRU +
      // sliding-window buffer, only fetching on miss.
      const borrowSource =
        this.source &&
        typeof (this.source as any).peekMetadata === "function" &&
        typeof (this.source as any).peekRange === "function"
          ? (this.source as any)
          : null;
      if (typeof sourceConfig === "string") {
        this.thumbnailSource = new ThumbnailHttpSource(sourceConfig, {}, borrowSource);
      } else if (sourceConfig && "url" in sourceConfig && sourceConfig.url) {
        this.thumbnailSource = new ThumbnailHttpSource(
          sourceConfig.url,
          sourceConfig.headers || {},
          borrowSource,
        );
      } else if (sourceConfig) {
        // File source
        this.thumbnailSource = await this.createSource(sourceConfig);
      } else if (this.source) {
        // No SourceConfig (custom adapter path) — fall back to main source.
        this.thumbnailSource = this.source;
      } else {
        throw new Error("No source available for thumbnail pipeline");
      }
      // Reuse the size the main source already resolved — a dedicated
      // ThumbnailHttpSource can't probe it on a non-range server (HEAD strips
      // Content-Length, the 200 GET may be chunked), which used to fail init.
      if (
        this.fileSize > 0 &&
        this.thumbnailSource &&
        "seedSize" in this.thumbnailSource &&
        typeof (this.thumbnailSource as { seedSize?: unknown }).seedSize === "function"
      ) {
        (this.thumbnailSource as { seedSize: (n: number) => void }).seedSize(this.fileSize);
      }
    }

    const fileSize = await this.thumbnailSource.getSize();
    Logger.debug(TAG, `Thumbnail source created, file size: ${fileSize}`);

    // Create thumbnail bindings
    this.thumbnailBindings = new ThumbnailBindings(module);

    const dataAdapter = {
      read: async (offset: number, size: number): Promise<Uint8Array> => {
        if (!this.thumbnailSource) throw new Error("No thumbnail source");
        const buffer = await this.thumbnailSource.read(offset, size);
        return new Uint8Array(buffer);
      },
      getSize: async (): Promise<number> => {
        if (!this.thumbnailSource) throw new Error("No thumbnail source");
        return this.thumbnailSource.getSize();
      },
    };
    this.thumbnailBindings.setDataSource(dataAdapter);

    const created = await this.thumbnailBindings.create(fileSize);
    Logger.debug(TAG, `Thumbnail context create result: ${created}`);
    if (!created) throw new Error("Failed to create thumbnail context");

    const opened = await this.thumbnailBindings.open();
    Logger.debug(TAG, `Thumbnail context open result: ${opened}`);
    if (!opened) throw new Error("Failed to open thumbnail media");

    // Initialize Renderer
    this.thumbnailRenderer = new ThumbnailRenderer();

    let videoTrack = this.trackManager.getActiveVideoTrack();
    if (!videoTrack) {
      const tracks = this.trackManager.getVideoTracks();
      if (tracks.length > 0) videoTrack = tracks[0];
    }

    if (videoTrack) {
      // Initialize renderer dimensions and HDR settings
      this.thumbnailRenderer.initialize({
        width: videoTrack.width,
        height: videoTrack.height,
        rotation: videoTrack.rotation || 0,
        colorPrimaries: videoTrack.colorPrimaries,
        colorTransfer: videoTrack.colorTransfer,
        hdrEnabled: this.thumbnailHDREnabled,
      });

      // Configure internal VideoDecoder
      const extradata = this.demuxer?.getExtradata(videoTrack.id) ?? null;

      Logger.debug(
        TAG,
        `Configuring thumbnail decoder with track: ${videoTrack.codec}, extradata: ${extradata ? extradata.length : 0} bytes`,
      );
      const configured = await this.thumbnailRenderer.configureDecoder(
        videoTrack.codec,
        extradata, // can be null
        videoTrack.width,
        videoTrack.height,
        videoTrack.profile,
        videoTrack.level,
      );

      if (!configured) {
        Logger.warn(
          TAG,
          "Failed to configure thumbnail VideoDecoder, will use software fallback",
        );
      }
    } else {
      Logger.warn(TAG, "No video track found for thumbnail renderer");
    }

    Logger.debug(TAG, "Thumbnail pipeline initialized successfully");
  }

  private destroyPreviewPipeline() {
    if (this.thumbnailBindings) {
      this.thumbnailBindings.destroy();
      this.thumbnailBindings = null;
    }

    if (this.thumbnailRenderer) {
      this.thumbnailRenderer.destroy();
      this.thumbnailRenderer = null;
    }

    this.thumbnailSource = null;
  }

  /**
   * Get all tracks
   */
  getTracks(): Track[] {
    return this.trackManager.getTracks();
  }

  /**
   * Get video tracks
   */
  getVideoTracks(): VideoTrack[] {
    return this.trackManager.getVideoTracks();
  }

  /**
   * Get audio tracks
   */
  getAudioTracks(): AudioTrack[] {
    return this.trackManager.getAudioTracks();
  }

  /**
   * Get subtitle tracks
   */
  getSubtitleTracks(): SubtitleTrack[] {
    return this.trackManager.getSubtitleTracks();
  }

  /**
   * Select audio track
   */
  selectAudioTrack(trackId: number): boolean {
    return this.trackManager.selectAudioTrack(trackId);
    // Note: change event listeners above will reconfigure decoder
  }

  /**
   * Route audio output to a specific device (AudioContext.setSinkId).
   * "" → system default. Returns false when unsupported / device gone.
   */
  setAudioOutputDevice(deviceId: string): Promise<boolean> {
    return this.audioRenderer.setSinkId(deviceId);
  }

  /** Current audio output device id ("" = system default). */
  getAudioOutputDevice(): string {
    return this.audioRenderer.getSinkId();
  }

  /**
   * Select subtitle track
   */
  async selectSubtitleTrack(trackId: number | null): Promise<boolean> {
    Logger.info(TAG, `selectSubtitleTrack called: trackId=${trackId}`);
    const result = this.trackManager.selectSubtitleTrack(trackId);
    Logger.debug(TAG, `TrackManager.selectSubtitleTrack returned: ${result}`);

    // Track changed — invalidate any prefetched cue list so the next
    // setSubtitleDelay re-scans the new stream.
    if (this.prefetchedSubtitleStream !== trackId) {
      this.prefetchedSubtitleStream = null;
    }

    // Clear subtitles when track is deselected
    if (trackId === null) {
      Logger.info(TAG, "Disabling subtitles");
      if (this.videoRenderer) {
        this.videoRenderer.clearSubtitles();
        Logger.debug(TAG, "Cleared subtitles from video renderer");
      }
      if (this.subtitleDecoder) {
        this.subtitleDecoder.close();
        Logger.debug(TAG, "Closed subtitle decoder");
      }
      return result;
    }

    // Adaptive streams: Shaka/hls.js already applied the text-track selection
    // (via the trackManager → streamWrapper wiring) and renders cues itself.
    if (this.streamWrapper) {
      if (trackId !== null) {
        this.stopExternalSubtitles();
        this._activeExternalSubtitleId = "";
        if (this.presentationMode === "native" && !this.videoRenderer) {
          this.setNativeExternalTextTracks(null);
        }
      }
      return result;
    }

    // Configure decoder for new subtitle track
    if (this.demuxer && this.subtitleDecoder) {
      const subtitleTrack = this.trackManager.getActiveSubtitleTrack();
      Logger.info(
        TAG,
        `Configuring subtitle decoder for track: id=${subtitleTrack?.id}, codec=${subtitleTrack?.codec}, type=${subtitleTrack?.subtitleType}`,
      );

      if (subtitleTrack) {
        // Close previous decoder before configuring new one (helps with track switching)
        Logger.debug(
          TAG,
          "Closing previous subtitle decoder before switching tracks",
        );
        this.subtitleDecoder.close();

        // Set bindings first (required for configure)
        const bindings = this.demuxer.getBindings();
        if (bindings) {
          Logger.debug(TAG, "Setting bindings on subtitle decoder");
          this.subtitleDecoder.setBindings(bindings, false);
        } else {
          Logger.warn(TAG, "No bindings available from demuxer!");
        }

        const extradata =
          this.demuxer.getExtradata(subtitleTrack.id) ?? undefined;
        Logger.debug(
          TAG,
          `Configuring subtitle decoder: extradata=${extradata?.length || 0} bytes`,
        );
        const configured = await this.subtitleDecoder.configure(
          subtitleTrack,
          extradata,
        );
        Logger.info(
          TAG,
          `Subtitle decoder configuration result: ${configured}`,
        );

        if (configured) {
          // Set up subtitle cue callback
          Logger.debug(TAG, "Setting up subtitle cue callback");
          this.subtitleDecoder.setOnCue((cue) => {
            Logger.debug(
              TAG,
              `Subtitle cue callback triggered: "${cue.text?.substring(0, 30)}..." (${cue.start.toFixed(2)}s - ${cue.end.toFixed(2)}s)`,
            );
            if (this.videoRenderer) {
              Logger.debug(TAG, "Setting subtitle cue on video renderer");
              this.videoRenderer.setSubtitleCues([cue]);
            } else {
              Logger.warn(TAG, "Subtitle cue callback: videoRenderer is null!");
            }
          });

          // TODO: Seek to re-read subtitle packets causes playback disruption
          // const currentTime = this.getCurrentTime();
          // Logger.debug(TAG, `Seeking to ${currentTime.toFixed(2)}s to pick up subtitle packets`);
          // this.seek(currentTime).catch(() => {});

          // If a non-zero subtitle delay is already configured (e.g. set
          // before the track was selected, or persisted via attribute),
          // prefetch the full cue list now so the renderer has
          // out-of-order cues available immediately.
          if (this.videoRenderer && this.videoRenderer.getSubtitleDelay() !== 0) {
            void this.prefetchActiveSubtitleStream();
          }
        } else {
          Logger.warn(
            TAG,
            `Could not configure subtitle decoder for track ${subtitleTrack.id} (${subtitleTrack.codec}) - codec may not be available in WASM build`,
          );
          // If decoder configuration failed, deselect the track since we can't decode it
          this.trackManager.selectSubtitleTrack(-1);
          return false;
        }
      } else {
        Logger.warn(
          TAG,
          `No active subtitle track found after selecting trackId ${trackId}`,
        );
      }
    } else {
      Logger.warn(
        TAG,
        `Cannot configure subtitle decoder: demuxer=${!!this.demuxer}, subtitleDecoder=${!!this.subtitleDecoder}`,
      );
    }

    return result;
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (this.streamWrapper) {
      return this.streamWrapper.getCurrentTime();
    }
    // Subtract seekKeyframeOffset so the timeline reports the user-requested
    // time after a seek instead of where the decoder actually landed (which
    // can be seconds later on long-GOP containers like .ts). Offset is reset
    // on every new seek and only ever non-negative.
    return Math.max(
      0,
      this.clock.getTime() - this.startTime - this.seekKeyframeOffset,
    );
  }

  /**
   * After a `postertime` seek has painted the poster frame on the canvas,
   * reset only the CLOCK/playhead bookkeeping back to the start — WITHOUT
   * flushing the decoder, re-seeking the demuxer, or clearing the renderer
   * queue. That keeps the poster frame (from ~postertime) visible on the
   * canvas while the seek bar/getCurrentTime() read 0, and lets the first
   * play() start cleanly from the beginning (play()'s first-play branch
   * re-seeks the demuxer to 0 itself). Pure time-math; touches no media state.
   */
  resetClockToStartForPoster(): void {
    if (this.streamWrapper) return; // HLS owns its own timeline
    this.clock.seek(this.startTime); // paused → pausedTime = startTime
    this.seekKeyframeOffset = 0; // so getCurrentTime() === 0
    this.seekTargetTime = -1; // clear any lingering pre-target frame-drop filter
    this.waitingForVideoSync = false; // no stale seek-completion armed
    this._playStartTime = 0; // keep first-play branch eligible
    this._primingAudio = false;
    this.pendingAudioPackets = []; // poster-era audio is stale; play() re-seeks
    this.pendingPrebufferPackets = [];
    // The poster seek advanced HttpSource's monotonic buffered-end to ~poster
    // time; reset it (as a real seek does) so the buffer bar starts from 0
    // instead of showing a false prebuffer at the poster timestamp.
    this.lastBufferedTime = 0;
    this.emit("timeUpdate", this.getCurrentTime()); // snap seek bar to 00:00
  }

  /**
   * Get duration
   */
  getDuration(): number {
    if (this.streamWrapper) {
      return this.streamWrapper.getDuration();
    }
    return this.mediaInfo?.duration ?? 0;
  }

  /**
   * Get LRU cache statistics
   */
  getCacheStats(): {
    utilization: number;
    sizeBytes: number;
    maxSizeBytes: number;
    entryCount: number;
  } {
    return {
      utilization: this.cache.getUtilization(),
      sizeBytes: this.cache.getSize(),
      maxSizeBytes: this.cache.getMaxSize(),
      entryCount: this.cache.getEntryCount(),
    };
  }

  /**
   * Get cached time ranges for visualization
   * Converts cached byte ranges to time ranges
   * @returns Array of {start, end} time ranges in seconds
   */
  getCachedTimeRanges(): Array<{ start: number; end: number }> {
    if (!this.source || !this.mediaInfo || this.fileSize <= 0) {
      return [];
    }

    const sourceKey = this.source.getKey();
    const byteRanges = this.cache.getCachedRanges(sourceKey);
    const duration = this.mediaInfo.duration;

    if (duration <= 0) {
      return [];
    }

    // Convert byte ranges to time ranges using linear estimation
    const timeRanges: Array<{ start: number; end: number }> = [];

    for (const range of byteRanges) {
      const startRatio = range.offset / this.fileSize;
      const endRatio = (range.offset + range.length) / this.fileSize;

      const start = Math.max(0, Math.min(duration, startRatio * duration));
      const end = Math.max(0, Math.min(duration, endRatio * duration));

      if (end > start) {
        timeRanges.push({ start, end });
      }
    }

    return timeRanges;
  }

  /**
   * Get current state
   */
  getState(): PlayerState {
    if (this.streamWrapper) {
      return this.streamWrapper.getState();
    }
    return this.stateManager.getState();
  }

  /**
   * Intended playback state, independent of transient interruptions.
   *
   * The raw state flips to "buffering"/"seeking" while the user is still
   * mid-playback (network stall, internal seek), which would otherwise make
   * the UI's play/pause icon flicker to "play" even though the user never
   * paused. This returns true whenever playback is meant to be running —
   * actually "playing", or interrupted by a buffer/seek that we entered
   * from a playing state (tracked via wasPlayingBeforeRebuffer/Seek). Use
   * this to drive the play/pause icon so it stays stable through stalls.
   */
  isPlaybackIntended(): boolean {
    const state = this.getState();
    if (state === "playing") return true;
    if (
      (state === "buffering" || state === "seeking") &&
      (this.wasPlayingBeforeRebuffer || this.wasPlayingBeforeSeek)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Get media info
   */
  /**
   * Load an encrypted video source
   * Reconfigures the player with an EncryptedHttpSource
   */
  async loadEncrypted(config: {
    videoUrl: string;
    tokenUrl: string;
    videoId: string;
    fingerprint: string;
    sessionToken: string;
    tokenRefreshInterval?: number;
    onAuthFailed?: (reason: string) => void;
  }): Promise<void> {
    this.config.source = {
      type: "encrypted",
      encrypted: config,
    };
    await this.load();
  }

  getMediaInfo(): MediaInfo | null {
    return this.mediaInfo;
  }

  getContentDispositionFilename(): string | null {
    if (this.source instanceof HttpSource) {
      return this.source.getContentDispositionFilename();
    }
    return null;
  }

  getMetadataTitle(): string | null {
    return this.mediaInfo?.metadata?.title ?? null;
  }

  /**
   * Get native stream/progressive video element for light-DOM presentation.
   */
  getHLSVideoElement(): HTMLVideoElement | null {
    return this.streamWrapper?.getVideoElement() ?? null;
  }

  getNativeVideoElement(): HTMLVideoElement | null {
    return this.getHLSVideoElement();
  }

  getPresentationMode(): PresentationMode {
    return this.presentationMode;
  }

  canCast(): boolean {
    return this.presentationMode === "native" && this.streamWrapper !== null;
  }

  setExternalQualities(qualities: ExternalQualityEntry[]): void {
    this.externalQualities = [...qualities];
    this.emit("tracksChange", this.trackManager.getTracks());
  }

  getExternalQualities(): ExternalQualityEntry[] {
    return [...this.externalQualities];
  }

  setChapterMarkers(chapters: ChapterMarker[]): void {
    this.externalChapterMarkers = [...chapters];
  }

  getChapterMarkers(): ChapterMarker[] {
    return [...this.externalChapterMarkers];
  }

  /**
   * Get chapters from the media (empty array if none)
   */
  getChapters(): Array<{ title: string; start: number; end: number }> {
    if (this.externalChapterMarkers.length > 0) {
      return this.externalChapterMarkers.map((ch, i, arr) => ({
        title: ch.title,
        start: ch.start,
        end: ch.end ?? (i < arr.length - 1 ? arr[i + 1].start : this.getDuration()),
      }));
    }
    return this.mediaInfo?.chapters ?? [];
  }

  resizeCanvas(width: number, height: number): void {
    if (this.streamWrapper && "resizeCanvas" in this.streamWrapper) {
      this.streamWrapper.resizeCanvas(width, height);
    }
    if (this.videoRenderer) {
      this.videoRenderer.resize(width, height);
    }
    // A resize often coincides with a fullscreen / orientation / PiP change —
    // a good moment to recover a wake lock that dropped or whose first request
    // failed. Idempotent: no-op when already held / not playing / page hidden.
    this.ensureWakeLock();
  }

  /**
   * Set HDR enabled state
   */
  setHDREnabled(enabled: boolean): void {
    this.thumbnailHDREnabled = enabled;
    if (this.videoRenderer && (this.videoRenderer as any).setHDREnabled) {
      (this.videoRenderer as any).setHDREnabled(enabled);
    }

    if (this.thumbnailRenderer) {
      this.thumbnailRenderer.setHDREnabled(enabled);
    }

    // For non-Chromium browsers with tone mapping shader, just update the uniform
    // No need to recreate the entire context
    /* Manual WebGL update logic removed */
  }

  /**
   * Check if current media is HDR
   */
  isHDRSupported(): boolean {
    if (this.videoRenderer && (this.videoRenderer as any).isHDRSupported) {
      return (this.videoRenderer as any).isHDRSupported();
    }
    return false;
  }

  /**
   * Set subtitle overlay element for HTML-based subtitle rendering
   */
  setSubtitleOverlay(overlay: HTMLElement | null): void {
    if (this.videoRenderer) {
      this.videoRenderer.setSubtitleOverlay(overlay);
    }
  }

  /**
   * Set extra bottom padding for subtitles when controls are visible
   */
  setSubtitleControlsPadding(padding: number): void {
    if (this.videoRenderer) {
      this.videoRenderer.setSubtitleControlsPadding(padding);
    }
  }

  /**
   * Rotate video 90 degrees clockwise
   */
  rotateVideo(): number {
    if (this.videoRenderer) {
      return this.videoRenderer.rotate90();
    }
    return 0;
  }

  /**
   * The currently-displayed decoded VideoFrame, or null. Fallback capture
   * source for snapshots when the WebGL canvas reads back blank.
   */
  getCurrentVideoFrame(): VideoFrame | null {
    return this.videoRenderer?.getCurrentFrame() ?? null;
  }

  /**
   * Get current video rotation
   */
  getVideoRotation(): number {
    return this.videoRenderer?.getRotation() ?? 0;
  }

  setVideoRotation(deg: number): void {
    this.videoRenderer?.setManualRotation(deg);
  }

  setFitMode(mode: "contain" | "cover" | "fill" | "zoom" | "control"): void {
    if (this.streamWrapper) {
      this.streamWrapper.setFitMode(mode);
    }
    if (this.videoRenderer) {
      this.videoRenderer.setFitMode(mode);
    }
  }

  setLetterboxColor(r: number, g: number, b: number): void {
    if (this.videoRenderer) {
      this.videoRenderer.setLetterboxColor(r, g, b);
    }
  }

  // ───────────────────────── 360° VR ─────────────────────────

  /** Enable/disable 360° equirectangular projection on the video renderer. */
  setVR360(enabled: boolean): void {
    this.videoRenderer?.setVR360(enabled);
  }

  isVR360Enabled(): boolean {
    return this.videoRenderer?.isVR360Enabled() ?? false;
  }

  /** Live 360° camera + projection snapshot for reprojecting seek-bar previews
   *  to the current view. Null when not in 360. */
  getVR360View(): VRView | null {
    return this.videoRenderer?.getVRView() ?? null;
  }

  /** Select the VR projection/layout: half = VR180, fisheye = equidistant
   *  fisheye, stereoSbs = side-by-side stereo (left eye), stereographic =
   *  little-planet. */
  setVRProjection(
    half: boolean,
    fisheye = false,
    stereoSbs = false,
    stereographic = false,
  ): void {
    this.videoRenderer?.setVRProjection(half, fisheye, stereoSbs, stereographic);
  }

  /** Pan the 360° camera by a pointer drag (CSS px) over a viewport of
   *  viewportPx CSS height. */
  nudgeVR360(dx: number, dy: number, viewportPx: number): void {
    this.videoRenderer?.nudgeVR360(dx, dy, viewportPx);
  }

  /** Zoom the 360° camera (delta>0 zooms out, e.g. wheel deltaY). */
  zoomVR360(delta: number): void {
    this.videoRenderer?.zoomVR360(delta);
  }

  /** Recentre the 360° camera. */
  resetVRView(): void {
    this.videoRenderer?.resetVRView();
  }

  /** Paint a still poster image onto the canvas (so a custom `poster` shows in
   *  360° before playback, since a poster URL skips the initial decode). */
  renderPosterImage(image: CanvasImageSource): void {
    this.videoRenderer?.renderPosterImage(image);
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    if (this.streamWrapper) {
      this.streamWrapper.setPlaybackRate(rate);
    }

    const savedTime = this.getCurrentTime();
    // Only the corrective seek's purpose (undoing the audio read-ahead pivot)
    // applies when playback is actually rolling. At load time the rate is
    // restored from settings while the player sits in "ready"/"paused" — a
    // corrective seek then would (via preservePlaying) latch a resume intent
    // and auto-start playback. Gate it to active playback only.
    const playingNow =
      this.stateManager.getState() === "playing" ||
      this.stateManager.getState() === "buffering";

    this.clock.setPlaybackRate(rate);

    // Update audio renderer playback rate
    if (this.audioRenderer) {
      this.audioRenderer.setPlaybackRate(rate);
    }

    // Update video renderer playback rate
    if (this.videoRenderer) {
      this.videoRenderer.setPlaybackRate(rate);
    }
    // Tell the decoder the rate: it only screens out crash-inducing tiny
    // show_existing_frame packets at non-1x (at 1x they decode fine and
    // dropping them breaks the reference chain → later keyframe reject).
    if (this.videoDecoder) {
      this.videoDecoder.setPlaybackRate(rate);
    }
    if (this.nativeAudioEl) {
      this.nativeAudioEl.playbackRate = rate;
    }

    // No decoder flushes on rate change. Flushing the audio decoder drops
    // its read-ahead queue, so the next chunk arrives with whatever mediaTime
    // the demuxer has progressed to (often a second or more ahead) — that
    // audio leap then strands the video decoder behind, causing either
    // pixelation (no video flush) or a multi-second freeze (with flush, on
    // low-end hardware or Open GOP AV1). Letting buffered packets keep
    // flowing means the audible transition is just whatever output buffer
    // the AudioContext has — small with latencyHint="interactive" — and
    // the new rate is applied to subsequent stretcher output naturally.

    // Corrective seek to the saved position so the audio clock can't pivot to
    // the demuxer read-ahead mediaTime (the "jumps ahead on rate change" bug).
    // preservePlaying keeps the play/pause state across it; the seek-session
    // guard keeps rapid rate changes from a superseded completion landing
    // paused. Only when actually playing — see playingNow above.
    // Linear (non-seekable) playback can't do the corrective seek — the
    // keyframe before savedTime is usually behind the sliding window and the
    // read would fail (seek timeout → buffering). Skip it; the worst case is a
    // brief read-ahead pivot on rate change, far better than a stalled seek.
    if (playingNow && !this.isLinearPlayback()) {
      this.seek(savedTime, {
        suppressSpinner: true,
        preservePlaying: true,
      }).catch(() => {});
    }
  }

  /**
   * Setup native <audio> element for separate audio source.
   * Shared by single audioSource and multi-language audioTracks.
   */
  /**
   * Wire the native <audio> element's media events to player state/time. These
   * only act in native-audio-only mode (split-source data saver) — where there's
   * no demux loop to emit timeUpdate / detect EOF — and are inert during normal
   * split-source playback, which the processLoop drives.
   */
  private wireNativeAudioEvents(el: HTMLAudioElement): void {
    el.addEventListener("timeupdate", () => {
      if (!this.nativeAudioOnlyPlayback()) return;
      this.emit("timeUpdate", this.getCurrentTime());
    });
    el.addEventListener("durationchange", () => {
      if (!this.nativeAudioOnlyPlayback()) return;
      const d = el.duration;
      if (isFinite(d) && d > 0) {
        if (this.mediaInfo) this.mediaInfo.duration = d;
        this.clock.setDuration(d + this.startTime);
        this.emit("durationChange", d);
      }
    });
    el.addEventListener("ended", () => {
      if (!this.nativeAudioOnlyPlayback()) return;
      if (this.stateManager.getState() === "ended") return;
      const dur = this.getDuration() || 0;
      this.clock.seek(dur + this.startTime);
      this.emit("timeUpdate", dur);
      this.stateManager.setState("ended");
      this.emit("ended", undefined);
      this.releaseWakeLock();
    });
  }

  private setupNativeAudio(url: string): void {
    const wasPlaying = this.nativeAudioEl && !this.nativeAudioEl.paused;
    const currentTime = this.nativeAudioEl?.currentTime ?? 0;
    // Same-source detection: match the logical URL (the blob path rewrites
    // .src to a blob: URL) OR the element's raw .src (an adopted element from a
    // quality switch carries the URL but not our logical-URL field).
    const sameSrc =
      !!this.nativeAudioEl &&
      (this._nativeAudioLogicalUrl === url || this.nativeAudioEl.src === url);

    // Reuse or create element
    if (!this.nativeAudioEl) {
      this.nativeAudioEl = new Audio();
      this.wireNativeAudioEvents(this.nativeAudioEl);
    }
    this.nativeAudioEl.preload = "auto";
    // HTMLMediaElement.volume caps at [0,1]; getVolume() can be up to 2 (boost),
    // which the AudioContext gain handles — the native element just clamps.
    this.nativeAudioEl.volume = this.muted ? 0 : Math.min(1, this.audioRenderer.getVolume());
    this.nativeAudioEl.muted = this.muted;
    this.disableAudio = true;

    // Wire up clock + video renderer to native audio.
    // When paused (e.g. autoplay blocked) currentTime stays at 0 but
    // readyState reports HAVE_FUTURE_DATA — Clock would then "sync" to
    // a frozen 0 and stall video. Return -1 so Clock falls back to wall
    // clock until the user gesture lets <audio> actually start.
    const audioEl = this.nativeAudioEl;
    const self = this;
    const isAudioReady = () => !audioEl.paused && audioEl.readyState >= 3;
    this.clock.setAudioProvider({
      getAudioClock: () => isAudioReady() ? audioEl.currentTime + self.startTime : -1,
      hasHealthyBuffer: isAudioReady,
      isAudioPlaying: () => !audioEl.paused,
    });
    if (this.videoRenderer) {
      this.videoRenderer.setAudioTimeProvider(
        () => isAudioReady() ? audioEl.currentTime + self.startTime : -1,
        isAudioReady,
      );
    }

    // Restore position and resume after the source is in place. Also resume if
    // the player has since entered "playing" (e.g. autoplay/play() fired while
    // the headed blob was still fetching, so the earlier audio play() was a
    // no-op) — this lets the audio join as soon as it's ready.
    const restorePlayback = () => {
      if (currentTime > 0) audioEl.currentTime = currentTime;
      if (wasPlaying || this.stateManager.is("playing")) {
        audioEl.play().catch(() => {});
      }
    };

    if (sameSrc) {
      // Adopting an already-playing element with the same URL (quality switch
      // where the audio track is shared) — reassigning src would reload and
      // lose the user-activated play() context, so leave it untouched.
      restorePlayback();
      return;
    }

    this._nativeAudioLogicalUrl = url;
    const headers = this.config.headers;
    if (headers && Object.keys(headers).length > 0) {
      // Native <audio> ignores custom request headers, so the .mpd-split / API
      // audio file would 401/403 without them. Fetch it ourselves with the
      // headers and play from an in-memory blob: URL. Trade-off: the whole file
      // is buffered up front (no range streaming) — acceptable for a separate
      // audio track, and only taken when headers are actually required.
      this.revokeNativeAudioObjectUrl();
      fetch(url, { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          // A newer setup (track switch / new source) may have superseded this
          // fetch while it was in flight — bail so we don't clobber it.
          if (this.nativeAudioEl !== audioEl || this._nativeAudioLogicalUrl !== url) {
            return;
          }
          this._nativeAudioObjectUrl = URL.createObjectURL(blob);
          audioEl.src = this._nativeAudioObjectUrl;
          restorePlayback();
        })
        .catch((e) => {
          Logger.error(TAG, `Separate audio with custom headers failed to load: ${url}`, e);
        });
    } else {
      this.revokeNativeAudioObjectUrl();
      audioEl.src = url;
      restorePlayback();
    }
  }

  /** Release the in-memory blob: URL backing a header-authenticated audio file. */
  private revokeNativeAudioObjectUrl(): void {
    if (this._nativeAudioObjectUrl) {
      try {
        URL.revokeObjectURL(this._nativeAudioObjectUrl);
      } catch {}
      this._nativeAudioObjectUrl = null;
    }
  }

  /**
   * Detach the native <audio> element from this player WITHOUT pausing it,
   * so it can be re-adopted by a successor instance during a quality switch.
   * Returns the element (or null) so callers can hand it to adoptNativeAudio
   * on the new player. Critical because creating a fresh Audio element after
   * a programmatic src swap loses the user-activation token and trips
   * browser autoplay policy on the way back up.
   */
  releaseNativeAudio(): HTMLAudioElement | null {
    const el = this.nativeAudioEl;
    if (el) {
      // Hand the blob: URL (and its logical URL) to the successor via the
      // element itself, so it reuses the same in-memory audio instead of
      // re-fetching — and so we DON'T revoke a URL the element still plays.
      (el as any).__moviLogicalUrl = this._nativeAudioLogicalUrl;
      (el as any).__moviObjectUrl = this._nativeAudioObjectUrl;
      this._nativeAudioObjectUrl = null; // ownership moves with the element
      this._nativeAudioLogicalUrl = null;
      this.nativeAudioEl = null;
    }
    return el;
  }

  /**
   * Adopt an existing <audio> element before init() runs, so setupNativeAudio
   * sees a populated nativeAudioEl and reuses it (instead of constructing a
   * brand-new — and unactivated — Audio).
   */
  adoptNativeAudio(el: HTMLAudioElement): void {
    if (this.nativeAudioEl && this.nativeAudioEl !== el) {
      try { this.nativeAudioEl.pause(); } catch {}
    }
    this.nativeAudioEl = el;
    // Reclaim the blob: URL ownership stashed by releaseNativeAudio, so the
    // same-source check matches (no re-fetch) and destroy() later revokes it.
    if ((el as any).__moviObjectUrl !== undefined) {
      this._nativeAudioObjectUrl = (el as any).__moviObjectUrl ?? null;
      this._nativeAudioLogicalUrl = (el as any).__moviLogicalUrl ?? null;
      delete (el as any).__moviObjectUrl;
      delete (el as any).__moviLogicalUrl;
    }
  }

  /**
   * Get available audio language tracks (multi-language mode)
   */
  getAudioLangs(): { lang: string; label: string; active: boolean }[] {
    return this._audioTracks.map((t) => ({
      lang: t.lang,
      label: t.label,
      active: t.lang === this._activeAudioLang,
    }));
  }

  /**
   * Switch audio to an external language track (native <audio> element).
   * Disables WASM audio if it was active. Preserves position & playback.
   */
  selectAudioLang(lang: string): boolean {
    const track = this._audioTracks.find((t) => t.lang === lang);
    if (!track) {
      Logger.warn(TAG, `Audio track not found for lang: ${lang}`);
      return false;
    }
    if (lang === this._activeAudioLang && this.nativeAudioEl) return true;

    // Mute WASM audio if it was active (don't destroy — keep decodable for switch-back)
    if (!this.disableAudio) {
      this.audioRenderer.mute();
      this.disableAudio = true;
    }

    this._activeAudioLang = lang;
    this.setupNativeAudio(track.url);
    Logger.info(TAG, `Audio switched to external: ${track.label} (${track.lang})`);
    this.emit("audioTrackChange" as any, { lang, label: track.label });
    return true;
  }

  /**
   * Switch back to muxed (WASM) audio, disabling native <audio> element.
   * Called when user selects a demuxer audio track while external is active.
   */
  useMuxedAudio(): void {
    if (!this.nativeAudioEl) return;

    // Stop native audio
    this.nativeAudioEl.pause();
    this.nativeAudioEl.src = "";
    this.nativeAudioEl = null;
    this.revokeNativeAudioObjectUrl();
    this._nativeAudioLogicalUrl = null;
    this._activeAudioLang = "";

    // Re-enable WASM audio
    this.disableAudio = false;
    this.muted = false;
    this.audioRenderer.unmute().catch(() => {});

    // Restore WASM audio as clock provider
    this.clock.setAudioProvider(this.audioRenderer);
    if (this.videoRenderer) {
      this.videoRenderer.setAudioTimeProvider(
        () => this.audioRenderer.getAudioClock(),
        () => this.audioRenderer.hasHealthyBuffer(),
      );
    }

    Logger.info(TAG, "Switched back to muxed (WASM) audio");
  }

  /** Check if native audio is currently active */
  isNativeAudioActive(): boolean {
    return this.nativeAudioEl !== null && this._activeAudioLang !== "";
  }

  /** True whenever a native <audio> element is loaded (single split-source or multi-lang). */
  hasNativeAudio(): boolean {
    return this.nativeAudioEl !== null;
  }

  /**
   * True if any audio path is active that the user can mute / volume-control.
   * Covers muxed (WASM) tracks, split-source <audio>, and HLS streams whose
   * audio is muxed inside the native <video> element.
   */
  hasAudibleSource(): boolean {
    return (
      this.trackManager.getAudioTracks().length > 0 ||
      this.hasNativeAudio() ||
      this.streamWrapper !== null
    );
  }

  /**
   * True when audio plays through a native HTMLMediaElement — an adaptive
   * stream (HLS/DASH via the stream wrapper's <video>) or native split-source
   * audio — rather than the AudioContext. Such audio can't be boosted above
   * 100% (HTMLMediaElement.volume caps at [0,1]), so the volume UI caps at 100%.
   */
  usesNativeAudio(): boolean {
    // Any live native <audio> element means audio bypasses the WebAudio gain
    // node, so the >100% boost can't apply — regardless of whether a language
    // is set. (isNativeAudioActive() additionally requires a selected lang,
    // which a single external audio source never has, so it would wrongly leave
    // the boost enabled here.) useMuxedAudio() nulls nativeAudioEl when it hands
    // playback back to the boostable WASM path, so this stays correct.
    return this.streamWrapper !== null || this.nativeAudioEl !== null;
  }

  /** True for a live (dynamic) adaptive stream — drives the LIVE indicator. */
  isLiveStream(): boolean {
    // Shaka-only extras — undefined on the hls.js/dash.js fallback wrappers.
    return (this.streamWrapper as any)?.isLive?.() ?? false;
  }

  /** True when the active adaptive stream is audio-only (no video track). */
  isStreamAudioOnly(): boolean {
    return (this.streamWrapper as any)?.isAudioOnly?.() ?? false;
  }

  /** Live-edge time of a live stream (seekable range end). */
  getLiveEdge(): number {
    return (this.streamWrapper as any)?.getLiveEdge?.() ?? this.getDuration();
  }

  /** Start of a live stream's seekable (DVR) window. */
  getSeekRangeStart(): number {
    return (this.streamWrapper as any)?.getSeekRangeStart?.() ?? 0;
  }

  /** Jump to the live edge of a live stream. */
  seekToLive(): void {
    const edge = this.getLiveEdge();
    if (isFinite(edge) && edge > 0) this.streamWrapper?.seek(edge);
  }

  /**
   * Get available external subtitle tracks
   */
  getSubtitleLangs(): {
    id: string;
    lang: string;
    label: string;
    active: boolean;
  }[] {
    return this._subtitleTracks.map((t) => {
      const id = getExternalSubtitleId(t);
      return {
        id,
        lang: t.lang,
        label: t.label,
        active: id === this._activeExternalSubtitleId,
      };
    });
  }

  /**
   * Select an external subtitle track by stable id.
   * Fetches the VTT/SRT file, parses cues, and starts rendering.
   * Pass null to disable.
   */
  async selectExternalSubtitle(id: string | null): Promise<boolean> {
    this.stopExternalSubtitles();

    if (!id) {
      this._activeExternalSubtitleId = "";
      if (this.presentationMode === "native" && !this.videoRenderer) {
        this.setNativeExternalTextTracks(null);
      } else if (this.videoRenderer) {
        this.videoRenderer.clearSubtitles();
      }
      this.emit("subtitleTrackChange" as any, { lang: null, label: null });
      return true;
    }

    const track = this._subtitleTracks.find(
      (t) => getExternalSubtitleId(t) === id,
    );
    if (!track) {
      Logger.warn(TAG, `Subtitle track not found for id: ${id}`);
      return false;
    }

    if (this.presentationMode === "native" && !this.videoRenderer) {
      const ok = this.setNativeExternalTextTracks(id);
      if (!ok) return false;
      this._activeExternalSubtitleId = id;
      this.trackManager.selectSubtitleTrack(null);
      this.emit("subtitleTrackChange" as any, {
        lang: track.lang,
        label: track.label,
      });
      Logger.info(TAG, `Native subtitle track enabled: ${track.label}`);
      return true;
    }

    try {
      const res = await fetch(track.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      const fmt = track.format || (track.url.includes(".srt") ? "srt" : "vtt");

      this.videoRenderer?.setSubtitleFormat(fmt);

      this._externalSubCues = fmt === "srt"
        ? this.parseSRT(text)
        : this.parseVTT(text);

      this._activeExternalSubtitleId = id;

      this.selectSubtitleTrack(null);

      this.startExternalSubtitles();

      Logger.info(TAG, `Subtitle loaded: ${track.label} (${this._externalSubCues.length} cues)`);
      this.emit("subtitleTrackChange" as any, {
        lang: track.lang,
        label: track.label,
      });
      return true;
    } catch (e) {
      Logger.error(TAG, `Failed to load subtitle: ${track.url}`, e);
      return false;
    }
  }

  /**
   * Select an external subtitle track by language.
   * When multiple tracks share a language, the first match is selected.
   * Prefer selectExternalSubtitle when track ids are available.
   */
  async selectSubtitleLang(lang: string | null): Promise<boolean> {
    if (!lang) {
      return this.selectExternalSubtitle(null);
    }

    const track = this._subtitleTracks.find((t) => t.lang === lang);
    if (!track) {
      Logger.warn(TAG, `Subtitle track not found for lang: ${lang}`);
      return false;
    }

    return this.selectExternalSubtitle(getExternalSubtitleId(track));
  }

  /** Parse VTT text into SubtitleCue[] */
  private parseVTT(text: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = text.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.trim().split("\n");
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(
          /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
        );
        if (match) {
          const start = +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
          const end = +match[5] * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000;
          const cueText = lines.slice(i + 1).join("\n").trim();
          if (cueText) cues.push({ start, end, text: cueText });
          break;
        }
      }
    }
    return cues;
  }

  /** Parse SRT text into SubtitleCue[] */
  private parseSRT(text: string): SubtitleCue[] {
    // SRT has same timestamp format but with comma instead of dot — parseVTT handles both
    return this.parseVTT(text);
  }

  /** Start rendering external subtitle cues based on playback time */
  private startExternalSubtitles(): void {
    this.stopExternalSubtitles();
    let lastIdx = -1;
    this._externalSubTimer = window.setInterval(() => {
      if (!this.videoRenderer) return;
      const time = this.clock.getTime();
      // Find active cue
      const idx = this._externalSubCues.findIndex(
        (c) => time >= c.start && time <= c.end
      );
      if (idx !== lastIdx) {
        lastIdx = idx;
        if (idx >= 0) {
          this.videoRenderer.setSubtitleCues([this._externalSubCues[idx]]);
        } else {
          this.videoRenderer.setSubtitleCues([]);
        }
      }
    }, 100); // 10Hz check — enough for subtitle timing
  }

  setExternalSubtitleTracks(tracks: SubtitleSourceEntry[]): void {
    this.stopExternalSubtitles();
    this._activeExternalSubtitleId = "";
    this._subtitleTracks = tracks.map((track, index) => ({
      ...track,
      id: track.id ?? track.url ?? `external-sub-${index}`,
    }));
  }

  private clearStreamTrackHandlers(): void {
    for (const unsub of this.streamTrackHandlerUnsubs) {
      unsub();
    }
    this.streamTrackHandlerUnsubs = [];
  }

  /** Stop external subtitle rendering */
  private applyConfiguredSubtitleTracks(): void {
    if (this.config.subtitleTracks && this.config.subtitleTracks.length > 0) {
      this._subtitleTracks = this.config.subtitleTracks.map((track, index) => ({
        ...track,
        id: track.id ?? track.url ?? `external-sub-${index}`,
      }));
      Logger.info(TAG, `External subtitles: ${this._subtitleTracks.length} tracks`);
      return;
    }
    this._subtitleTracks = [];
  }

  private stopExternalSubtitles(): void {
    if (this._externalSubTimer !== null) {
      clearInterval(this._externalSubTimer);
      this._externalSubTimer = null;
    }
  }

  /** Toggle external subtitle TextTracks on the native stream video element. */
  private setNativeExternalTextTracks(id: string | null): boolean {
    const video = this.streamWrapper?.getVideoElement();
    if (!video) return false;

    const selected = id
      ? this._subtitleTracks.find((track) => getExternalSubtitleId(track) === id)
      : null;

    const tracks = video.textTracks;
    let matched = false;
    for (let i = 0; i < tracks.length; i++) {
      const tt = tracks[i];
      if (!selected) {
        tt.mode = "hidden";
        continue;
      }
      const isMatch = tt.label === selected.label;
      if (isMatch) {
        tt.mode = "showing";
        matched = true;
      } else {
        tt.mode = "hidden";
      }
    }
    return id === null || matched;
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    if (this.streamWrapper) {
      return this.streamWrapper.getPlaybackRate();
    }
    return this.clock.getPlaybackRate();
  }

  /**
   * Set subtitle delay in seconds.
   * VLC/mpv convention: positive value = subtitles appear later than the
   * original cue timing, negative value = earlier. Useful when the subtitle
   * track is out of sync with the video due to different source releases or
   * frame-rate conversions.
   */
  setSubtitleDelay(seconds: number): void {
    this._nativeSubtitleDelay = seconds;
    if (this.videoRenderer) {
      this.videoRenderer.setSubtitleDelay(seconds);
    }
    // Non-zero delay needs cues from stream positions the demuxer hasn't
    // necessarily reached yet (negative delay) or has already passed
    // (positive delay across a seek). Prefetch the full cue list once so
    // the renderer cache is authoritative regardless of demuxer position.
    // Zero delay falls back to the streaming path — no prefetch overhead.
    if (seconds !== 0 && this.videoRenderer) {
      void this.prefetchActiveSubtitleStream();
    }
  }

  /** Get current subtitle delay in seconds. */
  getSubtitleDelay(): number {
    if (this.videoRenderer) {
      return this.videoRenderer.getSubtitleDelay();
    }
    return this._nativeSubtitleDelay;
  }

  /**
   * Return every cue for the active subtitle stream, scanning it via the
   * C-side prefetch path if we haven't already done so. Used by the cues
   * browser UI — gives the caller a stable list to render and seek into.
   * Resolves to an empty array when no subtitle is active, the active
   * track is bitmap-only (PGS), or scanning fails.
   */
  async getAllSubtitleCues(): Promise<{ start: number; end: number; text: string }[]> {
    const subtitleTrack = this.trackManager.getActiveSubtitleTrack();
    if (!subtitleTrack) return [];
    if (subtitleTrack.subtitleType && subtitleTrack.subtitleType !== "text") return [];
    if (this.prefetchedSubtitleStream !== subtitleTrack.id) {
      await this.prefetchActiveSubtitleStream();
    }
    if (!this.videoRenderer) return [];
    // The renderer's cue cache is the canonical post-prefetch source —
    // prefetchActiveSubtitleStream pushes the full list into it via
    // setSubtitleCues. Reading it back avoids holding a duplicate copy
    // on MoviPlayer.
    return this.videoRenderer.getAllCues();
  }

  /**
   * Scan the active subtitle stream and seed the renderer with every cue.
   * No-op when the same stream has already been prefetched, when no
   * subtitle is selected, or when a prefetch is in flight. The demuxer is
   * left at EOF after the C-side scan, so we re-seek back to the current
   * playback position before returning.
   */
  private async prefetchActiveSubtitleStream(): Promise<void> {
    if (this.prefetchInFlight) return;
    if (!this.demuxer || !this.videoRenderer) return;
    const subtitleTrack = this.trackManager.getActiveSubtitleTrack();
    if (!subtitleTrack) return;
    if (this.prefetchedSubtitleStream === subtitleTrack.id) return;
    const bindings = this.demuxer.getBindings();
    if (!bindings) return;
    // Only support text subtitles — bitmap (PGS/dvd_subtitle) decoding
    // returns image data, which the prefetch text path can't carry across
    // and which the user-shift UI doesn't apply to anyway.
    if (subtitleTrack.subtitleType && subtitleTrack.subtitleType !== "text") return;

    this.prefetchInFlight = true;
    const resumeTime = this.clock.getTime();
    const wasPlaying = this.stateManager.getState() === "playing";

    // Quiesce all paths that touch the demuxer/decoders. Without this the
    // prefetch's seek-to-0 + sequential reads race the playback processLoop
    // (which is already mid-readPacket via Asyncify), corrupting the
    // js_read_async pending-read state and stalling playback indefinitely
    // ("No pending read to fulfill").
    this.stopPauseBuffering();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Bumping the seek session ID forces any in-flight processLoop iteration
    // to bail out at its next checkpoint instead of writing stale results.
    this.seekSessionId++;
    if (wasPlaying) {
      this.clock.pause();
      if (!this.disableAudio) this.audioRenderer.pause();
      if (this.nativeAudioEl) this.nativeAudioEl.pause();
      if (this.videoRenderer) this.videoRenderer.stopPresentationLoop();
    }
    // Wait for any demuxer call already in flight to land before we issue
    // our own. Asyncify won't let two reads/seeks overlap on the same
    // context; this poll is short because js_read_async resolves within a
    // single rAF once the JS side delivers the buffer.
    const maxWaitMs = 2000;
    const waitStart = performance.now();
    while (this.demuxInFlight && performance.now() - waitStart < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 10));
    }

    try {
      Logger.info(TAG, `Prefetching subtitle cues for stream ${subtitleTrack.id}...`);
      const cues = await bindings.prefetchSubtitleCues(subtitleTrack.id);
      if (cues && cues.length > 0) {
        // Seed the renderer's cache with every cue at once. The renderer
        // already maintains an active-cue cursor that re-evaluates against
        // the current adjusted time, so we don't need a separate "play
        // from cache" mode — the existing display path just works.
        this.videoRenderer.setSubtitleCues(cues);
        this.prefetchedSubtitleStream = subtitleTrack.id;
        Logger.info(TAG, `Prefetched ${cues.length} subtitle cues for stream ${subtitleTrack.id}`);
      } else {
        Logger.warn(TAG, `Subtitle prefetch returned no cues for stream ${subtitleTrack.id}`);
      }

      // The C-side scan leaves the demuxer at EOF. Re-seek back to where
      // playback should be so the audio/video pipeline can keep going.
      // Flush decoders + clear queue since the demuxer is in an
      // undefined-for-playback state.
      await this.videoDecoder.flush();
      await this.audioDecoder.flush();
      if (this.videoRenderer) this.videoRenderer.clearQueue();
      this.audioRenderer.reset();
      await this.demuxer.seek(resumeTime);
      this.clock.seek(resumeTime);
      this.pendingAudioPackets = [];
      this.pendingPrebufferPackets = [];
      this.eofReached = false;
      this.eofSince = 0;
    } catch (err) {
      Logger.error(TAG, "Subtitle prefetch failed", err);
    } finally {
      this.prefetchInFlight = false;
    }

    // Resume audio/video pipelines if we paused them above. We bypass the
    // public play() because the player's state is still "playing" — we
    // only paused the underlying clocks/decoders and need to nudge them
    // back without the full first-play song-and-dance.
    if (wasPlaying) {
      try {
        if (!this.disableAudio) await this.audioRenderer.play();
        if (this.nativeAudioEl) await this.nativeAudioEl.play().catch(() => {});
        if (this.videoRenderer) this.videoRenderer.startPresentationLoop();
        this.clock.start();
        // Re-arm the seek-target guard (filter-only, not waitingForVideoSync)
        // so any pre-target frames produced by Open-GOP recovery after the
        // resumeTime seek get dropped without firing notifySeekCompletion's
        // state transitions.
        this.seekTargetTime = resumeTime;
        this.animationFrameId = requestAnimationFrame(this.processLoop);
        this.requestWakeLock();
      } catch (err) {
        Logger.error(TAG, "Failed to resume after subtitle prefetch", err);
      }
    } else {
      // Even when paused, kick off pause-time buffering again so the
      // demuxer keeps reading ahead behind the scenes (HTTP sources only).
      this.startPauseBuffering();
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (this.streamWrapper) {
      this.streamWrapper.setVolume(volume);
    }
    this.audioRenderer.setVolume(volume);
    if (this.nativeAudioEl) {
      // Native element caps at [0,1]; >1 boost lives in the AudioContext gain.
      this.nativeAudioEl.volume = Math.min(1, Math.max(0, volume));
    }
  }

  /**
   * Get volume (0-1)
   */
  getVolume(): number {
    if (this.streamWrapper) {
      return this.streamWrapper.getVolume();
    }
    return this.audioRenderer.getVolume();
  }

  /**
   * Set muted state
   */
  setMuted(muted: boolean): void {
    if (this.muted === muted) return;

    this.muted = muted;
    if (this.streamWrapper) {
      this.streamWrapper.setMuted(muted);
      return;
    }

    if (muted) {
      this.audioRenderer.mute();
    } else {
      this.audioRenderer.unmute().catch((err) => {
        Logger.error("MoviPlayer", "Failed to unmute", err);
      });
    }
    if (this.nativeAudioEl) {
      this.nativeAudioEl.muted = muted;
      if (!muted && this._nativeAudioAutoplayBlocked) {
        this._nativeAudioAutoplayBlocked = false;
        if (this.nativeAudioEl.paused && this.stateManager.getState() === "playing") {
          try {
            this.nativeAudioEl.currentTime = Math.max(0, this.clock.getTime() - this.startTime);
          } catch {}
          this.nativeAudioEl.play().catch(() => {});
        }
      }
    }
  }

  /**
   * Get muted state
   */
  getMuted(): boolean {
    return this.muted;
  }

  /**
   * Enable/disable stable audio mode
   * Stable audio provides: smooth gain transitions, auto-recovery,
   * gap filling on underrun, starvation detection, and fade on seek/reset
   */
  setStableAudio(enabled: boolean): void {
    this.audioRenderer.setStableAudio(enabled);
  }

  /**
   * Get stable audio mode state
   */
  getStableAudio(): boolean {
    return this.audioRenderer.getStableAudio();
  }

  /**
   * Get comprehensive player stats for "Stats for nerds" overlay
   */
  /**
   * Raw render-health numbers for the stutter-hint monitor — distinct from
   * getStats(), which formats display strings. framesPresented is cumulative
   * (resets to 0 on seek/reset), so callers must handle it going backwards.
   * Null when there's no video renderer (audio-only / adaptive streams).
   */
  getRenderHealth(): { framesPresented: number; sourceFps: number } | null {
    if (!this.videoRenderer || this.streamWrapper) return null;
    const vt = this.trackManager.getActiveVideoTrack() as VideoTrack | null;
    return {
      framesPresented: this.videoRenderer.getStats().framesPresented,
      sourceFps: vt?.frameRate && vt.frameRate > 0 ? vt.frameRate : 30,
    };
  }

  getStats(): Record<string, string | number | boolean> {
    // HLS mode: delegate to HLS wrapper
    if (this.streamWrapper) {
      return this.streamWrapper.getStats();
    }

    const mediaInfo = this.mediaInfo;
    const videoTrack = this.trackManager.getActiveVideoTrack() as VideoTrack | null;
    const audioTrack = this.trackManager.getActiveAudioTrack() as AudioTrack | null;
    const videoDecoderStats = this.videoDecoder.getStats();
    const audioDecoderStats = this.audioDecoder.getStats();
    const rendererStats = this.videoRenderer?.getStats();
    const audioBuffered = this.audioRenderer.getBufferedDuration();

    const stats: Record<string, string | number | boolean> = {};

    // Video info
    if (videoTrack) {
      stats["Video Codec"] = videoTrack.codec ?? "N/A";
      stats["Resolution"] = `${videoTrack.width}x${videoTrack.height}`;
      // Quality label — classify by the larger of actual height and the
      // 16:9-normalised height (width * 9 / 16). Cinematic / ultrawide
      // sources letterbox horizontally, so a 3840×2080 cut of 4K UHD
      // would otherwise misreport as "2K" purely because its pixel
      // height is < 2160.
      const h = videoTrack.height;
      const eff = Math.max(h, Math.round(videoTrack.width * 9 / 16));
      stats["Quality"] = eff >= 8640 ? "16K" : eff >= 4320 ? "8K" : eff >= 2160 ? "4K" : eff >= 1440 ? "2K" : eff >= 1080 ? "1080p" : eff >= 720 ? "720p" : eff >= 480 ? "480p" : "SD";
      stats["Frame Rate"] = `${videoTrack.frameRate} fps`;
      stats["Video Bitrate"] = videoTrack.bitRate
        ? `${(videoTrack.bitRate / 1000).toFixed(0)} kbps`
        : "N/A";
      if (videoTrack.pixelFormat) stats["Pixel Format"] = videoTrack.pixelFormat;
      stats["Color Space"] = videoTrack.colorSpace ?? "N/A";
      if (videoTrack.colorRange) stats["Color Range"] = videoTrack.colorRange;
      if (videoTrack.colorPrimaries && videoTrack.colorPrimaries !== "unknown") {
        stats["Color Primaries"] = videoTrack.colorPrimaries;
      }
      if (videoTrack.colorTransfer && videoTrack.colorTransfer !== "unknown") {
        stats["Color Transfer"] = videoTrack.colorTransfer;
      }
      stats["HDR"] = videoTrack.isHDR ? "Yes" : "No";
      if (videoTrack.rotation) stats["Rotation"] = `${videoTrack.rotation}°`;
      stats["Video Decoder"] = videoDecoderStats.decoderType;
    }

    // Audio info
    if (audioTrack) {
      stats["Audio Codec"] = audioTrack.codec ?? "N/A";
      if (audioTrack.language && audioTrack.language !== "und") {
        stats["Language"] = audioTrack.language.toUpperCase();
      }
      stats["Sample Rate"] = `${audioTrack.sampleRate} Hz`;
      stats["Channels"] = audioTrack.channels === 1 ? "Mono" :
                          audioTrack.channels === 2 ? "Stereo" :
                          audioTrack.channels === 6 ? "5.1 Surround" :
                          audioTrack.channels === 8 ? "7.1 Surround" :
                          `${audioTrack.channels}ch`;
      stats["Audio Bitrate"] = audioTrack.bitRate
        ? `${(audioTrack.bitRate / 1000).toFixed(0)} kbps`
        : "N/A";
      stats["Audio Decoder"] = audioDecoderStats.decoderType;
    }

    // Subtitle info
    const subtitleTrack = this.trackManager.getActiveSubtitleTrack();
    if (subtitleTrack) {
      stats["Subtitle"] = `${subtitleTrack.codec ?? "text"}${subtitleTrack.language ? ` (${subtitleTrack.language.toUpperCase()})` : ""}`;
    }

    // Container
    if (mediaInfo) {
      stats["Container"] = mediaInfo.formatName ?? "N/A";
      stats["Total Bitrate"] = mediaInfo.bitRate
        ? `${(mediaInfo.bitRate / 1000).toFixed(0)} kbps`
        : "N/A";
    }

    // Playback
    stats["Playback State"] = this.stateManager.getState();
    stats["Playback Rate"] = `${this.clock.getPlaybackRate()}x`;
    stats["A/V Sync"] = this.clock.isSyncedToAudio() ? "Audio Master" : "Wall Clock";
    stats["Stable Volume"] = this.audioRenderer.getStableAudio() ? "On" : "Off";

    // Buffers
    stats["Audio Buffer"] = `${audioBuffered.toFixed(2)}s`;
    stats["Video Queue"] = `${rendererStats?.frameQueueSize ?? 0} frames`;
    stats["Frames Rendered"] = rendererStats?.framesPresented ?? 0;
    stats["Video Decoder Queue"] = videoDecoderStats.queueSize;
    stats["Audio Decoder Queue"] = audioDecoderStats.queueSize;

    // Memory usage (Chrome only)
    const mem = (performance as any).memory;
    if (mem) {
      stats["Memory Used"] = `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB`;
      stats["Memory Limit"] = `${(mem.jsHeapSizeLimit / 1048576).toFixed(0)} MB`;
    }

    // File
    if (this.fileSize > 0) {
      stats["File Size"] = this.fileSize > 1048576
        ? `${(this.fileSize / 1048576).toFixed(1)} MB`
        : `${(this.fileSize / 1024).toFixed(1)} KB`;
    }

    // Network (HttpSource) or Disk (FileSource) stats
    if (this.source instanceof HttpSource) {
      const net = this.source.getNetworkStats();
      stats["Downloaded"] = net.totalBytes > 1048576
        ? `${(net.totalBytes / 1048576).toFixed(1)} MB`
        : `${(net.totalBytes / 1024).toFixed(1)} KB`;
      stats["Network Speed"] = net.currentSpeed > 0
        ? net.currentSpeed > 1048576
          ? `${(net.currentSpeed / 1048576).toFixed(1)} MB/s`
          : `${(net.currentSpeed / 1024).toFixed(0)} KB/s`
        : "—";
      stats["Connection Time"] = `${net.elapsed.toFixed(1)}s`;
    } else if (this.source instanceof FileSource) {
      const disk = this.source.getDiskStats();
      stats["Disk Read"] = disk.totalBytes > 1048576
        ? `${(disk.totalBytes / 1048576).toFixed(1)} MB`
        : `${(disk.totalBytes / 1024).toFixed(1)} KB`;
      stats["Read Speed"] = disk.currentSpeed > 0
        ? disk.currentSpeed > 1048576
          ? `${(disk.currentSpeed / 1048576).toFixed(1)} MB/s`
          : `${(disk.currentSpeed / 1024).toFixed(0)} KB/s`
        : "—";
    }

    return stats;
  }

  /**
   * Get current I/O throughput in bytes/sec (for graph)
   * Works for both network (HttpSource) and disk (FileSource)
   */
  getNetworkSpeed(): number {
    // HLS mode: delegate to HLS wrapper
    if (this.streamWrapper) {
      return this.streamWrapper.getNetworkSpeed();
    }
    // EncryptedHttpSource extends HttpSource, so the HttpSource branch
    // covers encrypted playback too.
    if (this.source instanceof HttpSource) {
      return this.source.getNetworkStats().currentSpeed;
    }
    if (this.source instanceof FileSource) {
      return this.source.getDiskStats().currentSpeed;
    }
    return 0;
  }

  /**
   * Check if source is a local file
   */
  isFileSource(): boolean {
    if (this.streamWrapper) return false;
    return this.source instanceof FileSource;
  }

  /**
   * True when the active source has fallen back to linear (forward-only,
   * non-seekable) playback — server lacks HTTP Range support and the file is
   * too big to cache whole. Used by the UI as a backstop alongside the
   * "linearmode" event (in case the event fired before listeners attached).
   */
  isLinearPlayback(): boolean {
    const src = this.source as { isLinearMode?: () => boolean } | null;
    return typeof src?.isLinearMode === "function" ? src.isLinearMode() : false;
  }

  /**
   * True when audio is blocked by the browser's autoplay policy — the
   * AudioContext is stuck suspended despite an unmuted play() because no
   * user gesture has unlocked it. play()'s promise resolves either way, so
   * the element polls this after autoplay to decide whether to fall back to
   * muted playback + a "Tap to unmute" pill.
   */
  isAudioBlockedSuspended(): boolean {
    if (this.streamWrapper) return false;
    // Native <audio> autoplay blocked → muted-and-rolling: report blocked so
    // the element shows the unmute pill (disableAudio is true in this path, so
    // it must be checked before the disableAudio short-circuit below).
    if (this._nativeAudioAutoplayBlocked) return true;
    if (this.disableAudio) return false;
    return this.audioRenderer.isBlockedSuspended();
  }

  /** True when audio-only (data-saver) mode is active. */
  isAudioOnly(): boolean {
    return this._audioOnly;
  }

  /**
   * Toggle audio-only (data-saver) mode at runtime. On the demuxer path the
   * processLoop stops decoding video (CPU saving) — re-enabling re-seeks to
   * recover a keyframe and resume video in sync. Adaptive streams drop/restore
   * video renditions via a reload (config.audioOnly), so this only flips the
   * flag for them; the caller (MoviElement) owns that reload.
   */
  setAudioOnly(enabled: boolean): void {
    if (this._audioOnly === enabled) return;
    this._audioOnly = enabled;
    if (this.streamWrapper) {
      // Adaptive streams: the wrapper picks an audio-only / smallest-video
      // variant live (no reload, so the stream — and its LIVE state — survives).
      (this.streamWrapper as any).setAudioOnly?.(enabled);
      return;
    }

    const splitSource = !!this.nativeAudioEl; // separate <audio> drives playback

    if (enabled) {
      // Freeze the video surface cleanly — drop queued + on-screen frames so the
      // UI can swap to the album-art / strip view without a stale last frame.
      if (this.videoRenderer) this.videoRenderer.clearQueue();
      if (splitSource) {
        // Split source: stop the demux loop entirely so the video body stops
        // downloading + decoding. The native <audio> keeps playing on its own.
        // (Doing this live — never via a reload — avoids tearing down the WASM
        // context while a read is in flight, which crashes with an OOB.)
        if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
        }
        this.stopPauseBuffering();
      }
      // Muxed source: keep the demux loop running (it still decodes the in-file
      // audio); the processLoop's _audioOnly check skips only the video decode.
    } else {
      // Re-enabling video. Seek to the current playhead to recover a keyframe and
      // resync; for a split source the demux loop was stopped, so restart it.
      const t = this.getCurrentTime();
      this.seek(t)
        .then(() => {
          if (
            splitSource &&
            this.animationFrameId === null &&
            this.stateManager.getState() === "playing"
          ) {
            this.processLoop();
          }
        })
        .catch((e) => Logger.warn(TAG, "Audio-only → video resync seek failed", e));
    }
  }

  /**
   * True when the active source is not a FileSource (gate inactive), or when
   * the FileSource's initial preload pass has settled.
   */
  isFileSourcePreloadComplete(): boolean {
    if (!(this.source instanceof FileSource)) return true;
    return this.source.isPreloadComplete();
  }

  /**
   * Public accessor for the mobile-device flag (used by MoviElement to gate
   * UI behavior on mobile-only paths).
   */
  static isMobileDevice(): boolean {
    return MoviPlayer._isMobileDevice;
  }

  /**
   * Request WakeLock to prevent screen sleep
   */
  private async requestWakeLock(retry: number = 1): Promise<void> {
    // Check if WakeLock API is available
    if (!("wakeLock" in navigator)) {
      Logger.debug(TAG, "WakeLock API not available");
      return;
    }

    // The Screen Wake Lock API rejects (NotAllowedError) unless the page is
    // visible — don't even attempt while hidden. It's the wrong moment, not a
    // fault; handleVisibilityChange re-requests once the tab is shown.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      Logger.debug(TAG, "WakeLock skipped — page not visible");
      return;
    }

    try {
      // Release existing wakeLock if any
      if (this.wakeLock) {
        await this.releaseWakeLock();
      }

      // Request new wakeLock
      const wakeLock = await (navigator as any).wakeLock.request("screen");
      this.wakeLock = wakeLock;
      Logger.debug(TAG, "WakeLock acquired");

      // Handle wakeLock release (e.g., user switches tab, screen locks)
      wakeLock.addEventListener("release", () => {
        Logger.debug(TAG, "WakeLock released by system");
        this.wakeLock = null;
      });
    } catch (error) {
      this.wakeLock = null;
      Logger.warn(TAG, "Failed to acquire WakeLock", error);
      // Some devices reject the very FIRST request transiently even while
      // visible (a race as the page becomes fully interactive), then never
      // re-acquire for the rest of the session. Retry once shortly — but only
      // if we still want the lock (active playback, visible, none held).
      if (retry > 0) {
        setTimeout(() => {
          const st = this.stateManager.getState();
          if (
            !this.wakeLock &&
            (st === "playing" || st === "buffering") &&
            typeof document !== "undefined" &&
            document.visibilityState === "visible"
          ) {
            this.requestWakeLock(retry - 1);
          }
        }, 600);
      }
    }
  }

  /**
   * Re-acquire the screen wake lock if we should be holding one but aren't.
   * Called on the moments where the lock can quietly drop, or where a failed
   * first attempt gets a fresh chance: tab visibility changes and player
   * resizes (fullscreen / orientation / PiP transitions). Idempotent — no-op
   * when a lock is already held, playback isn't active, or the page is hidden.
   */
  private ensureWakeLock(): void {
    if (this.wakeLock) return; // already held
    const st = this.stateManager.getState();
    if (st !== "playing" && st !== "buffering") return; // not actively playing
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    this.requestWakeLock();
  }

  /**
   * Handle network recovery — re-seek to current position to restart cleanly
   */
  private handleNetworkOnline = (): void => {
    const state = this.stateManager.getState();
    if (state === "buffering" || state === "playing") {
      const currentTime = this.getCurrentTime();
      Logger.info(TAG, `Network online — re-seeking to ${currentTime.toFixed(2)}s for clean recovery`);
      this.seek(currentTime).catch((err) => {
        Logger.error(TAG, "Network recovery seek failed", err);
      });
    }
  };

  /**
   * Handle visibility change
   */
  /** Set by MoviElement when Document PiP is active */
  public isPiPActive: boolean = false;

  private handleVisibilityChange = async (): Promise<void> => {
    const isPlaying = this.stateManager.getState() === "playing" || this.stateManager.getState() === "buffering";

    if (document.visibilityState === "hidden" && isPlaying) {
      // On phones/tablets, skip background-playback gymnastics entirely. The OS
      // throttles/freezes hidden tabs aggressively (timers stop, AudioContext
      // suspends, recovery on resume is unreliable) — easier to just pause.
      // PiP is exempted; that's an explicit "keep playing" gesture.
      // UA check (not pointer:coarse) so Windows touch laptops aren't misclassified.
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const uaData = (navigator as any)?.userAgentData;
      const isMobile = uaData?.mobile === true ||
        /Android|iPhone|iPod|Mobile|Opera Mini|IEMobile|BlackBerry/i.test(ua) ||
        // iPad on iOS 13+ reports as Mac — disambiguate via touch points
        (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
      if (isMobile && !this.isPiPActive) {
        this.pause();
        return;
      }

      // Tab went to background — use Worker timer (Safari throttles setInterval to 1s+)
      this.isBackgrounded = true;

      // Background timer drives processLoop to keep audio flowing while hidden.
      // For audio-less content (no audio track or audio disabled) without PiP,
      // video decode is skipped AND there's no audio to drive — running the loop
      // would just race the demuxer to EOF (no backpressure → eofReached=true →
      // foreground recovery returns early → video stuck on resume).
      const hasAudio = !!this.trackManager.getActiveAudioTrack() && !this.disableAudio;
      if (hasAudio || this.isPiPActive) {
        this.startBackgroundTimer();
      }

      // In background (not PiP), stop video presentation and clear queue
      // to prevent frame accumulation that blocks audio demuxing via backpressure.
      // At 60fps, the queue fills in ~1.7s and starves audio completely.
      if (!this.isPiPActive && this.videoRenderer) {
        this.videoRenderer.stopPresentationLoop();
        this.videoRenderer.clearQueue();
      }

      // Resume AudioContext if suspended
      if (this.audioRenderer) {
        (this.audioRenderer as any).audioContext?.resume?.().catch(() => {});
      }
    } else if (document.visibilityState === "visible") {
      // Tab visible again — stop background timer, RAF takes over
      this.isBackgrounded = false;
      this.stopBackgroundTimer();

      // The system drops the wake lock whenever the tab hides; now that we're
      // visible again, re-acquire it (idempotent, gated on active playback).
      this.ensureWakeLock();

      if (isPlaying) {
        // Resume AudioContext if needed. On mobile after long background the
        // browser may keep it suspended (autoplay policy — prior gesture has
        // expired). If resume doesn't actually move us back to "running",
        // there's no point pretending playback is live: pause cleanly so the
        // UI shows the play button and the user can tap to resume.
        const audioCtx = (this.audioRenderer as any)?.audioContext as AudioContext | undefined;
        if (audioCtx) {
          try { await audioCtx.resume(); } catch {}
          if (audioCtx.state === "suspended" && !this.muted && !this.disableAudio) {
            Logger.warn(TAG, "AudioContext stuck suspended after foreground — pausing for user tap");
            this.pause();
            return;
          }
        }

        if (!this.isPiPActive) {
          // Video-only recovery via demuxer seek — audio stays completely untouched.
          // In background, video decoding was skipped so video decoder has stale state.
          // We seek the demuxer to the nearest keyframe near current audio position,
          // flush only the video decoder, and set seekTargetTime to skip any
          // re-demuxed audio packets that were already played.
          //
          // clock.getTime() falls back to wall-clock when the audio output is
          // suspended in background, so it can race far ahead of the audio
          // that has actually been rendered. Resolve the real audio position:
          //   - external audio (separate <source kind="audio">) → nativeAudioEl
          //     keeps advancing its own currentTime even while clock raced ahead
          //   - in-container audio → AudioRenderer's clock / buffer end
          //   - no audio at all → fall back to wall-clock
          const nativeAudioTime = this.nativeAudioEl
            ? this.nativeAudioEl.currentTime
            : -1;
          const audioClock = this.audioRenderer.getAudioClock();
          const audioBufferEnd = this.audioRenderer.getMaxScheduledMediaTime();
          const audioTime = nativeAudioTime >= 0
            ? nativeAudioTime
            : audioClock >= 0
              ? audioClock
              : audioBufferEnd > 0
                ? audioBufferEnd
                : this.clock.getTime();
          Logger.debug(TAG, `Foreground recovery: video-only seek to ${audioTime.toFixed(2)}s`);

          // Cancel any in-flight processLoop to avoid demux conflicts during seek
          if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
          }
          const mySessionId = ++this.seekSessionId;

          try {
            // Flush video decoder only — audio decoder and renderer untouched
            if (this.videoDecoder) {
              await this.videoDecoder.flush();
            }
            if (this.videoRenderer) {
              this.videoRenderer.clearQueue();
            }

            if (this.seekSessionId !== mySessionId) return; // Superseded

            // Reset EOF flag — demuxer is being repositioned. For audio-less
            // video, background processLoop may have raced to EOF; without this
            // reset, processLoop would early-return and playback stalls.
            this.eofReached = false;
            this.eofSince = 0;

            // Seek demuxer to nearest keyframe before current audio position
            if (this.demuxer) {
              await this.demuxer.seek(audioTime + this.startTime);
            }

            if (this.seekSessionId !== mySessionId) return; // Superseded

            // Re-anchor the wall clock to audio. While backgrounded the wall
            // clock advanced freely while audio output was suspended; without
            // this re-sync, getTime() will continue reporting the inflated
            // value and Clock's drift correction will snap the wall clock
            // back at 50%/sample, causing time-update jitter on resume.
            this.clock.seek(audioTime + this.startTime);

            // Skip pre-target packets: use audio buffer end (not clock time) so
            // already-scheduled audio isn't re-decoded — prevents fast-forward sound.
            this.seekTargetTime = Math.max(audioTime + this.startTime, audioBufferEnd);
            this.seekingToKeyframe = true;
            this.seekingToKeyframeStartTime = performance.now();
            this.seekCraSeen = 0;
            this.videoChainBrokenUntilKeyframe = false;

            // Restart video pipeline
            if (this.videoRenderer) {
              this.videoRenderer.startPresentationLoop();
            }
            this.processLoop();
          } catch (err) {
            Logger.error(TAG, "Foreground recovery failed", err);
            // Fall back to processLoop restart so playback doesn't stall
            this.processLoop();
          }
        } else {
          // PiP was active — just restart processLoop, video was rendering in PiP
          this.processLoop();
        }

        // Re-acquire once playback has settled back in — idempotent, so it's a
        // no-op if ensureWakeLock above already got it.
        setTimeout(() => this.ensureWakeLock(), 500);
      }
    }
  };

  /**
   * Start background timer using Web Worker (Safari-safe, not throttled)
   */
  private startBackgroundTimer(): void {
    if (this.backgroundWorker || this.backgroundIntervalId) return;
    Logger.debug(TAG, "Starting background playback timer");

    try {
      // Create inline Worker — not throttled in background tabs
      const blob = new Blob([`
        let id = null;
        self.onmessage = (e) => {
          if (e.data === 'start') {
            id = setInterval(() => self.postMessage('tick'), 16);
          } else if (e.data === 'stop') {
            clearInterval(id);
            id = null;
          }
        };
      `], { type: "application/javascript" });
      this.backgroundWorker = new Worker(URL.createObjectURL(blob));
      this.backgroundWorker.onmessage = () => {
        const state = this.stateManager.getState();
        if (state === "playing" || state === "buffering") {
          this.processLoop();
          // In PiP mode, also drive video rendering since main window rAF is stopped
          if (this.isPiPActive && this.videoRenderer) {
            (this.videoRenderer as any).presentationLoop?.();
          }
        }
      };
      this.backgroundWorker.postMessage("start");
    } catch {
      // Worker not available — fallback to setInterval
      Logger.debug(TAG, "Worker unavailable, using setInterval fallback");
      this.backgroundIntervalId = window.setInterval(() => {
        const state = this.stateManager.getState();
        if (state === "playing" || state === "buffering") {
          this.processLoop();
          if (this.isPiPActive && this.videoRenderer) {
            (this.videoRenderer as any).presentationLoop?.();
          }
        }
      }, 16);
    }
  }

  /**
   * Stop background timer
   */
  private stopBackgroundTimer(): void {
    if (this.backgroundWorker) {
      this.backgroundWorker.postMessage("stop");
      this.backgroundWorker.terminate();
      this.backgroundWorker = null;
      Logger.debug(TAG, "Background worker stopped");
    }
    if (this.backgroundIntervalId !== null) {
      clearInterval(this.backgroundIntervalId);
      this.backgroundIntervalId = null;
    }
  }

  /**
   * Start pause-time buffering: demux packets while paused so that
   * resume/seek within buffered area is near-instant (YouTube-like behavior).
   * Stashes packets into pendingPrebufferPackets without decoding.
   */
  private startPauseBuffering(): void {
    if (this.pauseBufferTimerId !== null) return;
    if (!this.demuxer || this.eofReached) return;
    // Native-audio-only: never read the demuxer — that would download the very
    // video body the data-saver mode exists to skip.
    if (this.nativeAudioOnlyPlayback()) return;
    // Only for HTTP sources — local files are already fully available
    if (this.source instanceof FileSource) return;

    Logger.debug(TAG, "Starting pause-time buffering");
    this.pauseBufferTimerId = window.setInterval(() => {
      this.pauseBufferTick();
    }, MoviPlayer.PAUSE_BUFFER_INTERVAL_MS);
  }

  private stopPauseBuffering(): void {
    if (this.pauseBufferTimerId !== null) {
      clearInterval(this.pauseBufferTimerId);
      this.pauseBufferTimerId = null;
      Logger.debug(TAG, "Stopped pause-time buffering");
    }
  }

  private pauseBufferTick = async () => {
    // Guard: only buffer while actually paused
    if (this.stateManager.getState() !== "paused") {
      this.stopPauseBuffering();
      return;
    }
    // Don't interfere with active WASM operations
    if (this.demuxInFlight || !this.demuxer) return;
    if (this.eofReached) {
      this.stopPauseBuffering();
      return;
    }

    // Check if we've buffered enough
    const stashedCount = this.pendingPrebufferPackets.length;
    if (stashedCount >= MoviPlayer.PAUSE_BUFFER_MAX_PACKETS) {
      Logger.debug(TAG, `Pause buffer full: ${stashedCount} packets stashed`);
      this.stopPauseBuffering();
      return;
    }

    // Check audio/video targets
    let audioDuration = 0;
    let videoFrames = 0;
    const activeVideo = this.trackManager.getActiveVideoTrack();
    const activeAudio = this.trackManager.getActiveAudioTrack();
    for (const pkt of this.pendingPrebufferPackets) {
      if (activeVideo && pkt.streamIndex === activeVideo.id) {
        videoFrames++;
      } else if (activeAudio && pkt.streamIndex === activeAudio.id) {
        audioDuration += pkt.duration ?? 0;
      }
    }

    // Only require targets for tracks that actually exist. A video-only or
    // audio-only stream would otherwise never satisfy the AND check, so the
    // loop ran until the 3000-packet safety cap (~30s of demux work) — which
    // shows up as a long burst of "Read: served from full-file cache" log
    // spam after pause.
    const videoTargetMet = !activeVideo || videoFrames >= MoviPlayer.PAUSE_BUFFER_VIDEO_FRAMES;
    const audioTargetMet = !activeAudio || audioDuration >= MoviPlayer.PAUSE_BUFFER_AUDIO_SECONDS;
    if (videoTargetMet && audioTargetMet) {
      Logger.debug(TAG, `Pause buffer targets met: audio=${audioDuration.toFixed(1)}s, video=${videoFrames} frames`);
      this.stopPauseBuffering();
      return;
    }

    try {
      this.demuxInFlight = true;
      this.demuxInFlightStartTime = performance.now();

      // Read a small burst of packets
      const burstSize = 10;
      for (let i = 0; i < burstSize; i++) {
        if (this.stateManager.getState() !== "paused") break;
        if (this.pendingPrebufferPackets.length >= MoviPlayer.PAUSE_BUFFER_MAX_PACKETS) break;

        // Don't push the demuxer past what HttpSource already holds — the next
        // read would otherwise trigger startStream() at the new offset, which
        // resets the sliding window and evicts already-buffered earlier bytes.
        // Pause-time buffering must never request bytes the network hasn't
        // delivered yet.
        if (this.source instanceof HttpSource && !this.source.isFullyCached()) {
          const pos = this.source.getPosition();
          const end = this.source.getBufferedEnd();
          // Keep ~1MB margin so an in-progress demuxer read doesn't straddle
          // the boundary and still trigger a refetch.
          if (pos >= end - 1024 * 1024) {
            this.stopPauseBuffering();
            break;
          }
        }

        const packet = await this.demuxer.readPacket();
        if (!packet) {
          this.eofReached = true;
          break;
        }

        // Only stash packets for active tracks
        if (this.trackManager.isActiveStream(packet.streamIndex)) {
          this.pendingPrebufferPackets.push(packet);
        }
      }
    } catch (e) {
      Logger.error(TAG, "Pause buffer demux error", e);
    } finally {
      this.demuxInFlight = false;
    }
  };

  /**
   * Release WakeLock
   */
  private async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        Logger.debug(TAG, "WakeLock released");
      } catch (error) {
        Logger.warn(TAG, "Failed to release WakeLock", error);
        this.wakeLock = null;
      }
    }
  }

  /**
   * Get buffered time in seconds
   * Returns the furthest time position that has been buffered
   */
  getBufferedTime(): number {
    if (this.streamWrapper) {
      return this.streamWrapper.getBufferEndTime();
    }

    if (!this.mediaInfo || !this.source) {
      return 0;
    }

    const duration = this.mediaInfo.duration;
    if (duration <= 0) {
      return 0;
    }

    // For HttpSource, report the buffered-end *relative* to the source's
    // real read cursor. Converting both endpoints to time via linear ratio
    // fails on VBR (seek byte offset ≠ linear(seek time)). Instead, use the
    // byte delta between buffered-end and the source's last-read position
    // — both are real byte offsets — and apply linear conversion only to
    // that small delta, added to the accurate currentTime.
    //
    // Pause-time buffering decouples the demuxer cursor from the playback
    // clock (demuxer keeps reading ahead while currentTime is frozen),
    // which causes forwardBytes to shrink and the bar to walk backward.
    // Clamp monotonically: the buffered-end never moves backward except on
    // seek (where lastBufferedTime is reset elsewhere).
    if (this.source instanceof HttpSource && this.fileSize > 0) {
      // Small files fully cached in memory should report the entire
      // duration as buffered. The byte-delta math below underreports
      // for VBR content (e.g., a high-bitrate intro consumes more bytes
      // than its share of duration, so currentBytes/fileSize at low
      // currentTime is artificially high → forwardTime is artificially
      // low → bufferedTime = currentTime + forwardTime falls short of
      // duration even though every byte is in memory).
      if (this.source.isFullyCached()) {
        this.lastBufferedTime = duration;
        return duration;
      }
      const bufferedEndBytes = this.source.getBufferedEnd();
      if (bufferedEndBytes > 0) {
        const currentBytes = this.source.getPosition();
        const forwardBytes = Math.max(0, bufferedEndBytes - currentBytes);
        const forwardTime = (forwardBytes / this.fileSize) * duration;
        const computed = this.getCurrentTime() + forwardTime;
        this.lastBufferedTime = Math.max(this.lastBufferedTime, computed);
        return this.lastBufferedTime;
      }
    }

    // For FileSource, the entire file is buffered
    if (this.source instanceof FileSource) {
      return duration;
    }

    // EncryptedHttpSource now extends HttpSource, so the branch above
    // handles its buffered-end reporting too.

    return 0;
  }

  /**
   * Check if current source is HttpSource
   */
  isHttpSource(): boolean {
    return this.source instanceof HttpSource;
  }

  /**
   * Tune the active source's prefetch window. Value is megabytes — the
   * target "buffer ahead of playback" the source should try to maintain.
   * Honored by HttpSource (adjusts its sliding-window cap) and by
   * EncryptedHttpSource (scales PREFETCH_HIGH/LOW_WATER + cache cap).
   * Other source types are silently ignored.
   *
   * Wired to the `buffersize` element attribute so consumers can tune
   * memory vs. seek responsiveness at deploy time without forking.
   */
  setMaxBufferSize(megabytes: number): void {
    if (!(megabytes > 0) || !this.source) return;
    const src = this.source as SourceAdapter & {
      setMaxBufferSize?: (mb: number) => void;
    };
    if (typeof src.setMaxBufferSize === "function") {
      src.setMaxBufferSize(megabytes);
    }
  }

  /**
   * Get buffer start position in bytes (for HttpSource)
   * Returns -1 if not available or not HttpSource
   */
  getBufferStartBytes(): number {
    if (this.source instanceof HttpSource) {
      return this.source.getBufferStart();
    }
    return -1;
  }

  /**
   * Get buffer end position in bytes (for HttpSource)
   * Returns -1 if not available or not HttpSource
   */
  getBufferEndBytes(): number {
    if (this.source instanceof HttpSource) {
      return this.source.getBufferedEnd();
    }
    return -1;
  }

  /**
   * Get buffer start time in seconds (for HttpSource)
   * Converts buffer start bytes to time position using current read position as reference
   */
  getBufferStartTime(): number {
    if (
      !this.mediaInfo ||
      !this.source ||
      !(this.source instanceof HttpSource) ||
      this.fileSize <= 0
    ) {
      return 0;
    }

    const duration = this.mediaInfo.duration;
    // For HttpSource, convert buffer start bytes to time using stable linear estimation
    if (this.source instanceof HttpSource && this.fileSize > 0) {
      const bufferStartBytes = this.source.getBufferStart();
      const ratio = Math.min(1, bufferStartBytes / this.fileSize);
      return ratio * duration;
    }
    return 0;
  }

  /**
   * Lowest time a backward seek can SAFELY land in linear (non-range) playback.
   * The window starts at getBufferStartTime, but a seek's keyframe sits at a
   * lower byte than the linear time→byte estimate (GOP span + VBR), so seeking
   * right at the window edge usually reads just below it and fails. Pad the
   * start by a byte safety margin so the keyframe stays inside the RAM window.
   * Returns 0 for seekable (range-capable) or non-HTTP sources.
   */
  getSeekableStartTime(): number {
    if (
      !this.mediaInfo ||
      !(this.source instanceof HttpSource) ||
      this.fileSize <= 0 ||
      !this.source.isLinearMode()
    ) {
      return 0;
    }
    const MARGIN_BYTES = 96 * 1024 * 1024; // covers a keyframe-before-target gap
    const safeBytes = Math.min(this.fileSize, this.source.getBufferStart() + MARGIN_BYTES);
    return Math.min(
      this.mediaInfo.duration,
      (safeBytes / this.fileSize) * this.mediaInfo.duration,
    );
  }

  /**
   * Get buffer end time in seconds (for HttpSource)
   * Same as getBufferedTime but more explicit
   */
  getBufferEndTime(): number {
    return this.getBufferedTime();
  }

  /**
   * Get the source adapter (for checking buffer status, etc.)
   */
  getSource(): SourceAdapter | null {
    return this.source;
  }

  /**
   * Set log level
   */
  static setLogLevel(level: LogLevel): void {
    Logger.setLevel(level);
    // Also update FFmpeg log level for all active bindings
    updateAllBindingsLogLevel(level);
  }

  /**
   * Get the video element renderer (for faststart conversion access)
   * Returns null if not using MSE mode
   */
  /**
   * Check if video decoding is falling back to software
   */
  isSoftwareDecoding(): boolean {
    return this.videoDecoder ? this.videoDecoder.isSoftware : false;
  }

  /**
   * Embedded cover art for the loaded source, decoded into an ImageBitmap.
   * Null when the source has no attached_pic stream (regular video files,
   * audio files without artwork). Caller MUST NOT close() the bitmap — it
   * is owned by the player and released on destroy() / next load.
   */
  getCoverArt(): ImageBitmap | null {
    return this.coverArt;
  }

  /**
   * Extract embedded cover art once at load and emit a "coverart" event.
   *
   * Runs entirely in a short-lived, isolated thumbnail-style WASM context
   * — the same isolated-demuxer machinery the seek-bar previews use — so
   * reading the artwork packet never moves the MAIN demuxer's file
   * position and therefore can't disturb playback or seeking. Done
   * exactly once (artwork is static), then the context is torn down.
   *
   * Deliberately does NOT surface attached_pic through a new C/WASM
   * StreamInfo field or export: that shifts the WASM memory layout and
   * trips a latent FFmpeg audio overflow into a production-only OOB (see
   * project memory "Album Art Crashes WASM"). Using only the existing
   * thumbnail read/packet exports keeps the WASM binary byte-identical.
   */
  private async extractCoverArt(): Promise<void> {
    // Opt-in via the `thumb` attribute (maps to config.enablePreviews).
    // Without it the audio source just shows the bare strip — no artwork,
    // and no isolated WASM context is spun up at all.
    if (!this.config.enablePreviews) return;

    // Cover art only makes sense for an audio-led source: there must be an
    // audio track and NO real playable video (a real video file's frames
    // are the content, not artwork). getVideoTracks() already excludes the
    // still-image cover stream via the isLikelyCoverArt heuristic, so an
    // audio file with embedded art reports zero video tracks here.
    if (this.trackManager.getAudioTracks().length === 0) return;
    if (this.trackManager.getVideoTracks().length > 0) return;

    const picTracks = this.trackManager.getAttachedPicTracks();
    if (picTracks.length === 0) return;
    // Past this point an art track exists, so the UI is holding off the
    // audio-strip layout waiting for a bitmap. Emit a null "coverart" on every
    // failure exit so the element can stop waiting and fall back to the strip
    // instead of sitting on a blank surface forever.
    if (!this.source || this.fileSize <= 0) {
      this.emit("coverart", null);
      return;
    }

    try {
      // Demuxer owns the isolated-context read; we just turn the encoded
      // bytes into a bitmap and publish it.
      const data = await Demuxer.extractAttachedPicture(
        this.source,
        this.fileSize,
        this.config.wasmBinary,
      );
      if (!data || data.length === 0) {
        this.emit("coverart", null);
        return;
      }

      const codec = (picTracks[0].codec || "").toLowerCase();
      const mime =
        codec === "png"
          ? "image/png"
          : codec === "mjpeg" || codec === "jpeg" || codec === "jpg"
            ? "image/jpeg"
            : codec === "webp"
              ? "image/webp"
              : "image/*";
      // getPacketDataCopy already .slice()s into a fresh, non-shared
      // ArrayBuffer, so it's safe to hand straight to Blob.
      const blob = new Blob([data.buffer as ArrayBuffer], { type: mime });
      const bitmap = await createImageBitmap(blob);

      // Release the previous bitmap before stomping the reference — a stale
      // load → load sequence (playlist next-track) would otherwise leak GPU
      // memory until the next GC cycle.
      this.coverArt?.close?.();
      this.coverArt = bitmap;

      this.emit("coverart", bitmap);
      Logger.info(
        TAG,
        `Cover art extracted: ${bitmap.width}x${bitmap.height} (${codec || "image"})`,
      );
    } catch (err) {
      Logger.warn(TAG, "Cover art extraction failed", err);
      this.emit("coverart", null);
    }
  }

  /**
   * Destroy player and release resources
   */
  destroy(): void {
    Logger.info(TAG, "Destroying player");

    // Release WakeLock
    this.releaseWakeLock();

    // Stop playback
    this.clock.pause();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.stopBackgroundTimer();
    this.stopPauseBuffering();

    // Destroy the adaptive-streaming wrapper (HLS or DASH, via Shaka)
    if (this.streamWrapper) {
      this.streamWrapper.destroy();
      this.streamWrapper = null;
    }

    this.pendingPrebufferPackets = [];

    // Close resources
    this.videoDecoder.close();
    this.audioDecoder.close();

    if (this.videoRenderer) {
      this.videoRenderer.destroy();
    }
    this.audioRenderer.destroy();

    // Close demuxer
    if (this.demuxer) {
      this.demuxer.close();
      this.demuxer = null;
    }

    // Cleanup native audio element (separate audio source)
    if (this.nativeAudioEl) {
      this.nativeAudioEl.pause();
      this.nativeAudioEl.src = "";
      this.nativeAudioEl = null;
    }
    this.revokeNativeAudioObjectUrl();
    this._nativeAudioLogicalUrl = null;

    // Cleanup external subtitles
    this.stopExternalSubtitles();
    this._externalSubCues = [];
    this._subtitleTracks = [];

    // Close source
    if (this.source) {
      this.source.close();
      this.source = null;
    }

    // Clear cache
    this.cache.clear();

    // Clear track manager
    this.clearStreamTrackHandlers();
    this.trackManager.clear();

    // Release cover art bitmap. close() is a no-op on platforms that
    // don't implement it (older Firefox); guard with optional call.
    this.coverArt?.close?.();
    this.coverArt = null;

    // Reset state
    this.stateManager.reset();
    this.mediaInfo = null;

    // Remove all listeners
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    window.removeEventListener("online", this.handleNetworkOnline);
    this.removeAllListeners();

    Logger.info(TAG, "Player destroyed");
  }
}
