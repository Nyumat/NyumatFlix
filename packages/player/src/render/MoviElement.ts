/**
 * Custom HTML element for Movi Player
 * Usage: <movi-player src="video.mp4" autoplay muted></movi-player>
 *
 * Note: Custom element names must contain a hyphen per HTML spec.
 *
 * Supports native video element properties:
 * - src, autoplay, controls, loop, muted, playsinline, preload, poster
 * - width, height, crossorigin
 * - volume, playbackRate, currentTime, duration, paused, ended
 */

import { MoviPlayer } from "../core/MoviPlayer";
import { resolvePresentationMode } from "../core/presentation";
import type {
  SourceConfig,
  RendererType,
  VideoTrack,
  AudioTrack,
  SubtitleTrack,
  DecoderType,
  PlayerState,
  PresentationMode,
  ExternalQualityEntry,
  ChapterMarker,
} from "../types";
import { Logger, LogLevel } from "../utils/Logger";
import {
  chapterSegmentPercent,
  findChapterAtTime,
  introDbSegmentClassName,
} from "../utils/chapterMarkers";
import type { SourceAdapter } from "../source/SourceAdapter";
import {
  CanvasVideoPresenter,
  NativeVideoPresenter,
  type VideoPresenter,
} from "./VideoPresenter";
import { RemotePlaybackController } from "./RemotePlaybackController";

import { SettingsStorage } from "../utils/SettingsStorage";
import { QoECollector, beaconSink, type QoESink, type QoESession } from "../utils/QoE";

const TAG = "MoviElement";

// OSD icon constants — shared across keyboard, button, and context menu handlers
const OSD = {
  loop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`,
  stableAudio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 15v-2M9 15v-4M12 15v-6M15 15v-4M18 15v-2"/></svg>`,
  hdr: `<span style="font-weight:700;font-size:14px;letter-spacing:1px;padding:4px 10px;border:2px solid currentColor;border-radius:6px;">HDR</span>`,
  speed: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.64 18.36a9 9 0 1 1 12.72 0"/><path d="m12 12 4-4"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  subOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M13 15h4"/></svg>`,
  subOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M13 15h4"/><line x1="3" y1="5" x2="21" y2="19" stroke-width="2.5"/></svg>`,
  snapshot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
  rotate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  unmuted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  ambient: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  seekBackward: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><text x="50%" y="54%" font-size="7" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle" dominant-baseline="middle" stroke="none">10</text></svg>`,
  seekForward: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><text x="50%" y="54%" font-size="7" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle" dominant-baseline="middle" stroke="none">10</text></svg>`,
} as const;

export class MoviElement extends HTMLElement {
  private canvas: HTMLCanvasElement;
  private video: HTMLVideoElement;
  private subtitleOverlay: HTMLElement;
  // Off-screen aria-live region that mirrors the current caption text so screen
  // readers announce each cue (the visual overlay is canvas-aligned + holds
  // image-based PGS/DVB cues, so it isn't a reliable SR source on its own).
  private _captionLive: HTMLElement | null = null;
  private _captionObserver: MutationObserver | null = null;
  private _lastCaptionText: string = "";
  // QoE analytics: collects startup/rebuffer/error/decode metrics and fans them
  // to sinks (and a `movi-qoe` DOM event). Heartbeats while playing.
  private _qoe = new QoECollector();
  private _qoeHeartbeat: number | null = null;
  private player: MoviPlayer | null = null;
  private isLoading: boolean = false;
  private _isUnsupported: boolean = false;
  private eventHandlers: Map<string, () => void> = new Map();
  private controlsContainer: HTMLElement | null = null;
  private unmuteOverlay: HTMLButtonElement | null = null;
  // Sticky latch — once the user has heard audio (whether by clicking
  // the pill, dragging the slider, or pressing M), suppress the pill
  // for the rest of the element's life. Re-muting after that is an
  // intentional choice; the pill is only meant to bridge the browser's
  // autoplay-with-sound block, not pester on every manual mute.
  private _userHasUnmuted: boolean = false;
  private brokenIndicator: HTMLElement | null = null;
  private emptyStateIndicator: HTMLElement | null = null;
  // Cover-art canvas painted when the source has embedded album art and no
  // playable video stream. Sits above the WebGL canvas; both children below
  // resize with the host element via updateCoverArtOverlay().
  private coverArtOverlay: HTMLDivElement | null = null;
  private coverArtCanvas: HTMLCanvasElement | null = null;
  private coverArtBitmap: ImageBitmap | null = null;
  // For an audio-only source with NO embedded album art but a `poster` URL, the
  // poster is loaded into a bitmap and painted through the same cover-art canvas
  // (blurred backdrop + centered) so it reads as album art instead of the bare
  // strip. Embedded art (coverArtBitmap) always wins over this.
  private _posterCoverBitmap: ImageBitmap | null = null;
  private _posterCoverUrl: string = ""; // URL the poster bitmap was loaded from
  private _posterCoverLoading: boolean = false;
  // Blurred-backdrop element behind the sharp-art canvas — CSS filter:blur()
  // (cross-browser Gaussian, unlike canvas ctx.filter).
  private _coverArtBgEl: HTMLDivElement | null = null;
  // A small data URL of the embedded album art, generated once per source, so
  // the CSS-blurred backdrop can point at it too (background-image needs a URL;
  // the embedded art arrives as an ImageBitmap with none).
  private _coverArtBgUrl: string = "";
  // True once cover-art extraction has settled for the current source (bitmap
  // arrived OR extraction failed). Until then, if the source has an art track,
  // we hold the audio-strip layout off so the player doesn't flash strip→cover.
  private _coverArtResolved: boolean = false;
  // The last audio-strip value we dispatched to the embedding page. Survives
  // load() (unlike the movi-audio-strip class) so a strip↔non-strip switch is
  // detected even across a source change. null = never told the page yet.
  private _lastStripDispatched: boolean | null = null;
  private controlsTimeout: number | null = null;
  private isOverControls: boolean = false;
  private isSeeking: boolean = false;
  private pendingSeekTarget: number | null = null; // Coalesces rapid currentTime sets while a seek is in flight
  private _pendingSeek: number | null = null; // Seek requested before the player was ready; applied on the next seekable state
  private isDragging: boolean = false;
  private isTouchDragging: boolean = false;

  // Gesture tracking
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTime: number = 0;
  private gesturePerformed: boolean = false; // Track if a gesture was performed
  private clickTimer: number | null = null; // Timer to delay single click for double click detection
  private lastSeekTime: number = 0; // Track last seek time to prevent accidental pauses
  private lastSeekSide: "left" | "right" | null = null;
  private cumulativeSeekAmount: number = 0;
  // The last *target* asked for by a chained relative seek. Async seeks
  // mean this.currentTime lags behind during a burst, so we chain off
  // the previous target instead of re-reading the still-stale playback
  // time — otherwise rapid presses count phantom seconds the playhead
  // never travelled.
  private _seekChainTarget: number | null = null;
  private _contextMenuVisible: boolean = false;
  private _contextMenuJustClosed: boolean = false;
  // Body-level portal for the desktop right-click menu so it can escape any
  // overflow:hidden / clipping ancestor of the player and feel native. The menu
  // element is moved here on open and back to the shadow root on close.
  private _menuPortalHost: HTMLElement | null = null;
  private _menuPortalRoot: ShadowRoot | null = null;
  private _menuHome: Node | null = null;
  private lastTouchTime: number = 0;
  // Press-and-hold-to-2x (touch): a long-press on the video speeds playback to
  // 2x while held and reverts on release (YouTube-style). Since long-press now
  // drives this gesture, the context menu opens from the gear button instead —
  // _openMenuViaGear lets the gear's synthetic contextmenu through the
  // touch-long-press gate in preventDefaultContextMenu.
  private _holdSpeedTimer: number | null = null;
  private _holdSpeedActive: boolean = false;
  private _rateBeforeHold: number = 1;
  private _openMenuViaGear: boolean = false;

  // Media Session (OS lock-screen / notification / hardware-key controls).
  // Action handlers are registered once per element (idempotent overwrite is
  // cheap but the flag avoids re-binding on every source load); metadata,
  // playbackState and positionState are refreshed as the player changes.
  private _mediaSessionReady: boolean = false;
  // Last position pushed to the OS scrubber, to throttle setPositionState to
  // ~1s granularity (timeUpdate can fire far more often). A jump > 1s (seek)
  // also trips the update so the lock-screen scrubber snaps immediately.
  private _mediaSessionLastPos: number = -1;
  // Data-URL snapshot of the decoded poster/first frame, captured off the
  // canvas for a source with NO explicit `poster` attribute — the still frame
  // such a source paints on canvas (via the postertime / frame-0 seek) never
  // becomes a URL otherwise, so the OS lock screen would have no thumbnail.
  // Reset on dispose.
  private _mediaSessionArtworkUrl: string | null = null;

  // Nerd Stats
  private _nerdStatsVisible: boolean = false;
  private _currentManualRotation: number = 0; // Track for thumbnail margin re-apply
  private _timelineGenerating: boolean = false;
  private _timelineCancelled: boolean = false;
  private _timelineComplete: boolean = false;
  private _timelineNextIndex: number = 0;
  private nerdStatsInterval: number | null = null;
  private networkSpeedHistory: number[] = []; // speed samples for graph

  // Stutter hint: on a heavy source the decoder can't keep up above 1x, so the
  // video drops frames (audio stays smooth). Detect a sustained low presented-
  // fps while playing >1x and nudge the user toward 1x once, with a long
  // cooldown so it never nags.
  private _stutterInterval: number | null = null;
  private _stutterLastPresented: number = 0;
  private _stutterSeconds: number = 0;
  private _stutterCooldown: boolean = false;
  private _stutterCooldownTimer: number | null = null;
  private static readonly GRAPH_MAX_SAMPLES = 60; // 30 seconds of data (500ms interval)

  // Internal state
  private _src: string | File | null = null;
  // Caller-supplied SourceAdapter — wins over _src when present. Lets users
  // wire any custom protocol (WebSocket, WebRTC data channel, IndexedDB,
  // bespoke encryption, etc.) into the element without losing the UI.
  private _sourceAdapter: SourceAdapter | null = null;
  // Custom HTTP headers applied to all media network requests (manifest +
  // segments for streams, progressive downloads too). Set declaratively via the
  // `headers` attribute (JSON) or programmatically via the `headers` property.
  private _headers: Record<string, string> | null = null;
  // Audio-only (data-saver) mode: skip video decode (CPU) and, for adaptive
  // streams, fetch only audio (bandwidth). Toggleable via the `audioonly`
  // attribute or the `audioOnly` property. The UI shows the album-art / strip.
  private _audioOnly: boolean = false;
  private _audioSrc: string | null = null; // Separate audio source URL
  // Pre-muxed video qualities declared via multiple <source> tags with
  // data-height / data-label. Lets the player drive a YouTube-style quality
  // menu for plain MP4 sources (where there's no HLS manifest to enumerate).
  private _videoQualities: { src: string; type?: string; height: number; label: string; fps?: number; badge?: string }[] = [];
  private _audioTracks: { src: string; type?: string; lang: string; label: string }[] = []; // Multi-language audio
  private _subtitleTracks: {
    src: string;
    lang: string;
    label: string;
    format?: string;
    default?: boolean;
    id?: string;
  }[] = [];
  private _presentation: PresentationMode | null = null;
  private _videoPresenter: VideoPresenter | null = null;
  private _remotePlayback: RemotePlaybackController | null = null;
  private _nativeCueStyle: HTMLStyleElement | null = null;
  private _nativeSubDelayFrameId: number | null = null;
  private _castFallbackSrc: string = "";
  private _autoplay: boolean = false;
  // True from the moment an autoplay attempt is kicked off until playback
  // actually reaches "playing" or the browser blocks it. While set, the
  // center play overlay stays hidden — otherwise the big play icon flashes
  // over the first frame during the brief pre-play startup window even
  // though the player is about to start on its own.
  private _autoplayStarting: boolean = false;
  // Autoplay was requested while the tab was hidden — deferred until the tab
  // is visible (a backgrounded first-play seek gets throttled and stalls in
  // buffering). _onVisibilityChange starts it when the tab is shown.
  private _autoplayPendingVisible: boolean = false;
  // True when autoplay-with-sound was blocked by the browser and we fell
  // back to muted playback (YouTube/Twitter behaviour). Unlike the `muted`
  // attribute, this is a runtime decision the user never asked for — so the
  // "Tap to unmute" pill must surface even without a `controls` attribute,
  // since the pill is the only path back to audio. Cleared the moment the
  // user unmutes (set muted / volume slider both latch _userHasUnmuted).
  private _autoMutedForAutoplay: boolean = false;
  // True once playback has actually reached "playing" at least once.
  // Distinguishes a real user pause (worth surfacing the controls bar
  // for) from the synthetic "paused" state the initial poster seek
  // lands in before the user has even pressed play.
  private _hasEverPlayed: boolean = false;
  // Set briefly by the loop handler so the next end → play transition
  // doesn't surface the centre pause-confirmation icon. Loop replay
  // isn't a user click, so the "I clicked and now it's playing" flash
  // would just look like a glitch at every loop boundary. Cleared
  // once the player has settled into "playing" again.
  private _loopRestartInFlight: boolean = false;
  private _pendingPlay: boolean = false;
  private _elementPlayPromise: Promise<void> | null = null;
  private _autoplayInvoked: boolean = false;
  // True while loading spinner + play() must wait for FileSource preload to
  // complete (mobile only, height >= 2160). Released by the player's
  // 'preloadcomplete' event, which always fires once preload settles.
  private _preloadGateActive: boolean = false;
  // True when the resume dialog was deferred because FileSource preload
  // hadn't settled yet. Surfaced by the preloadcomplete handler. Independent
  // of _preloadGateActive — applies to every FileSource, not just mobile 4K+.
  private _resumeDialogPending: boolean = false;
  private _posterTime: string | null = null;
  private _generatedPosterUrl: string | null = null;
  // Bump on every src change / dispose so in-flight postertime generators
  // can detect they're stale and bail instead of overwriting the new source's
  // poster (or flashing an old-source poster during a switch).
  private _posterGenId: number = 0;
  private _controls: boolean = false;
  private _loop: boolean = false;
  private _muted: boolean = false;
  private _playsinline: boolean = false;
  private _preload: "none" | "metadata" | "auto" = "auto";
  private _poster: string = "";
  private _volume: number = 1.0;
  private _playbackRate: number = 1.0;
  // Subtitle delay in seconds (VLC/mpv sign convention). Not persisted to
  // SettingsStorage — sync drift is per-source, so a global value would
  // mis-shift unrelated videos.
  private _subtitleDelay: number = 0;
  // User-customizable subtitle appearance. Applied as CSS variables on the
  // host element so the shadow-DOM subtitle CSS can read them. Persisted
  // to localStorage so the user's choice survives reloads.
  private _subtitleSettings: {
    sizeMult: number;
    color: string;
    bgAlpha: number;
    edge: "none" | "shadow" | "outline" | "raised";
  } = {
    sizeMult: 1,
    color: "#FFFFFF",
    bgAlpha: 0.75,
    edge: "shadow",
  };
  private _ambientMode: boolean = false;
  private _renderer: RendererType = "canvas";
  private _objectFit: "contain" | "cover" | "fill" | "zoom" | "control" =
    "contain"; // Configuration mode
  private _currentFit: "contain" | "cover" | "fill" | "zoom" = "contain"; // Actual fit being applied
  private _thumb: boolean = false;
  // True once the source falls back to linear (forward-only) playback: server
  // has no Range support and the file is too big to cache whole. Hides the
  // timeline and disables seeking + thumbnails.
  private _linearMode: boolean = false;
  private _hdr: boolean = true; // HDR enabled by default
  private _theme: "dark" | "light" = "dark"; // Default theme
  private _sw: DecoderType = "auto"; // Preferred decoder mode (auto or software)
  // True when `sw` was flipped to software as a per-source fallback (user
  // clicked "Try software" on the broken indicator for this specific video).
  // Reset on dispose so the next source gets a fresh hardware attempt
  // instead of inheriting a fallback that was only needed for the prior file.
  private _swForcedForCurrentSource: boolean = false;
  // Guards the sw-attr-change callback from auto-reloading during dispose().
  private _suppressSwReload: boolean = false;

  private _fps: number = 0; // Custom frame rate (0 = auto from video)
  // @deprecated alias for `playsinline` — gestures-only-in-fullscreen is now
  // driven by playsinline; kept so existing `gesturefs` markup keeps working.
  private _gesturefs: boolean = false;
  private _noHotkeys: boolean = false; // Disable keyboard shortcuts if true
  private _startAt: number = 0; // Start time in seconds
  private _fastSeek: boolean = false; // Enable skip controls (buttons, keys, gestures) if true
  private _doubleTap: boolean = true; // Enable/disable double tap to seek
  private _themeColor: string | null = null; // Custom theme color
  private _bufferSize: number = 0; // Custom buffer size in seconds
  private _title: string | null = null; // Video title to display
  private _showTitle: boolean = false; // Show title at top if true
  private _resume: boolean = false; // Resume playback from last position (opt-in)
  private _stableVolume: boolean = false; // Stable volume / loudness normalization (opt-in)
  // Audio output device routing (AudioContext.setSinkId). _audioOutputDeviceId
  // is the chosen target ("" = system default; may start as a label substring
  // from the `audiooutput` attribute, resolved against the live device list).
  private _audioOutputDeviceId: string = "";
  private _audioOutputs: Array<{ deviceId: string; label: string }> = [];
  private _audioOutputsBound: boolean = false; // devicechange listener attached
  // 360° VR (equirectangular). Opt-in via the `vr` attribute, or surfaced as a
  // control-bar button when the source carries equirectangular spherical
  // metadata (track.projection from the WASM demuxer).
  private _vr360: boolean = false; // Currently rendering in VR (360 or 180) mode
  private _vrPointerDown: boolean = false; // Mouse drag-to-look in progress
  private _vrMoved: boolean = false; // Drag exceeded the click threshold
  private _vrLastX: number = 0; // Last pointer/touch X for incremental pan
  private _vrLastY: number = 0;
  private _vrPinchDist: number = 0; // Two-finger pinch baseline (touch zoom)
  private _aspectPinchDist: number = 0; // Two-finger pinch baseline (fullscreen aspect-fit)
  private _vrSuppressClick: boolean = false; // Swallow the click that ends a drag
  private _vrPadDragging: boolean = false; // On-screen joystick is being dragged
  private _encrypted: boolean = false;   // Encrypted source mode
  private _tokenUrl: string = "";        // Token endpoint for encrypted playback
  private _videoUrl: string = "";        // Video endpoint for encrypted playback
  private _videoId: string = "";         // Video ID for encrypted playback
  private _resumeSaveInterval: number | null = null; // Interval to save position
  // True while the initial postertime poster seek is in flight (until the
  // clock is reset back to 0). The poster seek lands in a "paused" state which
  // would otherwise persist the poster timestamp (e.g. 2.8s) as the resume
  // position — block resume saves during this window.
  private _posterSeekActive: boolean = false;
  private _titleAutoLoaded: boolean = false; // Track if title was auto-loaded from metadata
  private _resumeCheckedWithTitle: boolean = false; // Track if resume was re-checked after title load
  private _stripTitleAttr: boolean = false; // Guard for suppressing native title tooltip
  private _lastDuration: number = 0; // Track duration changes for title auto-load
  private posterElement!: HTMLImageElement; // Poster image element

  // Ambient mode state
  private _ambientWrapper: string | null = null; // ID of external wrapper element
  private ambientWrapperElement: HTMLElement | null = null; // Reference to external wrapper element
  private _ambientRafId: number | null = null;
  private _lastAmbientSampleTime: number = 0;
  // Wall-clock timestamp (performance.now()) of the last playback-rate change.
  // Ambient sampling skips for a brief cooldown after a rate change so the
  // ~5–15ms GPU readback doesn't contend with audio decoder refill, which
  // produces audible "audio late" gaps right after speed switches.
  private _lastRateChangeTime: number = 0;
  private static readonly AMBIENT_RATE_CHANGE_COOLDOWN_MS = 600;
  private _ambientSampleInterval: number = 200; // 5fps; cheap now that we read from a renderer-side 16×16 mirror
  private currentAmbientColors: { r: number; g: number; b: number } = {
    r: 0,
    g: 0,
    b: 0,
  };

  // Context handling state
  private _contextLostTime: number = 0;
  private _contextLostPlaying: boolean = false;
  private _lastFrameSnapshot: string = ""; // dataURL captured before backgrounding, used as poster during context-loss recovery
  private _snapshotPosterActive: boolean = false;
  private _snapshotPosterPrev: { src: string; display: string } | null = null;
  private _showSnapshotPoster = () => {
    if (!this._lastFrameSnapshot || !this.posterElement) return;
    if (this._snapshotPosterActive) return;
    this._snapshotPosterPrev = {
      src: this.posterElement.src,
      display: this.posterElement.style.display,
    };
    this.posterElement.src = this._lastFrameSnapshot;
    this.posterElement.style.display = "block";
    this._snapshotPosterActive = true;
  };

  private _hideSnapshotPoster = () => {
    if (!this._snapshotPosterActive || !this.posterElement) return;
    const prev = this._snapshotPosterPrev;
    this.posterElement.src = prev?.src ?? "";
    this.posterElement.style.display = prev?.display ?? "none";
    this._snapshotPosterActive = false;
    this._snapshotPosterPrev = null;
  };

  private _onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      // Capture last visible frame BEFORE the OS may kill the GL context.
      if (this.canvas) {
        try {
          const dataUrl = this.canvas.toDataURL("image/jpeg", 0.85);
          if (dataUrl && dataUrl.length > 32) {
            this._lastFrameSnapshot = dataUrl;
          }
        } catch { /* tainted canvas */ }
      }
      // Pre-emptively show the snapshot as a poster overlay. This way, when
      // the user returns the browser can't briefly paint a corrupt canvas
      // frame between visibility-visible and webglcontextlost firing.
      this._showSnapshotPoster();
    } else {
      // Visible again. If the GL context is still alive, hide the snapshot
      // immediately. If it was lost, leave the snapshot up — handleContextLost
      // / handleContextRestored own the recovery teardown.
      const gl = this.canvas?.getContext("webgl2") as WebGL2RenderingContext | null;
      const lost = gl?.isContextLost?.() ?? false;
      if (!lost && this._contextLostTime === 0) {
        this._hideSnapshotPoster();
      }

      // An autoplay deferred while the tab was hidden — start it now that the
      // tab is visible, so the first-play seek runs with rAF/decoding active
      // instead of stalling in a throttled background.
      if (this._autoplayPendingVisible && this.player && !this._isUnsupported) {
        this._autoplayPendingVisible = false;
        void this._startAutoplay();
      }
    }
  };

  // Observed attributes (native video element attributes)
  static get observedAttributes() {
    return [
      "src",
      "autoplay",
      "controls",
      "loop",
      "muted",
      "playsinline",
      "preload",
      "poster",
      "width",
      "height",
      "crossorigin",
      "volume",
      "playbackrate",
      "subtitledelay",
      "castfallbacksrc",
      "subtitlesize",
      "subtitlecolor",
      "subtitlebg",
      "subtitleedge",
      "ambientmode",
      "ambientwrapper",
      "renderer",
      "presentation",
      "objectfit",
      "thumb",
      "hdr",
      "theme",
      "sw",
      "fps",
      "gesturefs",
      "nohotkeys",
      "startat",
      "fastseek",
      "doubletap",
      "themecolor",
      "buffersize",
      "title",
      "showtitle",
      "resume",
      "stablevolume",
      "encrypted",
      "tokenurl",
      "videourl",
      "videoid",
      "drm",
      "licenseurl",
      "licenseheaders",
      "headers",
      "audioonly",
      "lcevc",
      "lcevcurl",
      "postertime",
      "vr",
      "vrpad",
      "audiooutput",
    ];
  }

  constructor() {
    super();

    // NOTE: do NOT set attributes (or anything that reflects to one, e.g.
    // `this.tabIndex`) here. The Custom Elements spec forbids a constructor
    // from gaining attributes, so `document.createElement("movi-player")`
    // throws `NotSupportedError: The result must not have attributes`.
    // Keyboard focus is enabled in connectedCallback instead. (issue #9)

    // Set log level to INFO by default (change to DEBUG for troubleshooting)
    Logger.setLevel(LogLevel.DEBUG);

    // Create shadow DOM for encapsulation
    const shadowRoot = this.attachShadow({ mode: "open" });

    // Create canvas element
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.display = "block";
    // Prevent default context menu on canvas
    this.canvas.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Add canvas to shadow DOM
    shadowRoot.appendChild(this.canvas);

    // Create video element (hidden by default)
    this.video = document.createElement("video");
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.style.display = "none"; // Default to canvas mode
    this.video.style.objectFit = "contain";
    // Prevent default context menu on video
    this.video.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Add video to shadow DOM
    shadowRoot.appendChild(this.video);

    // Create poster image element (overlay on video/canvas)
    this.posterElement = document.createElement("img");
    this.posterElement.className = "movi-poster-overlay";
    // Pages that ship Cross-Origin-Embedder-Policy: require-corp will block
    // cross-origin images that aren't loaded with CORS. Without this, a host
    // page that opts into COEP gets a silent black overlay instead of the
    // poster.
    this.posterElement.crossOrigin = "anonymous";
    this.posterElement.referrerPolicy = "no-referrer";
    this.posterElement.decoding = "async";
    // YouTube's `maxresdefault.jpg` 404s for videos that never had a 720p
    // thumbnail uploaded; fall back to `hqdefault.jpg` (always present) so
    // the overlay never sits as silent black.
    this.posterElement.addEventListener("error", () => {
      const url = this.posterElement.src;
      const m = url.match(/\/vi\/([\w-]+)\/maxresdefault\.jpg/);
      if (m) {
        this.posterElement.src = `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
      } else {
        this.posterElement.style.display = "none";
      }
    });
    this.posterElement.style.position = "absolute";
    this.posterElement.style.top = "0";
    this.posterElement.style.left = "0";
    this.posterElement.style.width = "100%";
    this.posterElement.style.height = "100%";
    this.posterElement.style.objectFit = "contain";
    this.posterElement.style.display = "none";
    this.posterElement.style.zIndex = "1";
    // Pure visual overlay — let click/dblclick/gesture events pass through to
    // the canvas/video underneath where the player's handlers are attached.
    this.posterElement.style.pointerEvents = "none";
    shadowRoot.appendChild(this.posterElement);

    // Cover-art overlay (only visible for audio-only sources with embedded
    // artwork). Sits above the WebGL canvas but below subtitles + controls.
    // A single canvas paints both the blurred backdrop and the centred art
    // so we don't have to wire two DOM nodes through the resize path.
    this.coverArtOverlay = document.createElement("div");
    this.coverArtOverlay.className = "movi-cover-art-overlay";
    this.coverArtOverlay.style.position = "absolute";
    this.coverArtOverlay.style.inset = "0";
    this.coverArtOverlay.style.display = "none";
    this.coverArtOverlay.style.zIndex = "1";
    this.coverArtOverlay.style.pointerEvents = "none";
    this.coverArtOverlay.style.background = "#000";
    this.coverArtOverlay.style.overflow = "hidden"; // contain the blur bleed
    // Blurred backdrop via CSS filter:blur() — a real Gaussian in EVERY browser
    // (Chrome/Firefox/Safari incl. old versions), unlike canvas ctx.filter which
    // Safari < 17 ignores. Sits behind the sharp-art canvas.
    this._coverArtBgEl = document.createElement("div");
    this._coverArtBgEl.className = "movi-cover-art-bg";
    this.coverArtOverlay.appendChild(this._coverArtBgEl);
    this.coverArtCanvas = document.createElement("canvas");
    this.coverArtCanvas.style.position = "absolute";
    this.coverArtCanvas.style.inset = "0";
    this.coverArtCanvas.style.width = "100%";
    this.coverArtCanvas.style.height = "100%";
    this.coverArtCanvas.style.display = "block";
    this.coverArtOverlay.appendChild(this.coverArtCanvas);
    shadowRoot.appendChild(this.coverArtOverlay);

    // Create subtitle overlay element. Decorative for screen readers — the
    // live region below is their source, so the overlay is aria-hidden.
    this.subtitleOverlay = document.createElement("div");
    this.subtitleOverlay.className = "movi-subtitle-overlay";
    this.subtitleOverlay.setAttribute("aria-hidden", "true");
    shadowRoot.appendChild(this.subtitleOverlay);

    // Off-screen aria-live region: announce each caption to screen readers.
    this._captionLive = document.createElement("div");
    this._captionLive.className = "movi-caption-live";
    this._captionLive.setAttribute("aria-live", "polite");
    this._captionLive.setAttribute("aria-atomic", "true");
    this._captionLive.setAttribute("role", "status");
    shadowRoot.appendChild(this._captionLive);
    // Mirror the visible cue's text into the live region whenever it changes.
    this._captionObserver = new MutationObserver(() => this.mirrorCaption());
    this._captionObserver.observe(this.subtitleOverlay, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    // QoE: mirror every analytics event out as a `movi-qoe` DOM event so
    // embedders can forward it without registering a JS sink.
    this._qoe.addSink((e) =>
      this.dispatchEvent(
        new CustomEvent("movi-qoe", { detail: e, bubbles: true, composed: true }),
      ),
    );

    // Click on the live caption text → open the transcript browser
    // (scrolled to the current cue). The overlay itself stays
    // pointer-events:none so clicks elsewhere keep falling through to
    // the canvas / play-pause toggle; only the rendered .block opts in.
    // Transcript is gated to file sources — streamed sources can't
    // reliably hand back the full cue list.
    this.subtitleOverlay.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".movi-subtitle-block")) return;
      if (!this.player?.isFileSource()) return;
      e.stopPropagation();
      void this.openCuesPanel();
    });

    // Create loading indicator (positioned over video area)
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "movi-loading-indicator";
    loadingIndicator.style.display = "none";
    loadingIndicator.innerHTML = `
      <div class="movi-loader-container"></div>
    `;
    shadowRoot.appendChild(loadingIndicator);

    // Create centered play/pause button
    const centerPlayPause = document.createElement("button");
    centerPlayPause.className = "movi-center-play-pause";
    centerPlayPause.setAttribute("aria-label", "Play/Pause");
    centerPlayPause.innerHTML = `
      <svg class="movi-center-icon-play" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 4v16l14-8z"></path>
      </svg>
      <svg class="movi-center-icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
      </svg>
    `;
    shadowRoot.appendChild(centerPlayPause);

    // Create broken indicator
    this.brokenIndicator = document.createElement("div");
    this.brokenIndicator.className = "movi-broken-indicator";
    this.brokenIndicator.style.display = "none";
    this.brokenIndicator.innerHTML = `
      <div class="movi-broken-container">
        <div class="movi-broken-icon-wrapper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.75 3H13.25C17.5 3 21 6.5 21 10.75V13.25C21 17.5 17.5 21 13.25 21H10.75C6.5 21 3 17.5 3 13.25V10.75C3 6.5 6.5 3 10.75 3Z" fill="rgba(255, 68, 68, 0.05)"/>
            <path d="M12 8V12" stroke="#ff4444"/>
            <path d="M12 16H12.01" stroke="#ff4444"/>
            <path d="M3 3L21 21" stroke="white" stroke-opacity="0.2"/>
          </svg>
        </div>
        <div class="movi-broken-text">
          <h3 class="movi-broken-title">Format Unsupported</h3>
          <p class="movi-broken-message">This video codec is not supported by your browser's hardware acceleration.</p>
          <button class="movi-sw-fallback-btn" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 16h5v5"/>
            </svg>
            Try Software Decoding
          </button>
        </div>
      </div>
    `;
    shadowRoot.appendChild(this.brokenIndicator);

    // Setup software fallback button handler
    const swFallbackBtn = this.brokenIndicator.querySelector(
      ".movi-sw-fallback-btn",
    );
    swFallbackBtn?.addEventListener("click", () => {
      this.enableSoftwareDecoding();
    });

    // Create empty state indicator (shown when no src is set)
    this.emptyStateIndicator = document.createElement("div");
    this.emptyStateIndicator.className = "movi-empty-state";
    this.emptyStateIndicator.style.display = "flex"; // Show by default (no src initially)
    this.emptyStateIndicator.innerHTML = `
      <div class="movi-empty-container">
        <div class="movi-empty-icon-wrapper">
          <svg viewBox="0 0 48 48" fill="none">
            <rect x="8" y="12" width="32" height="24" rx="2" stroke="rgba(255, 255, 255, 0.3)" stroke-width="1.5" fill="rgba(255, 255, 255, 0.02)"/>
            <rect x="6" y="14" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <rect x="6" y="22" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <rect x="6" y="30" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <rect x="40" y="14" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <rect x="40" y="22" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <rect x="40" y="30" width="2" height="4" rx="0.5" fill="rgba(255, 255, 255, 0.2)"/>
            <circle cx="24" cy="24" r="5" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1"/>
            <path d="M22 21l6 3-6 3z" fill="rgba(255, 255, 255, 0.3)"/>
          </svg>
        </div>
        <div class="movi-empty-text">
          <h3 class="movi-empty-title">No Video</h3>
          <p class="movi-empty-message">Add a video source to start playback</p>
        </div>
      </div>
    `;
    shadowRoot.appendChild(this.emptyStateIndicator);

    // Create OSD (On-Screen Display) container
    const osdContainer = document.createElement("div");
    osdContainer.className = "movi-osd-container";
    osdContainer.style.display = "none";
    osdContainer.innerHTML = `
      <div class="movi-osd-icon"></div>
      <div class="movi-osd-text"></div>
    `;
    shadowRoot.appendChild(osdContainer);

    // Persistent "2×" pill shown while a press-and-hold speeds playback up.
    const holdSpeed = document.createElement("div");
    holdSpeed.className = "movi-hold-speed";
    holdSpeed.style.display = "none";
    holdSpeed.innerHTML = `<span>2×</span><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 5l8 7-8 7V5zm9 0l8 7-8 7V5z"/></svg>`;
    shadowRoot.appendChild(holdSpeed);

    // Create context menu FIRST (before setupContextMenu is called)
    this.createContextMenu(shadowRoot);

    // Create controls UI (this will call setupContextMenu)
    this.createControls(shadowRoot);

    // Set default styles
    this.addStyles(shadowRoot);
  }

  private createContextMenu(shadowRoot: ShadowRoot): void {
    Logger.debug(TAG, "[ContextMenu] Creating context menu element");
    const contextMenu = document.createElement("div");
    contextMenu.className = "movi-context-menu";
    contextMenu.style.display = "none";

    // Add backdrop for mobile side panel
    const backdrop = document.createElement("div");
    backdrop.className = "movi-context-menu-backdrop";
    backdrop.style.display = "none";
    shadowRoot.appendChild(backdrop);
    contextMenu.innerHTML = `
      <div class="movi-context-menu-item" data-action="play-pause">
        <svg class="movi-context-menu-icon movi-context-menu-play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <svg class="movi-context-menu-icon movi-context-menu-pause-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span class="movi-context-menu-label">Play</span>
        <span class="movi-context-menu-shortcut">Space</span>
      </div>
      <div class="movi-context-menu-item" data-action="speed">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5.64 18.36a9 9 0 1 1 12.72 0"></path>
          <path d="m12 12 4-4"></path>
        </svg>
        <span class="movi-context-menu-label">Playback Speed</span>
        <span class="movi-context-menu-arrow">▶</span>
      </div>
      <div class="movi-context-menu-submenu" data-submenu="speed">
        <div class="movi-context-menu-item movi-context-menu-back" data-action="back">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span class="movi-context-menu-label">Back</span>
        </div>
        <div class="movi-context-menu-item" data-speed="0.25">0.25x</div>
        <div class="movi-context-menu-item" data-speed="0.5">0.5x</div>
        <div class="movi-context-menu-item" data-speed="0.75">0.75x</div>
        <div class="movi-context-menu-item movi-context-menu-active" data-speed="1">Normal</div>
        <div class="movi-context-menu-item" data-speed="1.25">1.25x</div>
        <div class="movi-context-menu-item" data-speed="1.5">1.5x</div>
        <div class="movi-context-menu-item" data-speed="1.75">1.75x</div>
        <div class="movi-context-menu-item" data-speed="2">2x</div>
      </div>
      <div class="movi-context-menu-item" data-action="fit">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="8" width="12" height="8" rx="1"/>
        </svg>
        <span class="movi-context-menu-label">Aspect Ratio</span>
        <span class="movi-context-menu-arrow">▶</span>
      </div>
      <div class="movi-context-menu-submenu" data-submenu="fit">
        <div class="movi-context-menu-item movi-context-menu-back" data-action="back">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span class="movi-context-menu-label">Back</span>
        </div>
        <div class="movi-context-menu-item" data-fit="contain">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="8" width="12" height="8" rx="1"/></svg>
          <span class="movi-context-menu-label">Contain</span>
        </div>
        <div class="movi-context-menu-item" data-fit="cover">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="1" y="7" width="22" height="10" rx="1"/></svg>
          <span class="movi-context-menu-label">Cover</span>
        </div>
        <div class="movi-context-menu-item" data-fit="fill">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3h18v18H3z"/></svg>
          <span class="movi-context-menu-label">Stretch</span>
        </div>
        <div class="movi-context-menu-item" data-fit="zoom">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
          <span class="movi-context-menu-label">Zoom</span>
        </div>
      </div>
      <div class="movi-context-menu-divider movi-context-menu-divider-audio" style="display: none;"></div>
      <div class="movi-context-menu-item movi-context-menu-item-audio" data-action="audio-track" style="display: none;">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <span class="movi-context-menu-label">Audio Track</span>
        <span class="movi-context-menu-arrow">▶</span>
      </div>
      <div class="movi-context-menu-submenu movi-context-menu-submenu-audio" data-submenu="audio-track" style="display: none;"></div>
      <div class="movi-context-menu-divider movi-context-menu-divider-audiodevice" style="display: none;"></div>
      <div class="movi-context-menu-item movi-context-menu-item-audiodevice" data-action="audio-output" style="display: none;">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2"></rect>
          <circle cx="12" cy="14" r="4"></circle>
          <line x1="12" y1="6" x2="12.01" y2="6"></line>
        </svg>
        <span class="movi-context-menu-label">Audio Output</span>
        <span class="movi-context-menu-arrow">▶</span>
      </div>
      <div class="movi-context-menu-submenu movi-context-menu-submenu-audiodevice" data-submenu="audio-output" style="display: none;"></div>
      <div class="movi-context-menu-divider movi-context-menu-divider-subtitle" style="display: none;"></div>
      <div class="movi-context-menu-item movi-context-menu-item-subtitle" data-action="subtitle-track" style="display: none;">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="14" x="3" y="5" rx="2" ry="2"></rect>
          <path d="M11 9H9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2 M17 9h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2"></path>
        </svg>
        <svg class="movi-context-menu-icon movi-context-menu-subtitle-filled" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
           <path fill-rule="evenodd" clip-rule="evenodd" d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z M11 11 H9.5 V10.5 H7.5 V13.5 H9.5 V13 H11 V14 C11 14.55 10.55 15 10 15 H7 C6.45 15 6 14.55 6 14 V10 C6 9.45 6.45 9 7 9 H10 C10.55 9 11 9.45 11 10 V11 Z M18 11 H16.5 V10.5 H14.5 V13.5 H16.5 V13 H18 V14 C18 14.55 17.55 15 17 15 H14 C13.45 15 13 14.55 13 14 V10 C13 9.45 13.45 9 14 9 H17 C17.55 9 18 9.45 18 10 V11 Z"></path>
        </svg>
        <span class="movi-context-menu-label">Subtitle Track</span>
        <span class="movi-context-menu-arrow">▶</span>
      </div>
      <div class="movi-context-menu-submenu movi-context-menu-submenu-subtitle" data-submenu="subtitle-track" style="display: none;"></div>
      <div class="movi-context-menu-item" data-action="hdr-toggle" style="display: none;">
        <span class="movi-context-menu-icon" style="font-weight:700;font-size:10px;letter-spacing:0.5px;width:16px;text-align:center;overflow:visible;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;">HDR</span>
        <span class="movi-context-menu-label">HDR Mode</span>
        <span class="movi-context-menu-status movi-hdr-status">On</span>
        <span class="movi-context-menu-shortcut">H</span>
      </div>
      <div class="movi-context-menu-divider movi-hdr-divider" style="display: none;"></div>
      <div class="movi-context-menu-item movi-context-menu-pip" data-action="pip" style="display: none;">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="6" rx="1"/>
        </svg>
        <span class="movi-context-menu-label">Picture in Picture</span>
        <span class="movi-context-menu-shortcut">P</span>
      </div>
      <div class="movi-context-menu-item" data-action="fullscreen">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
        <span class="movi-context-menu-label">Fullscreen</span>
        <span class="movi-context-menu-shortcut">F</span>
      </div>
      <div class="movi-context-menu-item" data-action="rotate-video">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
          <path d="M21 3v5h-5"></path>
        </svg>
        <span class="movi-context-menu-label">Rotate Video</span>
        <span class="movi-context-menu-status movi-rotate-status">0°</span>
        <span class="movi-context-menu-shortcut">R</span>
      </div>
      <div class="movi-context-menu-item" data-action="loop-toggle">
        <svg class="movi-context-menu-icon movi-context-menu-loop-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <path d="M17 2l4 4-4 4"></path>
           <path d="M3 11v-1a4 4 0 0 1 4-4h14"></path>
           <path d="M7 22l-4-4 4-4"></path>
           <path d="M21 13v1a4 4 0 0 1-4 4H3"></path>
        </svg>
        <svg class="movi-context-menu-icon movi-context-menu-loop-filled" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
          <path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path>
        </svg>
        <span class="movi-context-menu-label">Loop</span>
        <span class="movi-context-menu-status movi-loop-status">Off</span>
        <span class="movi-context-menu-shortcut">L</span>
      </div>
      <div class="movi-context-menu-item" data-action="stable-audio-toggle">
        <svg class="movi-context-menu-icon movi-context-menu-stable-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <path d="M6 15v-2"></path>
          <path d="M9 15v-4"></path>
          <path d="M12 15v-6"></path>
          <path d="M15 15v-4"></path>
          <path d="M18 15v-2"></path>
        </svg>
        <svg class="movi-context-menu-icon movi-context-menu-stable-filled" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm1 9v2h2v-2H5zm3-2v4h2v-4H8zm3-2v6h2V9h-2zm3 2v4h2v-4h-2zm3 2v2h2v-2h-2z"></path>
        </svg>
        <span class="movi-context-menu-label">Stable Volume</span>
        <span class="movi-context-menu-status movi-stable-audio-status">Off</span>
        <span class="movi-context-menu-shortcut">U</span>
      </div>
      <div class="movi-context-menu-item" data-action="ambient-toggle">
        <svg class="movi-context-menu-icon movi-context-menu-ambient-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2"></path><path d="M12 21v2"></path>
          <path d="M4.22 4.22l1.42 1.42"></path><path d="M18.36 18.36l1.42 1.42"></path>
          <path d="M1 12h2"></path><path d="M21 12h2"></path>
          <path d="M4.22 19.78l1.42-1.42"></path><path d="M18.36 5.64l1.42-1.42"></path>
        </svg>
        <svg class="movi-context-menu-icon movi-context-menu-ambient-filled" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
          <circle cx="12" cy="12" r="5"></circle>
          <path d="M12 1v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M12 21v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M4.22 4.22l1.42 1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M18.36 18.36l1.42 1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M1 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M21 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M4.22 19.78l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
          <path d="M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <span class="movi-context-menu-label">Ambient Mode</span>
        <span class="movi-context-menu-status movi-ambient-status">Off</span>
        <span class="movi-context-menu-shortcut">G</span>
      </div>
      <div class="movi-context-menu-divider"></div>
      <div class="movi-context-menu-item" data-action="snapshot">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <span class="movi-context-menu-label">Snapshot</span>
        <span class="movi-context-menu-shortcut">S</span>
      </div>
      <div class="movi-context-menu-item" data-action="timeline">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="6" height="5" rx="1"></rect>
          <rect x="9" y="3" width="6" height="5" rx="1"></rect>
          <rect x="16" y="3" width="6" height="5" rx="1"></rect>
          <rect x="2" y="10" width="6" height="5" rx="1"></rect>
          <rect x="9" y="10" width="6" height="5" rx="1"></rect>
          <rect x="16" y="10" width="6" height="5" rx="1"></rect>
          <line x1="2" y1="19" x2="22" y2="19"></line>
          <line x1="2" y1="21" x2="22" y2="21"></line>
        </svg>
        <span class="movi-context-menu-label">Timeline</span>
        <span class="movi-context-menu-shortcut">T</span>
      </div>
      <div class="movi-context-menu-item" data-action="nerd-stats">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20V10"></path>
          <path d="M18 20V4"></path>
          <path d="M6 20v-4"></path>
        </svg>
        <span class="movi-context-menu-label">Stats for nerds</span>
        <span class="movi-context-menu-shortcut">I</span>
      </div>
      <div class="movi-context-menu-item" data-action="keyboard-shortcuts">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"></rect>
          <path d="M6 10h0M10 10h0M14 10h0M18 10h0M6 14h12"></path>
        </svg>
        <span class="movi-context-menu-label">Keyboard Shortcuts</span>
        <span class="movi-context-menu-shortcut">?</span>
      </div>
    `;
    shadowRoot.appendChild(contextMenu);

    // Move submenus out of the menu so they escape its overflow containing-block
    // trap. They live as siblings of the menu in shadowRoot, and
    // setupSubmenuHover positions them in :host-relative absolute coordinates.
    const submenuNodes = contextMenu.querySelectorAll(
      ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
    );
    submenuNodes.forEach((node) => shadowRoot.appendChild(node));

    Logger.debug(
      TAG,
      "[ContextMenu] Context menu element appended to shadow root",
      {
        element: contextMenu,
        className: contextMenu.className,
        display: contextMenu.style.display,
      },
    );
  }

  private createControls(shadowRoot: ShadowRoot): void {
    // Overlay is a sibling of the controls container, not a child, so its
    // box can span the whole player (top:0 → bottom:controls-height) and
    // its mouseenter/mouseleave catch the cursor crossing ANY player edge.
    // Nested inside .movi-controls-container it was confined to the bottom
    // strip and only fired when the cursor crossed that small region.
    const overlay = document.createElement("div");
    overlay.className = "movi-controls-overlay";
    shadowRoot.appendChild(overlay);

    const container = document.createElement("div");
    container.className = "movi-controls-container";
    // eslint-disable-next-line no-unsanitized/property -- static template, no user data
    container.innerHTML = `
      <div class="movi-controls-bar" style="position: relative;">
        <div class="movi-progress-container">
          <div class="movi-progress-bar" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuenow="0" aria-valuetext="0:00">
            <div class="movi-progress-buffer"></div>
            <div class="movi-progress-filled"></div>
            <div class="movi-chapter-markers"></div>
            <div class="movi-progress-handle"></div>
          </div>
          <div class="movi-seek-thumbnail" style="display: none;">
             <div class="movi-thumbnail-placeholder" style="display: none;"></div>
             <img class="movi-thumbnail-img" style="display: none;">
             <span class="movi-seek-chapter-title"></span>
             <span class="movi-seek-time">0:00</span>
          </div>
        </div>
        
        <div class="movi-buttons-row">
          <div class="movi-controls-left">
            <button class="movi-btn movi-play-pause" aria-label="Play/Pause">
              <svg class="movi-icon-play" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 4v16l14-8z"></path>
              </svg>
              <svg class="movi-icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
              </svg>
            </button>

            <button class="movi-btn movi-seek-backward" aria-label="Skip Backward 10s">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <text x="50%" y="54%" font-size="7" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle" dominant-baseline="middle" stroke="none">10</text>
              </svg>
            </button>

            <button class="movi-btn movi-seek-forward" aria-label="Skip Forward 10s">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <text x="50%" y="54%" font-size="7" font-family="sans-serif" font-weight="bold" fill="currentColor" text-anchor="middle" dominant-baseline="middle" stroke="none">10</text>
              </svg>
            </button>

            <div class="movi-volume-container">
              <button class="movi-btn movi-volume-btn" aria-label="Mute/Unmute">
                <svg class="movi-icon-volume-high" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <svg class="movi-icon-volume-low" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <svg class="movi-icon-volume-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                  <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>
              </button>
              <div class="movi-volume-slider-container">
                <input type="range" class="movi-volume-slider" min="0" max="2" step="0.01" value="1" aria-label="Volume" aria-valuemin="0" aria-valuemax="200" aria-valuenow="100" aria-valuetext="Volume 100%">
              </div>
            </div>

            <div class="movi-time">
              <span class="movi-current-time">0:00</span>
              <span class="movi-time-separator"> / </span>
              <span class="movi-duration">0:00</span>
              <button class="movi-live-badge" type="button" aria-label="Go to live" title="Go to live edge">
                <span class="movi-live-dot"></span>LIVE
              </button>
            </div>
          </div>

          <div class="movi-controls-right">
            <div class="movi-mobile-expandable">
              <div class="movi-audio-track-container">
                <button class="movi-btn movi-audio-track-btn" aria-label="Audio Track">
                  <svg class="movi-icon-audio-track" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                  </svg>
                </button>
                <div class="movi-audio-track-menu" style="display: none;">
                  <div class="movi-track-menu-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 18V5l12-2v13"></path>
                      <circle cx="6" cy="18" r="3"></circle>
                      <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                    <span>Audio Track</span>
                  </div>
                  <div class="movi-audio-track-list"></div>
                  <div class="movi-track-menu-footer movi-audio-track-footer"></div>
                </div>
              </div>
              <div class="movi-subtitle-track-container">
                <button class="movi-btn movi-subtitle-track-btn" aria-label="Subtitles/Captions">
                  <svg class="movi-icon-subtitle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" ry="2"></rect>
                    <path d="M10 8.5H8a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2 M18 8.5h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2"></path>
                  </svg>
                  <svg class="movi-icon-subtitle-filled" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM10 15H7c-.83 0-1.5-.67-1.5-1.5v-3c0-.83.67-1.5 1.5-1.5h3V11H7.5v2.5h2V13H10v2zm8 0h-3c-.83 0-1.5-.67-1.5-1.5v-3c0-.83.67-1.5 1.5-1.5h3V11h-2.5v2.5h2V13H18v2z"></path>
                  </svg>
                </button>
                <div class="movi-subtitle-track-menu" style="display: none;">
                  <div class="movi-track-menu-header movi-subtitle-track-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" ry="2"></rect>
                      <path d="M10 8.5H8a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2 M18 8.5h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2"></path>
                    </svg>
                    <span>Subtitles</span>
                    <button type="button"
                            class="movi-subtitle-browse-btn"
                            aria-label="Open transcript"
                            title="Transcript">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <line x1="8" y1="6" x2="21" y2="6"/>
                        <line x1="8" y1="12" x2="21" y2="12"/>
                        <line x1="8" y1="18" x2="21" y2="18"/>
                        <circle cx="3.5" cy="6" r="1"/>
                        <circle cx="3.5" cy="12" r="1"/>
                        <circle cx="3.5" cy="18" r="1"/>
                      </svg>
                    </button>
                    <button type="button"
                            class="movi-subtitle-customize-btn"
                            aria-label="Customize captions"
                            title="Customize captions">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                    </button>
                  </div>
                  <div class="movi-subtitle-track-list"></div>
                  <div class="movi-track-menu-footer movi-subtitle-track-footer"></div>
                </div>
              </div>

              <div class="movi-quality-container" style="display: none;">
                <button class="movi-btn movi-quality-btn" aria-label="Quality">
                  <svg class="movi-icon-quality" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  <span class="movi-quality-btn-badge" style="display: none;"></span>
                </button>
                <div class="movi-quality-menu" style="display: none;">
                  <div class="movi-quality-list"></div>
                </div>
              </div>

              <div class="movi-hdr-container">
                <button class="movi-btn movi-hdr-btn" aria-label="Toggle HDR">
                  <svg class="movi-icon-hdr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 7v10M5 12h5M10 7v10M14 7h6a3 3 0 0 1 0 6h-6M17 13l3 4"></path>
                  </svg>
                  <span class="movi-hdr-label">HDR</span>
                </button>
              </div>

              <div class="movi-speed-container">
                <button class="movi-btn movi-speed-btn" aria-label="Playback Speed">
                  <svg class="movi-icon-speed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5.64 18.36a9 9 0 1 1 12.72 0"></path>
                    <path d="m12 12 4-4"></path>
                  </svg>
                </button>
                <div class="movi-speed-menu" style="display: none;">
                  <div class="movi-speed-list">
                    <div class="movi-speed-item" data-speed="0.25">0.25x</div>
                    <div class="movi-speed-item" data-speed="0.5">0.5x</div>
                    <div class="movi-speed-item" data-speed="0.75">0.75x</div>
                    <div class="movi-speed-item movi-speed-active" data-speed="1">Normal</div>
                    <div class="movi-speed-item" data-speed="1.25">1.25x</div>
                    <div class="movi-speed-item" data-speed="1.5">1.5x</div>
                    <div class="movi-speed-item" data-speed="1.75">1.75x</div>
                    <div class="movi-speed-item" data-speed="2">2x</div>
                  </div>
                </div>
              </div>

              <div class="movi-stable-audio-container">
                <button class="movi-btn movi-stable-audio-btn" aria-label="Toggle Stable Audio">
                  <svg class="movi-icon-stable-audio-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                    <path d="M6 15v-2"></path>
                    <path d="M9 15v-4"></path>
                    <path d="M12 15v-6"></path>
                    <path d="M15 15v-4"></path>
                    <path d="M18 15v-2"></path>
                  </svg>
                  <svg class="movi-icon-stable-audio-filled" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm1 9v2h2v-2H5zm3-2v4h2v-4H8zm3-2v6h2V9h-2zm3 2v4h2v-4h-2zm3 2v2h2v-2h-2z"></path>
                  </svg>
                </button>
              </div>

              <button class="movi-btn movi-aspect-ratio-btn" aria-label="Aspect Ratio">
                <svg class="movi-icon-aspect-ratio" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <rect class="movi-aspect-inner" x="6" y="8" width="12" height="8" rx="1"/>
                </svg>
              </button>

              <button class="movi-btn movi-loop-btn" aria-label="Toggle Loop">
                <svg class="movi-icon-loop-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 2l4 4-4 4"></path>
                  <path d="M3 11v-1a4 4 0 0 1 4-4h14"></path>
                  <path d="M7 22l-4-4 4-4"></path>
                  <path d="M21 13v1a4 4 0 0 1-4 4H3"></path>
                </svg>
                <svg class="movi-icon-loop-filled" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                  <path d="M17 2l4 4-4 4"></path><path d="M3 11v-1a4 4 0 0 1 4-4h14"></path><path d="M7 22l-4-4 4-4"></path><path d="M21 13v1a4 4 0 0 1-4 4H3"></path>
                </svg>
              </button>

              <button class="movi-btn movi-cast-btn" aria-label="Cast" style="display:none">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 16.1A5 5 0 0 1 7 11h14"/><path d="M7 16h10"/><path d="M12 20h4"/>
                </svg>
              </button>

              <button class="movi-btn movi-airplay-btn" aria-label="AirPlay" style="display:none">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"/><polygon points="12 15 17 21 7 21 12 15"/>
                </svg>
              </button>

              <button class="movi-btn movi-pip-btn" aria-label="Picture in Picture" style="display:none">
                <svg class="movi-icon-pip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
            </div>

            <button class="movi-btn movi-more-btn" aria-label="More Settings">
              <svg class="movi-icon-more" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <svg class="movi-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            <button class="movi-btn movi-fullscreen-btn" aria-label="Fullscreen">
              <svg class="movi-icon-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
              <svg class="movi-icon-fullscreen-exit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                <path d="M4 14h6v6m10-6h-6v6M4 10h6V4m10 6h-6V4"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
    shadowRoot.appendChild(container);
    this.controlsContainer = container;

    // 360° on-screen pan joystick (YouTube-style compass), top-left. CSS only
    // reveals it when 360 is active AND the controls are visible AND the device
    // has a fine pointer (hidden on touch). Drag the knob to look around; it
    // springs back to centre on release and pans continuously while held.
    const vrPad = document.createElement("div");
    vrPad.className = "movi-vr360-pad";
    vrPad.setAttribute("aria-label", "360° look around");
    // eslint-disable-next-line no-unsanitized/property -- static template, no user data
    vrPad.innerHTML = `
      <div class="movi-vr360-pad-ring">
        <span class="movi-vr360-pad-arrow movi-vr360-pad-arrow-n">▲</span>
        <span class="movi-vr360-pad-arrow movi-vr360-pad-arrow-s">▼</span>
        <span class="movi-vr360-pad-arrow movi-vr360-pad-arrow-w">◀</span>
        <span class="movi-vr360-pad-arrow movi-vr360-pad-arrow-e">▶</span>
        <div class="movi-vr360-pad-knob"></div>
      </div>`;
    shadowRoot.appendChild(vrPad);

    // Unmute pill — shown when the player autoplayed muted (browser
    // policy) and controls are enabled. Mirrors what YouTube/Twitter
    // surface so the user has a one-tap path to audio without hunting
    // for the volume button. updateUnmuteOverlay() flips its visibility
    // based on the current attribute combo and the muted state.
    const unmuteOverlay = document.createElement("button");
    unmuteOverlay.className = "movi-unmute-overlay";
    unmuteOverlay.type = "button";
    unmuteOverlay.setAttribute("aria-label", "Unmute");
    unmuteOverlay.style.display = "none";
    // textContent + appendChild — no innerHTML to keep the security
    // hook happy and avoid an XSS surface even with a static template.
    const unmuteSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    unmuteSvg.setAttribute("viewBox", "0 0 24 24");
    unmuteSvg.setAttribute("fill", "none");
    unmuteSvg.setAttribute("stroke", "currentColor");
    unmuteSvg.setAttribute("stroke-width", "2");
    unmuteSvg.setAttribute("stroke-linecap", "round");
    unmuteSvg.setAttribute("stroke-linejoin", "round");
    unmuteSvg.innerHTML =
      '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
      '<line x1="23" y1="9" x2="17" y2="15"/>' +
      '<line x1="17" y1="9" x2="23" y2="15"/>';
    unmuteOverlay.appendChild(unmuteSvg);
    const unmuteText = document.createElement("span");
    unmuteText.textContent = "Tap to unmute";
    unmuteOverlay.appendChild(unmuteText);
    unmuteOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      this._userHasUnmuted = true;
      this.muted = false;
      // Defensive — updateMuted() should hide it via updateUnmuteOverlay,
      // but if state is mid-flight this guarantees the click feels instant.
      unmuteOverlay.style.display = "none";
    });
    shadowRoot.appendChild(unmuteOverlay);
    this.unmuteOverlay = unmuteOverlay;

    // Create title bar as a separate element outside controls container
    const titleBar = document.createElement("div");
    titleBar.className = "movi-title-bar";
    titleBar.style.display = "none";
    titleBar.innerHTML = `<span class="movi-title-text"></span>`;
    shadowRoot.appendChild(titleBar);

    // Gear button (top-right) → opens the context menu. This is how touch users
    // reach it now that long-press drives hold-to-2x; on desktop it's a
    // discoverable alternative to right-click. Shown with the chrome (its
    // movi-gear-visible class is toggled in show/hideControls).
    const gearBtn = document.createElement("button");
    gearBtn.className = "movi-btn movi-gear-btn";
    gearBtn.setAttribute("aria-label", "Settings");
    gearBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
    gearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Open the context menu via a synthetic contextmenu event; the flag lets
      // it through the touch-long-press gate in preventDefaultContextMenu.
      this._openMenuViaGear = true;
      const rect = this.getBoundingClientRect();
      this.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          composed: true,
          cancelable: true,
          clientX: rect.right - 44,
          clientY: rect.top + 44,
        }),
      );
    });
    shadowRoot.appendChild(gearBtn);

    // Create Nerd Stats overlay
    const nerdStats = document.createElement("div");
    nerdStats.className = "movi-nerd-stats";
    nerdStats.style.display = "none";
    nerdStats.innerHTML = `
      <div class="movi-nerd-stats-header">
        <span class="movi-nerd-stats-title">Stats for nerds</span>
        <button class="movi-nerd-stats-close" aria-label="Close stats">&times;</button>
      </div>
      <div class="movi-nerd-stats-body"></div>
    `;
    shadowRoot.appendChild(nerdStats);

    // Nerd stats close button
    nerdStats.querySelector(".movi-nerd-stats-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleNerdStats(shadowRoot);
    });

    // Create Timeline panel (separate from nerd stats)
    const timelinePanel = document.createElement("div");
    timelinePanel.className = "movi-timeline-panel";
    timelinePanel.style.display = "none";
    timelinePanel.innerHTML = `
      <div class="movi-timeline-header">
        <span class="movi-timeline-title">Timeline</span>
        <button class="movi-timeline-close" aria-label="Close timeline">&times;</button>
      </div>
      <div class="movi-timeline-strip"></div>
      <div class="movi-timeline-status"></div>
    `;
    shadowRoot.appendChild(timelinePanel);

    // Timeline close button
    timelinePanel.querySelector(".movi-timeline-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._timelineCancelled = true;
      timelinePanel.style.display = "none";
      this.focus();
      // Only re-arm the auto-hide countdown if the bar is currently showing —
      // that restarts the timer the open panel had suspended so a stuck bar
      // fades during playback. Never surface a hidden bar here: showControls()
      // on a hidden bar would fade it in and straight back out (a "flash").
      if (!this.controlsContainer?.classList.contains("movi-controls-hidden")) {
        this.showControls();
      }
    });

    // Create Resume Dialog
    const resumeDialog = document.createElement("div");
    resumeDialog.className = "movi-resume-dialog";
    resumeDialog.style.display = "none";
    resumeDialog.innerHTML = `
      <div class="movi-resume-text">Resume from <span class="movi-resume-time">0:00</span>?</div>
      <div class="movi-resume-buttons">
        <button class="movi-resume-btn movi-resume-yes">Resume</button>
        <button class="movi-resume-btn movi-resume-no">Cancel</button>
      </div>
    `;
    shadowRoot.appendChild(resumeDialog);

    resumeDialog.querySelector(".movi-resume-yes")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const time = parseFloat(resumeDialog.dataset.time || "0");
      resumeDialog.style.display = "none";
      this.focus();
      if (this.player && time > 0) {
        // Wait for the seek to fully settle (state out of "seeking") before
        // playing. seek()'s promise resolves once the demuxer.seek + processLoop
        // are kicked off, but state stays "seeking" until the first frame syncs.
        // Calling play() during "seeking" takes a deferred-resume shortcut that
        // skips first-play init (sets _playStartTime, re-aligns demuxer, starts
        // native audio); on a fresh paused load that path drops us back to t=0
        // instead of the resume target. Awaiting "seeked" lets play() run the
        // full first-play pipeline from a settled paused state.
        const player = this.player;
        const onSeeked = () => this.play().catch(() => {});
        player.once("seeked", onSeeked);
        player.seek(time).catch(() => {
          player.off("seeked", onSeeked);
        });
      }
    });

    resumeDialog.querySelector(".movi-resume-no")?.addEventListener("click", (e) => {
      e.stopPropagation();
      resumeDialog.style.display = "none";
      this.clearResumePosition();
      this.focus();
    });

    // Move the selection ring to whichever button the pointer is over, so it
    // tracks the mouse the same way arrow keys move it — hovering Cancel puts
    // the ring on Cancel instead of leaving it stuck on Resume.
    const resumeYes = resumeDialog.querySelector(
      ".movi-resume-yes",
    ) as HTMLElement | null;
    const resumeNo = resumeDialog.querySelector(
      ".movi-resume-no",
    ) as HTMLElement | null;
    const focusResumeBtn = (btn: HTMLElement | null) => {
      resumeYes?.classList.toggle("movi-resume-focused", btn === resumeYes);
      resumeNo?.classList.toggle("movi-resume-focused", btn === resumeNo);
    };
    resumeYes?.addEventListener("pointerenter", () => focusResumeBtn(resumeYes));
    resumeNo?.addEventListener("pointerenter", () => focusResumeBtn(resumeNo));

    // Create Keyboard Shortcuts Panel
    const shortcutsPanel = document.createElement("div");
    shortcutsPanel.className = "movi-shortcuts-panel";
    shortcutsPanel.style.display = "none";
    shortcutsPanel.innerHTML = `
      <div class="movi-shortcuts-header">
        <span class="movi-shortcuts-title">Keyboard Shortcuts</span>
        <button class="movi-shortcuts-close" aria-label="Close">&times;</button>
      </div>
      <div class="movi-shortcuts-body">
        <div class="movi-shortcuts-col">
          <div class="movi-shortcut-row"><kbd>Space</kbd><span>Play / Pause</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>F</kbd><span>Fullscreen</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>P</kbd><span>Picture-in-Picture</span></div>
          <div class="movi-shortcut-row"><kbd>M</kbd><span>Mute / Unmute</span></div>
          <div class="movi-shortcut-row"><kbd>&uarr; / &darr;</kbd><span>Volume</span></div>
          <div class="movi-shortcut-row"><kbd>&larr; / &rarr;</kbd><span>Seek ±10s</span></div>
          <div class="movi-shortcut-row"><kbd>0</kbd><span>Seek to Start</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>Ctrl+&larr;/&rarr;</kbd><span>Frame Step</span></div>
          <div class="movi-shortcut-row"><kbd>+/-</kbd><span>Speed Up/Down</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>V</kbd><span>Cycle Subtitles</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>Z / X</kbd><span>Subtitle Delay</span></div>
          <div class="movi-shortcut-row"><kbd>B</kbd><span>Cycle Audio</span></div>
        </div>
        <div class="movi-shortcuts-col">
          <div class="movi-shortcut-row" data-video-only><kbd>A</kbd><span>Aspect Ratio</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>R</kbd><span>Rotate Video</span></div>
          <div class="movi-shortcut-row"><kbd>L</kbd><span>Loop</span></div>
          <div class="movi-shortcut-row"><kbd>U</kbd><span>Stable Volume</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>H</kbd><span>HDR Mode</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>S</kbd><span>Snapshot</span></div>
          <div class="movi-shortcut-row"><kbd>I</kbd><span>Stats for Nerds</span></div>
          <div class="movi-shortcut-row" data-video-only><kbd>T</kbd><span>Timeline</span></div>
          <div class="movi-shortcut-row"><kbd>?</kbd><span>This Panel</span></div>
        </div>
      </div>
    `;
    shadowRoot.appendChild(shortcutsPanel);

    shortcutsPanel.querySelector(".movi-shortcuts-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      shortcutsPanel.style.display = "none";
    });

    // Subtitle Cues Browser — full-cover modal listing every cue, with
    // search + click-to-seek. Useful for finding the exact dialogue
    // anchor when subs are out of sync against the audio (calculate
    // offset from a known line) and for skimming non-native dialogue.
    const cuesPanel = document.createElement("div");
    cuesPanel.className = "movi-cues-panel";
    cuesPanel.style.display = "none";
    cuesPanel.innerHTML = `
      <div class="movi-cues-header">
        <span class="movi-cues-title">Transcript</span>
        <div class="movi-cues-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <circle cx="11" cy="11" r="7"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input type="search" class="movi-cues-search" placeholder="Search transcript…" aria-label="Search transcript">
        </div>
        <button class="movi-cues-close" aria-label="Close">&times;</button>
      </div>
      <div class="movi-cues-meta"><span class="movi-cues-meta-count">—</span></div>
      <div class="movi-cues-list" role="listbox"></div>
    `;
    shadowRoot.appendChild(cuesPanel);

    cuesPanel.querySelector(".movi-cues-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeCuesPanel();
    });

    // Setup control handlers
    this.setupControlHandlers(shadowRoot);
  }

  private setupControlHandlers(shadowRoot: ShadowRoot): void {
    const playPauseBtn = shadowRoot.querySelector(
      ".movi-play-pause",
    ) as HTMLElement;
    const progressBar = shadowRoot.querySelector(
      ".movi-progress-bar",
    ) as HTMLElement;
    const loopBtn = shadowRoot.querySelector(".movi-loop-btn") as HTMLElement;
    const volumeBtn = shadowRoot.querySelector(
      ".movi-volume-btn",
    ) as HTMLElement;
    const volumeSlider = shadowRoot.querySelector(
      ".movi-volume-slider",
    ) as HTMLInputElement;
    const hdrBtn = shadowRoot.querySelector(".movi-hdr-btn") as HTMLElement;
    const fullscreenBtn = shadowRoot.querySelector(
      ".movi-fullscreen-btn",
    ) as HTMLElement;
    const overlay = shadowRoot.querySelector(
      ".movi-controls-overlay",
    ) as HTMLElement;
    const seekBackwardBtn = shadowRoot.querySelector(
      ".movi-seek-backward",
    ) as HTMLElement;
    const seekForwardBtn = shadowRoot.querySelector(
      ".movi-seek-forward",
    ) as HTMLElement;

    let ignoreHover = false; // Prevent hover immediately after click from re-showing thumb

    // Play/Pause (controls bar button)
    playPauseBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      if (this.player) {
        const state = this.player.getState();
        if (state === "playing" || state === "buffering") {
          this.pause();
        } else {
          // Play if in ready, paused, ended, or any other non-playing state
          this.play();
        }
      }
    });

    // Seek Backward
    seekBackwardBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.performRelativeSeek("left");
    });

    // Seek Forward
    seekForwardBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.performRelativeSeek("right");
    });

    hdrBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hdr = !this.hdr;
      this.showOSD(
        OSD.hdr,
        this.hdr ? "HDR On" : "HDR Off",
      );
    });

    // Loop Toggle
    loopBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.loop = !this.loop;
      this.showOSD(
        OSD.loop,
        this.loop ? "Loop On" : "Loop Off",
      );
    });

    // LIVE badge → jump to the live edge and resume.
    const liveBadge = shadowRoot.querySelector(".movi-live-badge") as HTMLElement;
    liveBadge?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.player?.seekToLive?.();
      this.play();
      this.updateLiveState();
    });

    // Stable Audio Toggle
    const stableAudioBtn = shadowRoot.querySelector(".movi-stable-audio-btn") as HTMLElement;
    stableAudioBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.player) {
        this.stableVolume = !this._stableVolume;
        this.showOSD(
          OSD.stableAudio,
          this._stableVolume ? "Stable Volume On" : "Stable Volume Off",
        );
      }
    });

    // Center play/pause button
    const centerPlayPauseBtn = shadowRoot.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement;
    centerPlayPauseBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      if (this.player) {
        const state = this.player.getState();
        if (state === "playing" || state === "buffering") {
          this.pause();
        } else {
          // Play if in ready, paused, ended, or any other non-playing state.
          // Flip the centre icon to "pause" right away. The first play has to
          // seek/buffer before the state actually reaches "playing", so keying
          // the icon off the raw state left the play triangle showing for that
          // whole startup window — the click felt unacknowledged. Optimistic
          // swap here; updatePlayPauseIcon reconciles once playback settles.
          const centerPlayIcon = centerPlayPauseBtn.querySelector(
            ".movi-center-icon-play",
          ) as HTMLElement | null;
          const centerPauseIcon = centerPlayPauseBtn.querySelector(
            ".movi-center-icon-pause",
          ) as HTMLElement | null;
          centerPlayIcon?.style.setProperty("display", "none");
          centerPauseIcon?.style.setProperty("display", "block");
          this.play();
        }
      }
    });

    // Seek Thumbnail Helpers
    const thumbnail = shadowRoot.querySelector(
      ".movi-seek-thumbnail",
    ) as HTMLElement;
    const thumbnailTime = shadowRoot.querySelector(
      ".movi-seek-time",
    ) as HTMLElement;
    const thumbnailImg = shadowRoot.querySelector(
      ".movi-thumbnail-img",
    ) as HTMLImageElement;

    let previewDebounce: number | null = null;
    let lastPreviewUrl: string | null = null;
    let hoverIntentTimer: number | null = null;
    let lastHoverEvent: MouseEvent | null = null;
    let hideTimer: number | null = null;
    let showRafId: number | null = null;

    // Queue state for serialized preview fetching
    const previewLoopState = {
      isFetching: false,
      nextTime: null as number | null,
    };

    const processPreviewQueue = async () => {
      if (previewLoopState.isFetching || previewLoopState.nextTime === null)
        return;

      previewLoopState.isFetching = true;
      const timeToFetch = previewLoopState.nextTime;
      previewLoopState.nextTime = null; // Clear pending

      try {
        if (!this.player) return;
        // 360°: pass the live viewing angle so the preview reprojects the
        // equirect frame to what the user currently sees (2D → undefined).
        const vrView = this._vr360
          ? (this.player as any).getVR360View?.()
          : undefined;
        const blob = await (this.player as any).getPreviewFrame?.(
          timeToFetch,
          vrView,
        );

        // Update UI if we got a blob
        if (blob && thumbnailImg) {
          if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
          lastPreviewUrl = URL.createObjectURL(blob);
          thumbnailImg.src = lastPreviewUrl;

          // Show image (Hide static)
          const thumbnailPlaceholder = shadowRoot.querySelector(
            ".movi-thumbnail-placeholder",
          ) as HTMLElement;
          if (thumbnailPlaceholder) thumbnailPlaceholder.style.display = "none";
          thumbnailImg.style.display = "block";

          // Re-apply rotation transform + margin on each preview load. Skip for
          // 360° previews — those are already reprojected to the upright view,
          // so a CSS rotate would double-transform them.
          if (!this._vr360) this.applyThumbnailRotation(thumbnailImg);
          else thumbnailImg.style.transform = "";
        }
      } catch (e) {
        // Ignore aborts
      } finally {
        previewLoopState.isFetching = false;
        // If another time was requested while we were busy, loop again immediately
        if (previewLoopState.nextTime !== null) {
          processPreviewQueue();
        }
      }
    };

    const requestPreview = (time: number) => {
      if (!this.player || !thumbnailImg) return;

      const thumbnailPlaceholder = shadowRoot.querySelector(
        ".movi-thumbnail-placeholder",
      ) as HTMLElement;

      // Cancel pending timer
      if (previewDebounce) clearTimeout(previewDebounce);

      // Always switch to static noise when invalidating/debouncing
      thumbnailImg.style.display = "none";
      if (thumbnailPlaceholder) thumbnailPlaceholder.style.display = "block";

      // Schedule this time
      previewLoopState.nextTime = time;

      // Short debounce: hover previews far from the playhead need a fresh
      // network fetch, so the debounce is pure added latency. 150ms made a
      // far-position hover feel ~4s vs <2s for a real seek. The serialized
      // single-flight queue (processPreviewQueue) already coalesces rapid
      // moves — it drops to the latest pending time when a fetch finishes —
      // so a tight debounce won't flood the network.
      previewDebounce = window.setTimeout(() => {
        processPreviewQueue();
      }, 40);
    };

    // Helper to show/update thumbnail AND progress visuals during dragging/hovering
    const updateScrubbingUI = (
      clientX: number,
      showPreview: boolean = true,
    ) => {
      if (!progressBar || !thumbnail || !thumbnailTime) return;

      const rect = progressBar.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, offsetX / rect.width));
      const duration = this.duration;

      // Update visual progress bar immediately only when dragging
      if (this.isDragging || this.isTouchDragging) {
        const progressFilled = shadowRoot.querySelector(
          ".movi-progress-filled",
        ) as HTMLElement;
        const progressHandle = shadowRoot.querySelector(
          ".movi-progress-handle",
        ) as HTMLElement;
        if (progressFilled) progressFilled.style.width = `${percent * 100}%`;
        if (progressHandle) progressHandle.style.left = `${percent * 100}%`;
      }

      if (duration <= 0) return;

      // If preview is disabled (e.g. on touch start), strictly hide/don't show
      if (!showPreview) {
        return;
      }

      const time = this.barFractionToTime(percent);
      thumbnailTime.textContent = this.formatTime(time);

      // Show chapter title if hovering over a chapter
      const chapterTitleEl = shadowRoot.querySelector(".movi-seek-chapter-title") as HTMLElement;
      if (chapterTitleEl) {
        const chapters = this.player?.getChapters() ?? [];
        const chapter = findChapterAtTime(chapters, time);
        if (chapter) {
          chapterTitleEl.textContent = chapter.title;
          chapterTitleEl.style.display = "block";
        } else {
          chapterTitleEl.style.display = "none";
        }
      }

      // In linear (non-range) playback only frames inside the buffered RAM
      // window can be previewed. Outside it the thumbnailer either fails
      // (behind — bytes discarded) or clamps to the last buffered keyframe and
      // returns a STALE frame (ahead — not yet downloaded). Suppress the
      // preview there so a wrong/old thumbnail never shows.
      const previewInWindow =
        !this._linearMode ||
        !this.player ||
        (time >= (this.player.getBufferStartTime?.() ?? 0) &&
          time <= (this.player.getBufferEndTime?.() ?? duration));

      if (this._thumb && previewInWindow) {
        requestPreview(time);
      } else {
        if (thumbnailImg) thumbnailImg.style.display = "none";
        const thumbnailPlaceholder = shadowRoot.querySelector(
          ".movi-thumbnail-placeholder",
        ) as HTMLElement;
        if (thumbnailPlaceholder) thumbnailPlaceholder.style.display = "none";
      }

      // Position Tooltip
      let leftPos = offsetX;
      const tooltipWidth = this._thumb ? 160 : 60;
      if (leftPos < tooltipWidth / 2) leftPos = tooltipWidth / 2;
      if (leftPos > rect.width - tooltipWidth / 2)
        leftPos = rect.width - tooltipWidth / 2;

      thumbnail.style.left = `${leftPos}px`;
      thumbnail.style.display = "flex";

      // Cancel previous pending show
      if (showRafId) {
        cancelAnimationFrame(showRafId);
      }

      // Only add visible class in next frame to trigger transition
      showRafId = requestAnimationFrame(() => {
        showRafId = null;
        // Guard: If we are hiding (timer set), hidden (display none), or in deadzone (ignoreHover), don't show
        if (hideTimer || thumbnail.style.display === "none" || ignoreHover)
          return;
        thumbnail.classList.add("visible");
      });

      // Cancel any pending hide timers
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };

    const hideThumbnail = (delay = 150) => {
      if (!thumbnail) return;

      // Cancel pending show
      if (showRafId) {
        cancelAnimationFrame(showRafId);
        showRafId = null;
      }

      if (hideTimer) clearTimeout(hideTimer);

      const doHide = () => {
        thumbnail.classList.remove("visible");
        if (previewDebounce) clearTimeout(previewDebounce);

        // If immediate (delay 0), hide immediately. Otherwise wait for transition.
        const transitionDelay = delay === 0 ? 0 : 150;

        setTimeout(() => {
          if (!thumbnail.classList.contains("visible")) {
            thumbnail.style.display = "none";
            if (thumbnailImg) thumbnailImg.style.display = "none";
            const thumbnailPlaceholder = shadowRoot.querySelector(
              ".movi-thumbnail-placeholder",
            ) as HTMLElement;
            if (thumbnailPlaceholder)
              thumbnailPlaceholder.style.display = "block";
          }
        }, transitionDelay);
      };

      if (delay === 0) {
        doHide();
        hideTimer = null;
      } else {
        hideTimer = window.setTimeout(() => {
          doHide();
          hideTimer = null;
        }, delay);
      }
    };

    progressBar?.addEventListener("mousedown", async (e) => {
      if (this.isLoading || this._isUnsupported || !this.player) return;
      e.stopPropagation();
      this.isDragging = true;
      this.showControls();
      updateScrubbingUI(e.clientX);
      // Don't seek yet, standard practice is to seek on release or drag depending on config
      // User requested seek on release only
    });

    document.addEventListener("mousemove", async (e) => {
      if (this.isDragging) {
        this.showControls();
        updateScrubbingUI(e.clientX);
      }
    });

    document.addEventListener("mouseup", async (e) => {
      // Only react to mouseup if we were actively dragging the progress
      // bar — otherwise any click anywhere on the host page (a button on
      // the embedding site, an unrelated link) was waking the player
      // controls. The post-drag bookkeeping below (seek, isOverControls,
      // showControls) is only meaningful at the end of a scrub.
      if (!this.isDragging) return;
      this.isDragging = false; // Stop immediately so the seek's UI updates aren't competing
      await this.seekFromEvent(e); // Actual seek on release
      const controlsContainer = shadowRoot.querySelector(
        ".movi-controls-container",
      ) as HTMLElement;
      if (controlsContainer) {
        const rect = controlsContainer.getBoundingClientRect();
        const stillOverControls =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        this.isOverControls = stillOverControls;
        this.showControls();
      }
    });

    // Touch events for progress bar scrubbing with thumbnail
    progressBar?.addEventListener(
      "touchstart",
      async (e) => {
        if (this.isLoading || this._isUnsupported || !this.player) return;
        if (e.cancelable) e.preventDefault(); // Prevent ghost mouse events
        e.stopPropagation();
        // stopPropagation above keeps the controls-container's touch
        // handler from firing, so its lastTouchTime bookkeeping never
        // runs for scrubs. Set it here so anything that gates on
        // "recent touch" (e.g. the post-play 200ms hide) treats scrub
        // start the same as any other in-chrome touch.
        this.lastTouchTime = Date.now();
        this.isTouchDragging = true;
        hideThumbnail(0); // Ensure thumbnail is hidden at start of touch
        this.showControls();
        const touch = e.touches[0];
        this.touchStartX = touch.clientX; // Record start X for threshold
        updateScrubbingUI(touch.clientX, false); // False = Don't show thumbnail on initial touch
        // Don't seek yet
      },
      { passive: false },
    );

    document.addEventListener(
      "touchmove",
      async (e) => {
        if (this.isTouchDragging && progressBar) {
          this.showControls();
          const touch = e.touches[0];

          // Check for drag threshold to avoid showing thumbnail on slight taps
          const moveThreshold = 20;
          const isActuallyDragging =
            Math.abs(touch.clientX - this.touchStartX) > moveThreshold;

          updateScrubbingUI(touch.clientX, isActuallyDragging);
        }
      },
      { passive: true },
    );

    document.addEventListener("touchend", async (e) => {
      if (this.isTouchDragging) {
        this.isTouchDragging = false; // Stop dragging immediately
        // Mark the touch as recent on release too — the seek below kicks
        // the player back into "playing", whose 200ms-delayed hideControls
        // would otherwise trigger right when the user releases the
        // scrubber and cause a visible flicker (hide → 1s later re-show
        // via the controls-container touchend handler).
        this.lastTouchTime = Date.now();
        const touch = e.changedTouches[0];
        if (touch) {
          await this.seekFromTouchEvent(e); // Actual seek on release
        }
        hideThumbnail(0);
      }
      this.isTouchDragging = false;
    });

    progressBar?.addEventListener("click", async (e) => {
      if (this.isLoading || this._isUnsupported || !this.player) return;
      e.stopPropagation();
      ignoreHover = true;

      // Brute-force safety interval to prevent race conditions during seek
      const safetyInterval = setInterval(() => hideThumbnail(0), 50);

      setTimeout(() => {
        ignoreHover = false;
        clearInterval(safetyInterval);
      }, 500); // 500ms deadzone

      hideThumbnail(0); // Hide immediately on click
      await this.seekFromEvent(e);
      this.showControls();
    });

    // Volume
    volumeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();

      // matchMedia is reliable across browsers; pointerType on click events is
      // not (Android Chrome can synthesize click with pointerType="mouse" from
      // a touch tap, which previously fell through to mute on the first tap).
      // But hybrid / emulated devices can report hover-capable even when the
      // tap is genuinely touch, so also honour the recent-touchstart signal the
      // rest of the player uses — otherwise the first tap mutes instead of
      // opening the slider.
      const noHover = window.matchMedia("(hover: none)").matches;
      const fromTouch = noHover || Date.now() - this.lastTouchTime < 1000;
      const volumeContainer = shadowRoot.querySelector(
        ".movi-volume-container",
      ) as HTMLElement | null;

      // Touch / mobile: first tap opens the slider, second tap mutes.
      if (fromTouch && volumeContainer) {
        if (!volumeContainer.classList.contains("active")) {
          volumeContainer.classList.add("active");

          const closeVolume = (evt: Event) => {
            // composedPath crosses shadow boundaries; evt.target alone gets
            // retargeted to the host, which makes every click look "outside".
            const path = evt.composedPath();
            if (
              !path.includes(volumeContainer) &&
              !path.includes(volumeBtn)
            ) {
              volumeContainer.classList.remove("active");
              document.removeEventListener("click", closeVolume);
            }
          };

          setTimeout(() => {
            document.addEventListener("click", closeVolume);
          }, 10);

          return;
        }
        // Slider already open -> second tap mutes
        this.muted = !this.muted;
        return;
      }

      // Desktop (hover-capable): tap toggles mute, slider opens on hover
      this.muted = !this.muted;
    });
    volumeSlider?.addEventListener("input", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      const target = e.target as HTMLInputElement;
      this.volume = parseFloat(target.value);
    });
    volumeSlider?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
    });

    // Mouse Hover Logic for Thumbnail (Desktop)
    if (progressBar && thumbnail) {
      progressBar.addEventListener("mousemove", (e) => {
        // Ignore if dragging OR recent click
        if (this.isDragging || ignoreHover) return;

        lastHoverEvent = e;

        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }

        // Hover Logic
        if (thumbnail.classList.contains("visible")) {
          updateScrubbingUI(e.clientX);
        } else {
          if (!hoverIntentTimer) {
            hoverIntentTimer = window.setTimeout(() => {
              if (lastHoverEvent) {
                updateScrubbingUI(lastHoverEvent.clientX);
              }
              hoverIntentTimer = null;
            }, 150);
          }
        }
      });

      progressBar.addEventListener("mouseleave", () => {
        // Don't hide if dragging!
        if (this.isDragging) return;

        if (hoverIntentTimer) {
          clearTimeout(hoverIntentTimer);
          hoverIntentTimer = null;
        }
        hideThumbnail(300); // 300ms delay for mouse leave
      });
    }

    // Audio Track
    const audioTrackBtn = shadowRoot.querySelector(
      ".movi-audio-track-btn",
    ) as HTMLElement;
    const audioTrackMenu = shadowRoot.querySelector(
      ".movi-audio-track-menu",
    ) as HTMLElement;

    audioTrackBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      // Toggle menu visibility
      if (audioTrackMenu) {
        const willOpen = !this.isBottomMenuOpen(audioTrackMenu);
        if (willOpen) this.closeAllBottomMenus(".movi-audio-track-menu");
        this.setBottomMenuOpen(audioTrackMenu, willOpen);
        if (willOpen) {
          this.updateAudioTrackMenu();
          this.updateSubtitleTrackMenu();
        }
      }
    });

    // Close menu when clicking outside
    const closeMenuHandler = (e: MouseEvent) => {
      if (
        audioTrackMenu &&
        audioTrackBtn &&
        !audioTrackMenu.contains(e.target as Node) &&
        !audioTrackBtn.contains(e.target as Node)
      ) {
        this.setBottomMenuOpen(audioTrackMenu, false);
      }
    };
    document.addEventListener("click", closeMenuHandler);

    // Subtitle Track
    const subtitleTrackBtn = shadowRoot.querySelector(
      ".movi-subtitle-track-btn",
    ) as HTMLElement;
    const subtitleTrackMenu = shadowRoot.querySelector(
      ".movi-subtitle-track-menu",
    ) as HTMLElement;

    subtitleTrackBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      // Toggle menu visibility
      if (subtitleTrackMenu) {
        const willOpen = !this.isBottomMenuOpen(subtitleTrackMenu);
        if (willOpen) this.closeAllBottomMenus(".movi-subtitle-track-menu");
        this.setBottomMenuOpen(subtitleTrackMenu, willOpen);
        if (willOpen) {
          // Always open on the track list, never on the customize panel.
          this._showingSubtitleCustomize = false;
          this.updateSubtitleTrackMenu();
        }
      }
    });

    // Header gear → toggle the customize panel inside the same dropdown.
    const subtitleCustomizeBtn = shadowRoot.querySelector(
      ".movi-subtitle-customize-btn",
    ) as HTMLElement | null;
    subtitleCustomizeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._showingSubtitleCustomize = !this._showingSubtitleCustomize;
      this.updateSubtitleTrackMenu();
    });

    // Header list icon → open full-cover cues browser.
    const subtitleBrowseBtn = shadowRoot.querySelector(
      ".movi-subtitle-browse-btn",
    ) as HTMLElement | null;
    subtitleBrowseBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close the dropdown first — the cues panel covers the player and
      // any leftover dropdown stacked above it just looks broken.
      const subtitleMenu = this.shadowRoot?.querySelector(
        ".movi-subtitle-track-menu",
      ) as HTMLElement | null;
      this.setBottomMenuOpen(subtitleMenu, false);
      void this.openCuesPanel();
    });

    // Close subtitle menu when clicking outside. Uses composedPath()
    // instead of contains() so a click that originates inside the
    // menu's shadow tree still counts as "inside" — important for the
    // customize-panel's range sliders, where releasing the thumb past
    // the menu's bounding box used to land the click target outside
    // the menu and slam the panel shut mid-drag.
    const closeSubtitleMenuHandler = (e: MouseEvent) => {
      if (!subtitleTrackMenu || !subtitleTrackBtn) return;
      const path = e.composedPath();
      if (path.includes(subtitleTrackMenu) || path.includes(subtitleTrackBtn)) {
        return;
      }
      this.setBottomMenuOpen(subtitleTrackMenu, false);
    };
    document.addEventListener("click", closeSubtitleMenuHandler);

    // Aspect Ratio
    const aspectRatioBtn = shadowRoot.querySelector(
      ".movi-aspect-ratio-btn",
    ) as HTMLElement;
    aspectRatioBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const fits = ["contain", "cover", "fill", "zoom"] as const;
      const current = this._objectFit === "control" ? this._currentFit : this._objectFit;
      const idx = fits.indexOf(current as any);
      const next = fits[(idx + 1) % fits.length];
      if (this._objectFit === "control") {
        this._currentFit = next;
      } else {
        this._objectFit = next;
      }
      this.updateFitMode();
      const labels: Record<string, string> = { contain: "Fit", cover: "Fill", fill: "Stretch", zoom: "Zoom" };
      const osdSvg = MoviElement.ASPECT_ICONS[next] || MoviElement.ASPECT_ICONS.contain;
      this.showOSD(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${osdSvg}</svg>`,
        labels[next],
      );
    });

    // Playback Speed
    const speedBtn = shadowRoot.querySelector(".movi-speed-btn") as HTMLElement;
    const speedMenu = shadowRoot.querySelector(
      ".movi-speed-menu",
    ) as HTMLElement;
    const qualityMenu = shadowRoot.querySelector(
      ".movi-quality-menu",
    ) as HTMLElement;
    const qualityBtn = shadowRoot.querySelector(
      ".movi-quality-btn",
    ) as HTMLElement;

    speedBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (speedMenu) {
        const willOpen = !this.isBottomMenuOpen(speedMenu);
        if (willOpen) this.closeAllBottomMenus(".movi-speed-menu");
        this.setBottomMenuOpen(speedMenu, willOpen);
      }
    });

    qualityBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (qualityMenu) {
        const willOpen = !this.isBottomMenuOpen(qualityMenu);
        if (willOpen) this.closeAllBottomMenus(".movi-quality-menu");
        this.setBottomMenuOpen(qualityMenu, willOpen);
        if (willOpen) this.updateQualityMenu();
      }
    });

    // Refresh disabled/visible state of speed options whenever the menu opens —
    // 8K+ sources cap at 1.5x because hardware decoders genuinely can't
    // sustain ≥120 effective fps decode at 8K (decoder errors and stalls
    // regardless of buffer tuning). 4K handles 2x fine on modern hw.
    // getMaxAllowedRate() returns the active source's ceiling.
    const refreshSpeedMenu = () => {
      const maxRate = this.getMaxAllowedRate();
      shadowRoot.querySelectorAll(".movi-speed-item").forEach((item) => {
        const el = item as HTMLElement;
        const speed = parseFloat(el.dataset.speed || "1");
        const blocked = speed > maxRate;
        el.style.opacity = blocked ? "0.4" : "";
        el.style.pointerEvents = blocked ? "none" : "";
        el.title = blocked
          ? "Not available for this source (8K+ tops out at 1.5x)"
          : "";
      });
    };
    speedBtn?.addEventListener("click", () => {
      // setBottomMenuOpen's animation runs after the click handler above —
      // refresh on the next frame so disabled state applies before the menu
      // actually paints.
      requestAnimationFrame(refreshSpeedMenu);
    });

    // Speed selection
    shadowRoot.querySelectorAll(".movi-speed-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const requested = parseFloat((item as HTMLElement).dataset.speed || "1");
        const speed = Math.min(requested, this.getMaxAllowedRate());
        this.playbackRate = speed;
        this.showOSD(
          OSD.speed,
          `Speed ${speed}x`,
        );
        this.setBottomMenuOpen(speedMenu, false);
      });
    });

    // Close speed menu when clicking outside
    // Close speed/quality menu when clicking outside
    document.addEventListener("click", (e) => {
      const target = e.target as Node;
      if (
        speedMenu &&
        speedBtn &&
        !speedMenu.contains(target) &&
        !speedBtn.contains(target)
      ) {
        this.setBottomMenuOpen(speedMenu, false);
      }
      if (
        qualityMenu &&
        qualityBtn &&
        !qualityMenu.contains(target) &&
        !qualityBtn.contains(target)
      ) {
        this.setBottomMenuOpen(qualityMenu, false);
      }
    });

    // Fullscreen
    fullscreenBtn?.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent triggering overlay click
      this.toggleFullscreen();
    });

    // In an iframe, fullscreen / Document PiP need to be delegated via the
    // iframe's `allow` attribute. Without it the Permissions Policy blocks them
    // and the buttons would be dead controls — so hide them. Scoped to the
    // iframe case only: at top level `fullscreenEnabled` can legitimately be
    // false (e.g. iOS Safari, which has no element-fullscreen) yet still has a
    // working fallback, so we must not hide there.
    const inIframe = this.isEmbeddedIframe();

    // Picture-in-Picture — needs the Document PiP API and, in an iframe,
    // allow="picture-in-picture" (which `pictureInPictureEnabled` reflects, since
    // Document PiP shares that policy).
    const pipBtn = shadowRoot.querySelector(".movi-pip-btn") as HTMLElement;
    const pipCtxItem = shadowRoot.querySelector(
      ".movi-context-menu-pip",
    ) as HTMLElement;
    const pipAvailable =
      "documentPictureInPicture" in window &&
      (!inIframe || (document as Document).pictureInPictureEnabled !== false);
    if (pipBtn) pipBtn.style.display = pipAvailable ? "" : "none";
    if (pipCtxItem) pipCtxItem.style.display = pipAvailable ? "" : "none";
    pipBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePiP();
    });

    // Fullscreen — hide the button + menu item inside an iframe that wasn't
    // granted allow="fullscreen" (document.fullscreenEnabled is false there). A
    // host that drives its own fullscreen via the `movi-fullscreen-request`
    // event can still trigger it through the F shortcut / its own chrome.
    if (inIframe && !document.fullscreenEnabled) {
      const fsBtn = shadowRoot.querySelector(
        ".movi-fullscreen-btn",
      ) as HTMLElement;
      if (fsBtn) fsBtn.style.display = "none";
      const fsCtxItem = shadowRoot.querySelector(
        '.movi-context-menu-item[data-action="fullscreen"]',
      ) as HTMLElement;
      if (fsCtxItem) fsCtxItem.style.display = "none";
    }

    // More Settings (Mobile Horizontal Expansion)
    const moreBtn = shadowRoot.querySelector(".movi-more-btn") as HTMLElement;
    const controlsRight = shadowRoot.querySelector(
      ".movi-controls-right",
    ) as HTMLElement;

    moreBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (controlsRight) {
        const isExpanded = controlsRight.classList.toggle("expanded");

        // Update More icon
        const moreIcon = moreBtn.querySelector(
          ".movi-icon-more",
        ) as HTMLElement;
        const closeIcon = moreBtn.querySelector(
          ".movi-icon-close",
        ) as HTMLElement;
        if (moreIcon && closeIcon) {
          moreIcon.style.display = isExpanded ? "none" : "block";
          closeIcon.style.display = isExpanded ? "block" : "none";
        }
      }
    });

    // Close expansion when clicking outside
    document.addEventListener("click", (e) => {
      if (
        controlsRight?.classList.contains("expanded") &&
        !controlsRight.contains(e.target as Node)
      ) {
        controlsRight.classList.remove("expanded");
        const moreIcon = moreBtn?.querySelector(
          ".movi-icon-more",
        ) as HTMLElement;
        const closeIcon = moreBtn?.querySelector(
          ".movi-icon-close",
        ) as HTMLElement;
        if (moreIcon && closeIcon) {
          moreIcon.style.display = "block";
          closeIcon.style.display = "none";
        }
      }
    });

    // Click on video to play/pause (only on canvas/video area, not controls)
    // Handle clicks on both overlay and canvas
    const handleVideoClick = (e: MouseEvent) => {
      // A bare player (no controls attr) is a non-interactive display surface —
      // a click on it must not toggle play/pause.
      if (!this._controls) return;
      // A 360° look-around drag ends with a synthetic click — swallow it so the
      // drag doesn't also toggle play/pause. A pure click (no drag) still does.
      if (this._vrSuppressClick) {
        this._vrSuppressClick = false;
        e.stopPropagation();
        return;
      }
      // If context menu is open or was just closed, don't toggle play/pause
      if (this._contextMenuVisible || this._contextMenuJustClosed) {
        // Context menu will be hidden by its own click handler
        // Just prevent play/pause toggle
        return;
      }

      // Check if this is a touch-generated click (pointerType or sourceCapabilities)
      const isTouchClick =
        (e as any).pointerType === "touch" ||
        (e as any).sourceCapabilities?.firesTouchEvents;

      // Touch input is fully owned by handleTap (which runs from
      // touchend in setupGestures) — that's where the native-style
      // "tap toggles chrome, never play/pause" rule lives. Synthetic
      // clicks fired off touchend would otherwise reach here and
      // re-introduce the old play/pause toggle on every tap.
      if (isTouchClick) {
        this.gesturePerformed = false; // Reset for next interaction
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // For mouse clicks, always allow (gesturePerformed only applies to touch)

      // Don't trigger if clicking on controls or any control element
      const target = e.target as Element;
      const controlsBar = shadowRoot.querySelector(
        ".movi-controls-bar",
      ) as HTMLElement;
      const centerPlayPause = shadowRoot.querySelector(
        ".movi-center-play-pause",
      ) as HTMLElement;

      // Check if click originated from controls area
      if (
        controlsBar &&
        (controlsBar.contains(target) || target.closest(".movi-controls-bar"))
      ) {
        e.stopPropagation(); // Stop event from bubbling
        return; // Don't toggle play/pause if clicking controls
      }

      // Check if click is on center play/pause button
      if (
        centerPlayPause &&
        (centerPlayPause.contains(target) ||
          target.closest(".movi-center-play-pause"))
      ) {
        e.stopPropagation();
        return; // Don't toggle if clicking on center button (it has its own handler)
      }

      // Check if click is on a button or interactive element
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest(".movi-btn")
      ) {
        e.stopPropagation();
        return; // Don't toggle if clicking on controls
      }

      // If a bottom-controls menu is open, swallow this click to close
      // it instead of toggling play/pause. The user wanted "click on
      // player closes the panel, not play/pause" — a second click then
      // toggles playback like normal.
      if (this.isAnyMenuOpen()) {
        this.closeAllBottomMenus();
        // Re-arm the auto-hide timer now that the menu is gone. While a
        // menu is open showControls() refuses to set the timer (the
        // isAnyMenuOpen gate), so on touch devices the bar would otherwise
        // stay up indefinitely after closing a popup this way.
        this.showControls();
        e.stopPropagation();
        return;
      }

      // Mouse Triple Click logic removed to prevent accidental seeking

      // Delay single click to allow double click detection
      // Cancel any existing timer
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
      }

      // Set timer to execute single click after delay
      this.clickTimer = window.setTimeout(() => {
        // If we've passed all the control checks above, toggle play/pause
        // This means the click is on the video area (canvas/overlay), not on controls
        this.focus(); // Make sure it gets focus for keyboard shortcuts
        const state = this.player?.getState();
        if (state === "playing" || state === "buffering") {
          this.pause();
        } else {
          this.play();
        }
        this.clickTimer = null;
      }, 300); // Wait 300ms to see if double click happens
    };

    overlay?.addEventListener("click", handleVideoClick);
    this.canvas.addEventListener("click", handleVideoClick);
    this.video.addEventListener("click", handleVideoClick);

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Setup gestures
    this.setupGestures(shadowRoot);

    // Setup 360° look-around (mouse/touch drag; two-finger pinch to zoom)
    this.setupVRControls(shadowRoot);

    // Setup context menu
    this.setupContextMenu(shadowRoot);

    // Fullscreen change listener
    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = !!document.fullscreenElement;
      this.applyFullscreenUiState(isFullscreen);
      this.applyFullscreenOrientation(isFullscreen);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.updateCanvasSize();
        });
      });
      this.dispatchEvent(new CustomEvent("fullscreenchange", { detail: { fullscreen: isFullscreen } }));
    });

    // Show/hide controls - use a flag to track if mouse is over controls
    const controlsContainer = shadowRoot.querySelector(
      ".movi-controls-container",
    ) as HTMLElement;

    // Keep controls visible when hovering over controls area
    controlsContainer?.addEventListener("mouseenter", () => {
      this.isOverControls = true;
      this.showControls();
    });

    controlsContainer?.addEventListener(
      "touchstart",
      () => {
        this.lastTouchTime = Date.now();
        this.isOverControls = true;
        this.showControls();
      },
      { passive: true },
    );

    controlsContainer?.addEventListener(
      "touchend",
      () => {
        setTimeout(() => {
          this.isOverControls = false;
          // Re-arm the auto-hide timer after a touch interaction with the
          // bar or a popup menu. Always call showControls() — it re-checks
          // its own gating (isOverControls / menu open / dragging) and sets
          // the timer when nothing's holding the bar open. The old `if
          // playing` guard meant a touch while PAUSED cleared isOverControls
          // but never re-armed the timer, so the controls stayed up forever
          // on touch devices. showControls auto-hides on pause too (YouTube
          // parity), so this is safe.
          this.showControls();
        }, 1000);
      },
      { passive: true },
    );

    controlsContainer?.addEventListener("mouseleave", (e) => {
      // Check if mouse is moving to another part of controls
      const relatedTarget = e.relatedTarget as Element;
      if (relatedTarget && controlsContainer?.contains(relatedTarget)) {
        return; // Still over controls
      }

      // Ignore mouseleave if it's a touch interaction (within 1000ms of last touch)
      if (Date.now() - this.lastTouchTime < 1000) {
        return;
      }

      this.isOverControls = false;
      // Only hide if not dragging AND no menu is open. Without the menu
      // check, switching from a tall customize panel to a shorter track
      // list (via the panel's "Back" button) collapses the menu height
      // — the mouse pointer that was on the Back button now sits above
      // the new shorter list, fires mouseleave on the controls container,
      // and the auto-hide animates the entire controls bar (including the
      // open menu) to opacity 0.
      if (!this.isDragging && !this.isAnyMenuOpen()) {
        this.hideControls();
      }
    });

    // Overlay's mouseenter/mouseleave used to drive showControls /
    // hideControls, but the host-level enter/move/leave (added in
    // setupKeyboardShortcuts) covers the same surface AND every child
    // that absorbs events. Worse, on overlay it was a re-show vector:
    // when stateChange→playing strips the center play/pause button's
    // pointer-events, the browser fires a synthetic mouseenter on the
    // overlay (cursor's "real" target shifts) which immediately
    // re-showed the controls a frame after the just-fired hide. Drop
    // the overlay handlers; host handles it.

    // Mousemove → showControls is handled at the host level (see the
    // listener added in setupKeyboardShortcuts), so it covers EVERY
    // child — canvas, video, overlay, controls bar, empty-state,
    // broken-indicator, loading spinner, nerd-stats, and any open
    // menu. The previous per-child listeners only fired when the
    // cursor was directly over canvas/video/overlay/controlsContainer,
    // missing siblings that sit above them.
  }

  private async seekFromEvent(e: MouseEvent): Promise<void> {
    const progressBar = this.shadowRoot?.querySelector(
      ".movi-progress-bar",
    ) as HTMLElement;
    if (
      !progressBar ||
      !this.player ||
      this.isSeeking ||
      this.isLoading ||
      this._isUnsupported
    )
      return;

    const state = this.player.getState();
    // Allow seeking in playable states + buffering/seeking
    if (
      state !== "ready" &&
      state !== "playing" &&
      state !== "paused" &&
      state !== "ended" &&
      state !== "buffering" &&
      state !== "seeking"
    ) {
      return;
    }

    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const duration = this.duration;
    if (duration <= 0) return;

    // Live: map the fraction into the DVR window. Otherwise (linear mode)
    // clamp the seek target to the buffered RAM window.
    const time = this.player?.isLiveStream?.()
      ? this.barFractionToTime(percent)
      : this.clampToBufferedWindow(percent * duration);
    const wasPlaying = state === "playing";

    this.isSeeking = true;
    try {
      await this.player.seek(time);

      // If we were playing before seek, ensure playback resumes
      // The player should handle this, but add a safety check
      if (wasPlaying && this.player.getState() !== "playing") {
        // Small delay to let seek complete, then resume if needed
        setTimeout(() => {
          if (this.player) {
            const currentState = this.player.getState();
            if (currentState === "ready" || currentState === "paused") {
              this.player.play().catch((err) => {
                Logger.error(TAG, "Failed to resume playback after seek", err);
              });
            }
          }
        }, 100);
      }
    } catch (error) {
      Logger.error(TAG, "Seek error", error);
      // Don't show alert for seek errors - they're usually recoverable
    } finally {
      this.isSeeking = false;
    }
  }

  private async seekFromTouchEvent(e: TouchEvent): Promise<void> {
    const progressBar = this.shadowRoot?.querySelector(
      ".movi-progress-bar",
    ) as HTMLElement;
    if (
      !progressBar ||
      !this.player ||
      this.isSeeking ||
      this.isLoading ||
      this._isUnsupported
    )
      return;

    // Get touch position
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;

    const state = this.player.getState();
    // Allow seeking in playable states + buffering/seeking
    if (
      state !== "ready" &&
      state !== "playing" &&
      state !== "paused" &&
      state !== "ended" &&
      state !== "buffering" &&
      state !== "seeking"
    ) {
      return;
    }

    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (touch.clientX - rect.left) / rect.width),
    );
    const duration = this.duration;
    if (duration <= 0) return;

    // Live: map the fraction into the DVR window. Otherwise (linear mode)
    // clamp the seek target to the buffered RAM window.
    const time = this.player?.isLiveStream?.()
      ? this.barFractionToTime(percent)
      : this.clampToBufferedWindow(percent * duration);
    const wasPlaying = state === "playing";

    this.isSeeking = true;
    try {
      await this.player.seek(time);

      // If we were playing before seek, ensure playback resumes
      if (wasPlaying && this.player.getState() !== "playing") {
        setTimeout(() => {
          if (this.player) {
            const currentState = this.player.getState();
            if (currentState === "ready" || currentState === "paused") {
              this.player.play().catch((err) => {
                Logger.error(TAG, "Failed to resume playback after seek", err);
              });
            }
          }
        }, 100);
      }
    } catch (error) {
      Logger.error(TAG, "Touch seek error", error);
    } finally {
      this.isSeeking = false;
    }
  }

  /** Begin press-and-hold fast playback (2x). No-op unless actively playing, so
   * a long-press while paused doesn't silently change the saved rate. */
  private startHoldSpeed(): void {
    this._holdSpeedTimer = null;
    if (this._holdSpeedActive || !this.player) return;
    if (this.player.getState() !== "playing") return;
    this._holdSpeedActive = true;
    this.gesturePerformed = true; // suppress the touchend tap (show/hide chrome)
    this._rateBeforeHold = this._playbackRate || 1;
    this.player.setPlaybackRate(2);
    this._playbackRate = 2;
    this.updateMediaSessionPosition();
    this.resetStutterHint();
    const pill = this.shadowRoot?.querySelector(
      ".movi-hold-speed",
    ) as HTMLElement | null;
    if (pill) pill.style.display = "flex";
  }

  /** End press-and-hold fast playback, restoring the pre-hold rate. */
  private stopHoldSpeed(): void {
    if (this._holdSpeedTimer !== null) {
      clearTimeout(this._holdSpeedTimer);
      this._holdSpeedTimer = null;
    }
    if (!this._holdSpeedActive) return;
    this._holdSpeedActive = false;
    this.player?.setPlaybackRate(this._rateBeforeHold);
    this._playbackRate = this._rateBeforeHold;
    this.updateMediaSessionPosition();
    const pill = this.shadowRoot?.querySelector(
      ".movi-hold-speed",
    ) as HTMLElement | null;
    if (pill) pill.style.display = "none";
  }

  private setupGestures(shadowRoot: ShadowRoot): void {
    const overlay = shadowRoot.querySelector(
      ".movi-controls-overlay",
    ) as HTMLElement;
    const canvas = this.canvas;
    const video = this.video;

    // Use the most appropriate target for gestures
    // Overlay is best if visible, but canvas/video are better fallbacks
    // We EXCLUDE 'this' (the host) here to prevent gestures from capturing
    // interactions on the control bar at the bottom.
    const gestureTargets = [overlay, canvas, video].filter(
      (t) => t !== null,
    ) as HTMLElement[];

    // Single tap for play/pause, double tap for fullscreen/seek (touch)
    let lastTap = 0;
    let tapTimer: number | null = null;

    const handleTap = (e: TouchEvent) => {
      const target = e.target as Element;
      // Don't trigger if tapping on controls
      if (
        target.closest(".movi-controls-bar") ||
        target.closest(".movi-center-play-pause") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest(".movi-btn")
      ) {
        return;
      }

      // If double tap is disabled, handle as single tap immediately (simple
      // toggle). In linear mode the skip seek clamps to the buffered window.
      if (!this._doubleTap) {
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = null;

        // Tap on video area while a menu is open closes the menu first.
        if (this.isAnyMenuOpen()) {
          this.closeAllBottomMenus();
          return;
        }

        // Native mobile behaviour: a tap on the video area only
        // toggles the chrome on / off — play/pause stays a deliberate
        // act through the centre play button or the bottom bar's
        // play/pause icon. (Previously a visible-controls tap also
        // ran play/pause, which surprised users coming from the
        // system video player.)
        const controlsContainer = this.controlsContainer;
        const controlsHidden = controlsContainer?.classList.contains(
          "movi-controls-hidden",
        );

        if (controlsHidden) {
          this.showControls();
        } else {
          this.hideControls();
        }
        return;
      }

      const now = Date.now();
      const tapLength = now - lastTap;

      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const rect = this.getBoundingClientRect();
      const xPos = touch.clientX - rect.left;
      const width = rect.width;

      if (tapLength < 400 && tapLength > 0) {
        // Double tap detected
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = null;

        let didSeek = false;

        // Check if fast seek is enabled
        if (this._fastSeek) {
          if (xPos < width * 0.3) {
            this.performRelativeSeek("left");
            didSeek = true;
          } else if (xPos > width * 0.7) {
            this.performRelativeSeek("right");
            didSeek = true;
          } else {
            this.toggleFullscreen();
          }
        } else {
          // If seek disabled, always treat double tap as fullscreen toggle
          this.toggleFullscreen();
        }
        // Keep lastTap alive for continuous tapping (like YouTube)
        // If we seeked, next tap should immediately seek again
        lastTap = didSeek ? now : 0;
      } else {
        // First tap
        lastTap = now;

        tapTimer = window.setTimeout(() => {
          // Single tap action: chrome show / hide only — see the
          // doubleTap-disabled branch above for the rationale. The
          // play/pause toggle moved off the player surface to keep
          // tap behaviour consistent with native mobile players.
          if (this.isAnyMenuOpen()) {
            this.closeAllBottomMenus();
            lastTap = 0;
            return;
          }

          const controlsContainer = this.controlsContainer;
          const controlsHidden = controlsContainer?.classList.contains(
            "movi-controls-hidden",
          );

          if (controlsHidden) {
            this.showControls();
          } else {
            this.hideControls();
          }
          lastTap = 0;
        }, 300);
      }
    };

    let initialVolume = this._volume;
    let initialSeekTime = 0;
    let isVerticalGesture = false;
    let isHorizontalGesture = false;
    let isEdgeStart = false;

    // Attach listeners to all possible interaction targets
    gestureTargets.forEach((target) => {
      // Touch events
      target.addEventListener(
        "touchstart",
        (e: TouchEvent) => {
          if (e.touches.length === 1) {
            this.gesturePerformed = false;
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            // Baseline for 360° incremental panning.
            this._vrLastX = e.touches[0].clientX;
            this._vrLastY = e.touches[0].clientY;

            // Check for edge start to prevent conflict with system gestures
            // Safe area: 40px from edges
            const edgeThreshold = 40;
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;
            isEdgeStart =
              this.touchStartX < edgeThreshold ||
              this.touchStartX > winWidth - edgeThreshold ||
              this.touchStartY < edgeThreshold ||
              this.touchStartY > winHeight - edgeThreshold;

            this.touchStartTime = Date.now();
            initialVolume = this._volume;
            initialSeekTime = this.currentTime;
            isVerticalGesture = false;
            isHorizontalGesture = false;

            // Arm press-and-hold-to-2x. A move (scrub/swipe/pan) or a release
            // before the threshold cancels it (touchmove/touchend below). VR
            // owns its own touch, so skip there.
            if (this._holdSpeedTimer !== null) {
              clearTimeout(this._holdSpeedTimer);
              this._holdSpeedTimer = null;
            }
            if (!this._vr360 && !isEdgeStart) {
              // 600ms, not 400 — a shorter threshold fired 2x on ordinary
              // taps/brief holds. This matches the ~500-600ms long-press feel
              // users expect on iOS/Android.
              this._holdSpeedTimer = window.setTimeout(
                () => this.startHoldSpeed(),
                600,
              );
            }
          } else if (e.touches.length >= 2) {
            // A second finger down means a pinch (aspect-fit / 360° zoom), never
            // a press-and-hold-to-2x — cancel the arm the first finger set, and
            // drop out of 2x if it already engaged, so the two don't conflict.
            if (this._holdSpeedTimer !== null) {
              clearTimeout(this._holdSpeedTimer);
              this._holdSpeedTimer = null;
            }
            if (this._holdSpeedActive) this.stopHoldSpeed();
          }
        },
        { passive: true },
      );

      target.addEventListener(
        "touchmove",
        (e: TouchEvent) => {
          // Two-finger pinch in fullscreen → switch aspect fit, YouTube-style:
          // spread out zooms to fill (cover / crop to edges), pinch in returns
          // to fit (contain). Handled before the edge-swipe guard so a pinch
          // that happens to begin near a screen edge still registers, and gated
          // to fullscreen so it never fights the page's own pinch-zoom inline.
          // (360° mode has its own two-finger pinch below, so exclude it here.)
          if (
            !this._vr360 &&
            e.touches.length === 2 &&
            this.isFullscreenActive()
          ) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY,
            );
            if (this._aspectPinchDist === 0) {
              this._aspectPinchDist = dist;
            } else {
              const ratio = dist / this._aspectPinchDist;
              const current =
                this._objectFit === "control"
                  ? this._currentFit
                  : this._objectFit;
              let next: "contain" | "cover" | null = null;
              if (ratio > 1.2 && current !== "cover") next = "cover";
              else if (ratio < 0.83 && current !== "contain") next = "contain";
              if (next) {
                if (this._objectFit === "control") this._currentFit = next;
                else this._objectFit = next;
                this.updateFitMode();
                const labels: Record<string, string> = {
                  contain: "Fit",
                  cover: "Fill",
                };
                const osdSvg =
                  MoviElement.ASPECT_ICONS[next] ||
                  MoviElement.ASPECT_ICONS.contain;
                this.showOSD(
                  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${osdSvg}</svg>`,
                  labels[next],
                );
                // Re-baseline so the opposite pinch can toggle straight back.
                this._aspectPinchDist = dist;
              }
            }
            this.gesturePerformed = true;
            if (e.cancelable) e.preventDefault();
            return;
          }
          if (isEdgeStart) return;
          // 360° mode owns touch: one finger looks around, two fingers pinch
          // to zoom. Bypasses the volume/seek gestures entirely.
          if (this._vr360) {
            if (e.touches.length === 1) {
              const t = e.touches[0];
              const dx = t.clientX - this._vrLastX;
              const dy = t.clientY - this._vrLastY;
              this._vrLastX = t.clientX;
              this._vrLastY = t.clientY;
              this.player?.nudgeVR360(dx, dy, this.getBoundingClientRect().height);
              this._vrPinchDist = 0;
            } else if (e.touches.length === 2) {
              const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY,
              );
              if (this._vrPinchDist > 0) {
                // Spread fingers → zoom in (FOV down); pinch → zoom out.
                this.player?.zoomVR360((this._vrPinchDist - dist) * 2);
              }
              this._vrPinchDist = dist;
            }
            this.gesturePerformed = true;
            if (e.cancelable) e.preventDefault();
            return;
          }
          if (e.touches.length === 1) {
            const touch = e.touches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;

            // Any real finger travel means the press wasn't a stationary hold —
            // cancel the pending hold-to-2x so a page scroll / swipe / pan
            // doesn't trip it. Done here (before the gesturefs gate and the
            // gesture-type classification) so it fires regardless of side,
            // fullscreen, or gesture config — a scroll must always win.
            if (
              this._holdSpeedTimer !== null &&
              Math.hypot(deltaX, deltaY) > 10
            ) {
              clearTimeout(this._holdSpeedTimer);
              this._holdSpeedTimer = null;
            }

            // Determine gesture type early.
            // An inline player (`playsinline`) shares the page's scroll, so its
            // touch gestures (swipe-seek / volume) must not fight it — restrict
            // them to fullscreen. `gesturefs` is the deprecated alias for the
            // same behaviour, still honoured.
            if (
              (this._playsinline || this._gesturefs) &&
              !document.fullscreenElement
            ) {
              return;
            }

            if (
              !isVerticalGesture &&
              !isHorizontalGesture &&
              !this.gesturePerformed
            ) {
              if (Math.abs(deltaY) > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
                isVerticalGesture = true;
                this.gesturePerformed = true;
              } else if (Math.abs(deltaX) > 10) {
                isHorizontalGesture = true;
                this.gesturePerformed = true;
              }
              // A real move means this isn't a stationary press — cancel the
              // pending hold-to-2x so scrub/swipe/volume gestures win.
              if (this.gesturePerformed && this._holdSpeedTimer !== null) {
                clearTimeout(this._holdSpeedTimer);
                this._holdSpeedTimer = null;
              }
            }

            if (isVerticalGesture) {
              const rect = this.getBoundingClientRect();
              const startXPercent = (this.touchStartX - rect.left) / rect.width;

              // Right side vertical swipe = Volume
              if (startXPercent > 0.5) {
                if (e.cancelable) e.preventDefault();

                const volumeChange = -deltaY / 200;
                const newVolume = Math.max(
                  0,
                  Math.min(this.getMaxVolume(), initialVolume + volumeChange),
                );
                this.volume = newVolume;
              }
            } else if (isHorizontalGesture) {
              // Only enabled if fastseek is true
              if (!this._fastSeek) return;

              if (e.cancelable) e.preventDefault();

              const rect = this.getBoundingClientRect();
              // Sensitivity: Approx 90 seconds for full screen swipe
              const seekRatio = deltaX / rect.width;
              const seekAmount = seekRatio * 90;
              const newTime = Math.max(
                0,
                Math.min(this.duration, initialSeekTime + seekAmount),
              );

              // Show OSD with seek information
              const icon =
                deltaX >= 0
                  ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`
                  : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`;

              const timeStr = this.formatTime(newTime);
              const durationStr = this.formatTime(this.duration);
              this.showOSD(icon, `${timeStr} / ${durationStr}`);

              // Perform actual seek
              // The currentTime setter handles its own isSeeking lock
              this.currentTime = newTime;
            }
          }
        },
        { passive: false },
      );

      target.addEventListener(
        "touchend",
        (e: TouchEvent) => {
          // A lifted finger ends any pinch — clear the aspect-fit baseline so
          // the next two-finger gesture re-measures from scratch.
          this._aspectPinchDist = 0;
          // Release ends press-and-hold-to-2x (and cancels a pending arm). When
          // it was active this restores the pre-hold rate; gesturePerformed was
          // set on activation so the tap show/hide-chrome branch below is skipped.
          const wasHolding = this._holdSpeedActive;
          this.stopHoldSpeed();
          if (wasHolding) return;
          if (e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const endTime = Date.now();
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;
            const deltaTime = endTime - this.touchStartTime;

            const rect = this.getBoundingClientRect();
            const startXPercent = (this.touchStartX - rect.left) / rect.width;

            // Check for vertical swipe on LEFT side for Fullscreen toggle
            if (
              this.gesturePerformed &&
              isVerticalGesture &&
              startXPercent <= 0.5
            ) {
              if (deltaY < -60) {
                // Swipe UP -> Enter Fullscreen (skip for any audio source).
                // Route through toggleFullscreen so the iOS pseudo-fullscreen
                // fallback and the host-fullscreen event apply here too.
                if (
                  !this.isFullscreenActive() &&
                  !this.classList.contains("movi-audio-mode")
                ) {
                  this.toggleFullscreen();
                }
              } else if (deltaY > 60) {
                // Swipe DOWN -> Exit Fullscreen
                if (this.isFullscreenActive()) {
                  this.toggleFullscreen();
                }
              }
            }

            if (
              !this.gesturePerformed &&
              Math.abs(deltaX) < 20 &&
              Math.abs(deltaY) < 20 &&
              deltaTime < 300
            ) {
              handleTap(e);
              if (e.cancelable) e.preventDefault();
            } else if (this.gesturePerformed) {
              if (e.cancelable) e.preventDefault();
            }

            setTimeout(() => {
              this.gesturePerformed = false;
            }, 300);
          } else {
            this.gesturePerformed = true;
            if (e.cancelable) e.preventDefault();
            setTimeout(() => {
              this.gesturePerformed = false;
            }, 300);
          }
        },
        { passive: false },
      );
    });

    // Mouse double click for fullscreen / fast seek
    const handleDoubleClick = (e: MouseEvent) => {
      // Bare player (no controls attr): no double-click-to-fullscreen. The
      // host's pointer-events:none is defeated by the many explicit
      // pointer-events:auto layers, so guard the handler directly.
      if (!this._controls) return;
      // Cancel any pending single click
      if (this.clickTimer) {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
      }

      this.lastSeekTime = Date.now();

      // Don't trigger if clicking on controls
      const targetEl = e.target as Element;
      const controlsBar = shadowRoot.querySelector(
        ".movi-controls-bar",
      ) as HTMLElement;
      if (controlsBar && controlsBar.contains(targetEl)) {
        return;
      }

      // Mouse double click acts as fullscreen toggle only (no fast seek)
      this.toggleFullscreen();

      e.preventDefault();
      e.stopPropagation();
    };

    // Register double click on all layers
    gestureTargets.forEach((target) => {
      target.addEventListener("dblclick", handleDoubleClick);
    });

    // Mouse single click - handled by overlay click handler for play/pause
  }

  /**
   * 360° look-around for mouse + trackpad. Touch is handled inside
   * setupGestures (it already owns touchstart/move). These listeners no-op
   * unless 360° mode is active, and a drag past a few pixels suppresses the
   * trailing click so dragging never toggles play/pause.
   */
  private setupVRControls(shadowRoot: ShadowRoot): void {
    const overlay = shadowRoot.querySelector(
      ".movi-controls-overlay",
    ) as HTMLElement;
    const targets = [overlay, this.canvas].filter(Boolean) as HTMLElement[];

    targets.forEach((target) => {
      target.addEventListener("pointerdown", (e: PointerEvent) => {
        if (!this._vr360 || e.pointerType !== "mouse" || e.button !== 0) return;
        // Ignore drags that begin on the control bar / buttons.
        const t = e.target as Element;
        if (t.closest(".movi-controls-bar") || t.closest("button")) return;
        this._vrPointerDown = true;
        this._vrMoved = false;
        this._vrLastX = e.clientX;
        this._vrLastY = e.clientY;
        try {
          target.setPointerCapture?.(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      });

      target.addEventListener("pointermove", (e: PointerEvent) => {
        if (!this._vr360 || !this._vrPointerDown) return;
        const dx = e.clientX - this._vrLastX;
        const dy = e.clientY - this._vrLastY;
        this._vrLastX = e.clientX;
        this._vrLastY = e.clientY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._vrMoved = true;
        this.player?.nudgeVR360(dx, dy, this.getBoundingClientRect().height);
      });

      const endDrag = (e: PointerEvent) => {
        if (!this._vrPointerDown) return;
        this._vrPointerDown = false;
        if (this._vrMoved) this._vrSuppressClick = true;
        try {
          target.releasePointerCapture?.(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
      };
      target.addEventListener("pointerup", endDrag);
      target.addEventListener("pointercancel", endDrag);
    });

    // ── On-screen pan joystick (the YouTube-style compass, desktop only) ──
    const pad = shadowRoot.querySelector(".movi-vr360-pad") as HTMLElement | null;
    const knob = pad?.querySelector(".movi-vr360-pad-knob") as HTMLElement | null;
    if (pad && knob) {
      const RADIUS = 22; // max knob travel from centre (px)
      let padDragging = false;
      let offX = 0;
      let offY = 0;
      let raf: number | null = null;

      // Continuous pan while the knob is held off-centre; speed scales with the
      // deflection and (via nudgeVR360's fov/viewport math) with the zoom level.
      const tick = () => {
        if (!padDragging) {
          raf = null;
          return;
        }
        if (offX || offY) {
          const vp = this.getBoundingClientRect().height;
          // Negate so pushing the knob toward a direction looks that way
          // (camera-follows-knob, opposite of the grab-world video drag).
          this.player?.nudgeVR360(-offX * 0.6, -offY * 0.6, vp);
        }
        raf = requestAnimationFrame(tick);
      };

      const moveKnob = (e: PointerEvent) => {
        const r = pad.getBoundingClientRect();
        let dx = e.clientX - (r.left + r.width / 2);
        let dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy);
        if (dist > RADIUS) {
          dx = (dx / dist) * RADIUS;
          dy = (dy / dist) * RADIUS;
        }
        offX = dx;
        offY = dy;
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };

      pad.addEventListener("pointerdown", (e: PointerEvent) => {
        if (!this._vr360) return;
        e.preventDefault();
        e.stopPropagation();
        padDragging = true;
        // Keep the chrome (and therefore the joystick itself) on screen while
        // panning — the pad captures the pointer, so the host never sees the
        // mouse move that would otherwise reset the auto-hide timer.
        this._vrPadDragging = true;
        this.showControls();
        pad.classList.add("movi-vr360-pad-dragging");
        try {
          pad.setPointerCapture?.(e.pointerId);
        } catch {
          /* best-effort */
        }
        moveKnob(e);
        if (raf === null) raf = requestAnimationFrame(tick);
      });
      pad.addEventListener("pointermove", (e: PointerEvent) => {
        if (padDragging) moveKnob(e);
      });
      const padEnd = (e: PointerEvent) => {
        if (!padDragging) return;
        padDragging = false;
        offX = 0;
        offY = 0;
        // Spring the knob back to centre (transition re-enabled by class removal).
        pad.classList.remove("movi-vr360-pad-dragging");
        knob.style.transform = "";
        // Restart the auto-hide countdown now that the drag is over.
        this._vrPadDragging = false;
        this.showControls();
        try {
          pad.releasePointerCapture?.(e.pointerId);
        } catch {
          /* best-effort */
        }
      };
      pad.addEventListener("pointerup", padEnd);
      pad.addEventListener("pointercancel", padEnd);
    }
  }

  /**
   * Enable/disable VR rendering and pick the format:
   *  - half: VR180 (front hemisphere) vs full 360°.
   *  - fisheye: equidistant fisheye vs equirectangular.
   *  - sbs: side-by-side stereo (render the left eye) vs mono.
   * Forwards to the player's renderer and flips the host class (for cursor +
   * touch-action CSS). There's no toggle button: VR turns on automatically for
   * sources we know are 360/180 (spherical metadata or the `vr` attribute), the
   * same way YouTube treats them.
   */
  setVR360(
    enabled: boolean,
    half: boolean = false,
    fisheye: boolean = false,
    sbs: boolean = false,
    stereographic: boolean = false,
  ): void {
    this._vr360 = enabled;
    this.player?.setVR360(enabled);
    if (enabled) {
      this.player?.setVRProjection(half, fisheye, sbs, stereographic);
    }
    this.classList.toggle("movi-vr360-active", enabled);
    if (enabled) {
      // A custom/generated poster is a flat <img> overlay that the player never
      // decodes — project it onto the 360 canvas and hide the flat overlay.
      void this.renderVRPosterIfNeeded();
    } else if (this.posterElement) {
      // Leaving 360: un-hide the flat poster overlay we may have suppressed.
      this.posterElement.style.visibility = "";
      this.updatePoster();
    }
  }

  /**
   * When a custom/generated poster image is showing and 360° is on, draw the
   * poster onto the canvas through the equirectangular projection (so it looks
   * right, not flat-distorted) and hide the flat <img> overlay. No-op for the
   * decoded-frame poster path (seek/postertime) — that already paints in 360.
   */
  private async renderVRPosterIfNeeded(): Promise<void> {
    if (!this._vr360 || !this.player) return;
    if (!this._poster && !this._generatedPosterUrl) return;
    if (this.player.getState?.() === "playing") return;
    const img = this.posterElement;
    if (!img || !img.getAttribute("src")) return;

    const draw = async () => {
      try {
        // Match the backbuffer to the display box so the 360 aspect is correct.
        this.updateCanvasSize();
        const bmp = await createImageBitmap(img);
        this.player?.renderPosterImage(bmp);
        try {
          bmp.close();
        } catch {
          /* ignore */
        }
        // Hide the flat overlay so only the 360-projected canvas shows.
        img.style.visibility = "hidden";
      } catch (e) {
        Logger.warn(TAG, "VR poster render failed", e);
      }
    };

    if (img.complete && img.naturalWidth > 0) {
      await draw();
    } else {
      img.addEventListener("load", () => void draw(), { once: true });
    }
  }

  /**
   * Resolve the VR format for the CURRENT source from spherical metadata
   * (track.projection) + the live `vr` attribute. Never carries the previous
   * clip's state over — switching to a normal clip drops back to flat unless
   * `vr` is still set.
   *
   * `vr` attribute tokens (space/comma separated), e.g. `vr="fisheye sbs"`:
   *   (bare) / 360 → full 360°; 180 → VR180; sbs / 3d → side-by-side stereo
   *   (left eye); fisheye → equidistant fisheye (implies 180).
   *
   * projection metadata: 0/undefined = none; 1 = equirectangular;
   * 3 = equirectangular-tile; 4 = half-equirectangular (VR180). Stereo/fisheye
   * aren't auto-surfaced, so those need the attribute.
   */
  private resolveVRMode(): {
    enable: boolean;
    half: boolean;
    fisheye: boolean;
    sbs: boolean;
    stereographic: boolean;
  } {
    const track = (this.player as any)?.trackManager?.getActiveVideoTrack?.();
    const projection = track?.projection ?? 0;
    const metaEquirect = projection === 1 || projection === 3; // 360
    const metaHalf = projection === 4; // VR180

    const attr = this.getAttribute("vr");
    const forced = attr !== null;
    const tokens = (attr ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);
    const has = (t: string) => tokens.includes(t);

    // Stereographic "little planet" is a standalone full-360 layout — it
    // overrides the other flags.
    const stereographic =
      forced &&
      (has("littleplanet") ||
        has("planet") ||
        has("tinyplanet") ||
        has("stereographic"));
    if (stereographic) {
      return {
        enable: true,
        half: false,
        fisheye: false,
        sbs: false,
        stereographic: true,
      };
    }

    const fisheye = forced && has("fisheye");
    const sbs = forced && (has("sbs") || has("3d"));
    let half: boolean;
    if (forced) {
      // Bare `vr` (no tokens) → 360. `360` token forces full; otherwise any of
      // 180 / sbs / 3d / fisheye implies the front-hemisphere layout.
      half = has("360")
        ? false
        : has("180") || has("sbs") || has("3d") || has("fisheye");
    } else {
      half = metaHalf;
    }
    const enable = forced || metaEquirect || metaHalf;
    return { enable, half, fisheye, sbs, stereographic: false };
  }

  /** Apply the resolved VR format to the renderer (enable OR disable). */
  private detectAndApplyVR360(): void {
    const m = this.resolveVRMode();
    this.setVR360(m.enable, m.half, m.fisheye, m.sbs, m.stereographic);
    if (m.enable) void this.renderVRPosterIfNeeded();
  }

  private setupKeyboardShortcuts(): void {
    // Keyboard shortcuts require the host to hold focus. handleVideoClick grabs
    // it on a canvas/video click, but in audio-strip mode the whole surface is
    // the control bar, so that click never fires and the hotkeys look dead.
    // Take focus on any pointerdown on the player (except real form fields) so
    // shortcuts work regardless of what part of the chrome was clicked.
    this.addEventListener(
      "pointerdown",
      (e) => {
        const t = e.composedPath()[0] as HTMLElement | undefined;
        if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (document.activeElement !== this) this.focus({ preventScroll: true });
      },
      true,
    );

    this.addEventListener("keydown", (e) => {
      // Check if keyboard controls are disabled
      if (this._noHotkeys) return;

      // Only handle if player exists (content loaded)
      if (!this.player) return;

      // Don't fire shortcuts when the user is typing into a text field
      // — the event's target gets retargeted to the host element when it
      // bubbles out of shadow DOM, so check composedPath() to see the
      // real focus target. Without this, typing "p" in the transcript
      // search would pause playback, "f" would fullscreen, etc.
      const path = e.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        const tag = node.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable) {
          return;
        }
      }

      // Resume dialog keyboard navigation
      const resumeDialog = this.shadowRoot?.querySelector(".movi-resume-dialog") as HTMLElement;
      if (resumeDialog && resumeDialog.style.display !== "none") {
        const yesBtn = resumeDialog.querySelector(".movi-resume-yes") as HTMLElement;
        const noBtn = resumeDialog.querySelector(".movi-resume-no") as HTMLElement;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          // Toggle focus between Resume and Cancel
          // Toggle visual selection
          const yesSelected = yesBtn?.classList.contains("movi-resume-focused");
          yesBtn?.classList.toggle("movi-resume-focused", !yesSelected);
          noBtn?.classList.toggle("movi-resume-focused", yesSelected);
          return;
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const focused = resumeDialog.querySelector(".movi-resume-focused") as HTMLElement;
          (focused || yesBtn)?.click();
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          noBtn?.click();
          return;
        }
      }

      // Timeline navigation — intercept when timeline is open
      const timelinePanel = this.shadowRoot?.querySelector(".movi-timeline-panel") as HTMLElement;
      if (timelinePanel && timelinePanel.style.display !== "none") {
        if (e.key === "Escape") {
          e.preventDefault();
          this.toggleTimeline();
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Enter") {
          e.preventDefault();
          const items = timelinePanel.querySelectorAll(".movi-timeline-item");
          if (items.length === 0) return;

          // Find currently selected item
          let selectedIdx = -1;
          items.forEach((item, i) => {
            if ((item as HTMLElement).classList.contains("movi-timeline-selected")) {
              selectedIdx = i;
            }
          });

          if (e.key === "ArrowRight") {
            selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
          } else if (e.key === "ArrowLeft") {
            selectedIdx = Math.max(selectedIdx - 1, 0);
          } else if (e.key === "Enter" && selectedIdx >= 0) {
            // Seek to selected item
            (items[selectedIdx] as HTMLElement).click();
            return;
          }

          // Update selection
          items.forEach((item) => (item as HTMLElement).classList.remove("movi-timeline-selected"));
          if (selectedIdx >= 0) {
            const selected = items[selectedIdx] as HTMLElement;
            selected.classList.add("movi-timeline-selected");
            selected.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          }
          return;
        }
      }

      // Video-only shortcuts are meaningless for an audio-only source and
      // their on-screen controls are already hidden in audio mode (see the
      // .movi-audio-mode context-menu gate above). Mirror that exact set
      // here so the keys don't fire actions with no visible surface — e.g.
      // T opening an empty timeline panel over the cover art / strip, which
      // is the symptom that surfaced this gap.
      if (this.classList.contains("movi-audio-mode")) {
        // a:fit  p:pip  r:rotate  g:ambient  s:snapshot  t:timeline
        // v:subtitle-track. f (fullscreen) and h (hdr) are intentionally
        // omitted — they already self-guard: toggleFullscreen() is the
        // single audio-mode chokepoint, and the h case no-ops because the
        // hdr-toggle item is display:none for non-HDR (audio) content.
        const VIDEO_ONLY_KEYS = "aprgstv";
        if (e.key.length === 1 && VIDEO_ONLY_KEYS.includes(e.key.toLowerCase())) {
          return;
        }
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K": {
          // Space or K: Play/Pause. Don't surface the bar on this
          // keyboard toggle — matches mouse click + the stateChange
          // paused handler, which both stopped re-popping chrome on
          // every play/pause. The centre play icon flashes as the
          // confirmation; users that want the bar can hover / tap.
          e.preventDefault();
          const state = this.player?.getState();
          if (state === "playing" || state === "buffering") {
            this.pause();
          } else {
            this.play();
          }
          break;
        }
        case "ArrowLeft":
          // Left Arrow: Seek backward 10 seconds or single frame (if Ctrl)
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Frame backward - only work if paused (auto-pause if playing)
            if (this.player?.getState() === "playing") {
              this.pause();
            }
            const vTrack = this.player?.getVideoTracks()?.[0];
            const fps = vTrack?.frameRate || 24;
            const frameTime = 1 / fps;
            this.currentTime = Math.max(0, this.currentTime - frameTime);
            this.showOSD(
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`,
              `-1 Frame`,
            );
          } else {
            this.performRelativeSeek("left");
          }
          break;
        case "ArrowRight":
          // Right Arrow: Seek forward 10 seconds or single frame (if Ctrl).
          e.preventDefault();
          {
            if (e.ctrlKey || e.metaKey) {
              // Frame forward - only work if paused (auto-pause if playing)
              if (this.player?.getState() === "playing") {
                this.pause();
              }
              const vTrack = this.player?.getVideoTracks()?.[0];
              const fps = vTrack?.frameRate || 24;
              const frameTime = 1 / fps;
              this.currentTime = Math.min(
                this.duration,
                this.currentTime + frameTime,
              );
              this.showOSD(
                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`,
                `+1 Frame`,
              );
            } else {
              this.performRelativeSeek("right");
            }
          }
          break;
        case "ArrowUp":
          // Up Arrow: Increase volume
          e.preventDefault();
          if (this.player && this.player.hasAudibleSource()) {
            this.volume = Math.min(this.getMaxVolume(), this.volume + 0.1);
          }
          break;
        case "ArrowDown":
          // Down Arrow: Decrease volume
          e.preventDefault();
          if (this.player && this.player.hasAudibleSource()) {
            this.volume = Math.max(0, this.volume - 0.1);
          }
          break;
        case "m":
        case "M":
          // M: Mute/Unmute
          e.preventDefault();
          this.muted = !this.muted;
          this.showOSD(
            this.muted
              ? OSD.muted
              : OSD.unmuted,
            this.muted ? "Muted" : "Unmuted",
          );
          break;
        case "s":
        case "S":
          // S: Snapshot
          e.preventDefault();
          this.takeSnapshot();
          this.showOSD(
            OSD.snapshot,
            "Snapshot",
          );
          break;
        case "f":
        case "F":
          // F: Fullscreen
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case "p":
        case "P":
          // P: Picture-in-Picture
          e.preventDefault();
          this.togglePiP();
          break;
        case "i":
        case "I":
          // I: Toggle nerd stats
          e.preventDefault();
          this.toggleNerdStats();
          break;
        case "t":
        case "T":
          // T: Toggle timeline
          e.preventDefault();
          this.toggleTimeline();
          break;
        case "r":
        case "R":
          // R: Rotate video 90° (disabled during PiP)
          e.preventDefault();
          if (this.player && !this._pipWindow) {
            const deg = this.player.rotateVideo();
            this.showOSD(
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
              `${deg}°`,
            );
            const statusEl = this.contextMenuRoot().querySelector(".movi-rotate-status");
            if (statusEl) statusEl.textContent = `${deg}°`;
            this.syncThumbnailRotation(deg);
          }
          break;
        case "a":
        case "A":
          // A: Cycle aspect ratio (contain → cover → fill)
          e.preventDefault();
          {
            const fits = ["contain", "cover", "fill", "zoom"] as const;
            const current = this._objectFit === "control" ? this._currentFit : this._objectFit;
            const idx = fits.indexOf(current as any);
            const next = fits[(idx + 1) % fits.length];
            if (this._objectFit === "control") {
              this._currentFit = next;
            } else {
              this._objectFit = next;
            }
            this.updateFitMode();
            this.updateAspectRatioIcon();
            const labels: Record<string, string> = { contain: "Fit", cover: "Fill", fill: "Stretch", zoom: "Zoom" };
            const osdSvg = MoviElement.ASPECT_ICONS[next] || MoviElement.ASPECT_ICONS.contain;
            this.showOSD(
              `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${osdSvg}</svg>`,
              labels[next],
            );
          }
          break;
        case "l":
        case "L":
          // L: Toggle loop
          e.preventDefault();
          this.loop = !this.loop;
          this.showOSD(
            OSD.loop,
            this.loop ? "Loop On" : "Loop Off",
          );
          break;
        case "v":
        case "V":
          // V: Cycle subtitle track (VLC standard) — external then muxed
          e.preventDefault();
          if (this.player) {
            const extSubs = this.player.getSubtitleLangs();
            const muxedSubs = this.player.getSubtitleTracks();
            const subOsdOn = OSD.subOn;
            const subOsdOff = OSD.subOff;

            if (extSubs.length > 0) {
              // Cycle through external subtitle tracks: off → lang1 → lang2 → ... → off
              const activeIdx = extSubs.findIndex((t) => t.active);
              if (activeIdx === -1) {
                // Currently off → select first
                this.player.selectExternalSubtitle(extSubs[0].id);
                this.showOSD(subOsdOn, `${extSubs[0].label} [${extSubs[0].lang.toUpperCase()}] (1/${extSubs.length})`);
              } else if (activeIdx + 1 < extSubs.length) {
                // Next track
                const next = extSubs[activeIdx + 1];
                this.player.selectExternalSubtitle(next.id);
                this.showOSD(subOsdOn, `${next.label} [${next.lang.toUpperCase()}] (${activeIdx + 2}/${extSubs.length})`);
              } else {
                // Last → off
                this.player.selectExternalSubtitle(null);
                this.showOSD(subOsdOff, "Subtitles Off");
              }
              this.updateSubtitleTrackMenu();
            } else if (muxedSubs.length > 0) {
              // Fallback: muxed subtitle tracks
              const active = this.player.trackManager.getActiveSubtitleTrack();
              const activeIdx = active ? muxedSubs.findIndex(t => t.id === active.id) : -1;
              const nextIdx = activeIdx + 1;
              if (nextIdx >= muxedSubs.length) {
                this.player.selectSubtitleTrack(null);
                this.showOSD(subOsdOff, "Subtitles Off");
              } else {
                const next = muxedSubs[nextIdx];
                this.player.selectSubtitleTrack(next.id);
                const muxSubLang = next.language?.toUpperCase() || "";
                const muxSubLabel = next.label || muxSubLang || "Sub";
                const muxSubOsd = muxSubLang && muxSubLabel !== muxSubLang ? `${muxSubLabel} [${muxSubLang}]` : muxSubLabel;
                this.showOSD(subOsdOn, `${muxSubOsd} (${nextIdx + 1}/${muxedSubs.length})`);
              }
              this.updateSubtitleTrackMenu();
            }
          }
          break;
        case "z":
        case "Z":
        case "x":
        case "X": {
          // Z / X: Subtitle delay — shift subs earlier (Z) or later (X) by
          // 100ms per press. mpv convention: positive value = subs later.
          // File-source only — streamed sources don't expose the timing
          // controls this nudge depends on. Also require an active subtitle
          // track: nudging a delay value that applies to nothing on screen
          // would just surface a misleading OSD readout.
          e.preventDefault();
          if (!this.player || !this.player.isFileSource()) break;
          const hasActiveMuxed = !!this.player.trackManager.getActiveSubtitleTrack();
          const hasActiveExt = this.player.getSubtitleLangs().some((t) => t.active);
          if (!hasActiveMuxed && !hasActiveExt) break;
          const step = 0.1;
          const direction = e.key === "z" || e.key === "Z" ? -1 : 1;
          // Round to 3 decimals to keep the displayed value stable across
          // many presses despite floating-point accumulation.
          const next = Math.round((this._subtitleDelay + direction * step) * 1000) / 1000;
          this.subtitleDelay = next;
          const formatted =
            next === 0 ? "0s" : `${next > 0 ? "+" : ""}${next.toFixed(2)}s`;
          this.showOSD(OSD.subOn, `Subtitle Delay: ${formatted}`);
          break;
        }
        case "b":
        case "B":
          // B: Cycle audio track — muxed + external combined
          e.preventDefault();
          if (this.player) {
            const bMuxed = this.player.getAudioTracks();
            const bExternal = this.player.getAudioLangs();
            const bIcon = OSD.audio;

            // Build unified list: muxed first, then external
            type AudioEntry = { type: "muxed"; id: number; label: string; langCode: string } | { type: "ext"; lang: string; label: string; langCode: string };
            const allAudio: AudioEntry[] = [
              ...bMuxed.map((t) => ({ type: "muxed" as const, id: t.id, label: t.label || t.language || `Audio ${t.id}`, langCode: t.language?.toUpperCase() || "" })),
              ...bExternal.map((t) => ({ type: "ext" as const, lang: t.lang, label: t.label, langCode: t.lang.toUpperCase() })),
            ];

            if (allAudio.length > 1) {
              // Find current active index
              const isNative = this.player.isNativeAudioActive();
              let curIdx = -1;
              if (isNative) {
                const activeLang = bExternal.find((t) => t.active)?.lang;
                curIdx = allAudio.findIndex((a) => a.type === "ext" && a.lang === activeLang);
              } else {
                const activeId = this.player.trackManager.getActiveAudioTrack()?.id;
                curIdx = allAudio.findIndex((a) => a.type === "muxed" && a.id === activeId);
              }
              const nextIdx = (curIdx + 1) % allAudio.length;
              const next = allAudio[nextIdx];

              if (next.type === "ext") {
                this.player.selectAudioLang(next.lang);
              } else {
                if (this.player.isNativeAudioActive()) this.player.useMuxedAudio();
                this.player.selectAudioTrack(next.id);
              }
              const audioOsdLabel = next.langCode ? `${next.label} [${next.langCode}]` : next.label;
              this.showOSD(bIcon, `${audioOsdLabel} (${nextIdx + 1}/${allAudio.length})`);
              this.updateAudioTrackMenu();
            }
          }
          break;
        case "h":
        case "H":
          // H: Toggle HDR mode (only if content is HDR)
          e.preventDefault();
          {
            const hdrItem = this.shadowRoot?.querySelector('.movi-context-menu-item[data-action="hdr-toggle"]') as HTMLElement;
            if (hdrItem && hdrItem.style.display !== "none") {
              this.hdr = !this.hdr;
              this.showOSD(
                OSD.hdr,
                this.hdr ? "HDR On" : "HDR Off",
              );
            }
          }
          break;
        case "u":
        case "U":
          // U: Toggle stable volume
          e.preventDefault();
          if (this.player) {
            this.stableVolume = !this._stableVolume;
            this.showOSD(
              OSD.stableAudio,
              this._stableVolume ? "Stable Volume On" : "Stable Volume Off",
            );
          }
          break;
        case "g":
        case "G":
          // G: Toggle ambient mode
          e.preventDefault();
          this.ambientMode = !this._ambientMode;
          this.updateAmbientUI();
          this.showOSD(
            OSD.ambient,
            this._ambientMode ? "Ambient Mode On" : "Ambient Mode Off",
          );
          break;
        case "=":
        case "+":
          // +: Speed up (VLC standard)
          e.preventDefault();
          {
            const maxRate = this.getMaxAllowedRate();
            const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].filter(s => s <= maxRate);
            const curIdx = speeds.findIndex(s => s >= this._playbackRate);
            const nextIdx = Math.min((curIdx === -1 ? 3 : curIdx) + 1, speeds.length - 1);
            this.playbackRate = speeds[nextIdx];
            this.showOSD(
              OSD.speed,
              `Speed ${this._playbackRate}x`,
            );
          }
          break;
        case "-":
          // -: Speed down (VLC standard)
          e.preventDefault();
          {
            const maxRate = this.getMaxAllowedRate();
            const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].filter(s => s <= maxRate);
            const curIdx = speeds.findIndex(s => s >= this._playbackRate);
            const nextIdx = Math.max((curIdx === -1 ? 3 : curIdx) - 1, 0);
            this.playbackRate = speeds[nextIdx];
            this.showOSD(
              OSD.speed,
              `Speed ${this._playbackRate}x`,
            );
          }
          break;
        case "?":
          // ?: Show keyboard shortcuts
          e.preventDefault();
          {
            const panel = this.shadowRoot?.querySelector(".movi-shortcuts-panel") as HTMLElement;
            if (panel) panel.style.display = panel.style.display === "none" ? "flex" : "none";
          }
          break;
        case "0":
          // 0: Seek to start
          e.preventDefault();
          this.currentTime = 0;
          this.showControls();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          // 1-9: Seek to 10%–90% of the video (YouTube-style).
          e.preventDefault();
          const d = this.duration;
          if (Number.isFinite(d) && d > 0) {
            this.currentTime = d * (parseInt(e.key, 10) / 10);
            this.showControls();
          }
          break;
        }
        case "Home":
          // Home: Seek to start
          e.preventDefault();
          this.currentTime = 0;
          this.showControls();
          break;
        case "End":
          // End: Seek to end
          e.preventDefault();
          this.currentTime = this.duration;
          this.showControls();
          break;
      }
    });

    // NYUMATFLIX: skip tabindex on custom element (focus trap in embed shells)
    void 0;

    // Record every touch on the player so the synthetic mouse events the
    // browser fires right after a tap (mouseenter/mousemove/mousedown/...)
    // can be told apart from a real mouse hover. Without this, tapping a
    // surface like the Resume button — whose own handler never touches the
    // controls — still flashed the bar for a beat, because the synthetic
    // mouseenter/mousemove below ran showControls(). Touch devices drive the
    // chrome through handleTap (tap toggles the bar), so the hover path
    // should stay inert for touch.
    this.addEventListener(
      "touchstart",
      () => {
        this.lastTouchTime = Date.now();
      },
      { passive: true, capture: true },
    );

    // Surface controls the moment the cursor enters the player.
    this.addEventListener("mouseenter", () => {
      // Skip when this is a touch-induced synthetic mouse event (a real
      // hover never follows a recent touchstart).
      if (Date.now() - this.lastTouchTime < 800) return;
      // Surface the controls the moment the cursor enters the player,
      // regardless of which child element is under it. The canvas/video/
      // overlay mousemove handlers miss the case where the cursor is
      // over a sibling that absorbs events (empty-state, broken-indicator,
      // loading spinner, nerd-stats, an open menu), so the host-level
      // enter/move covers every internal element.
      if (this._controls) this.showControls();
    });

    this.addEventListener("mousemove", () => {
      if (Date.now() - this.lastTouchTime < 800) return;
      if (this._controls) this.showControls();
    });

    // Hide controls when the cursor leaves the player's bounding box from
    // ANY direction. The .movi-controls-overlay's own mouseleave isn't
    // sufficient because several siblings sit above the overlay with
    // pointer-events:auto and higher z-index — .movi-empty-state (z:5
    // when there's no video), .movi-broken-indicator (z:10000), the
    // loading spinner, nerd-stats, and any open menu. When the cursor is
    // over one of those and exits the player, the overlay never had the
    // cursor, so its mouseleave doesn't fire. mouseleave on the host
    // element doesn't care which child was under the cursor; it fires
    // whenever the cursor crosses the host's outer edge. The drag/menu/
    // touch guards mirror the controls-container handler so behavior
    // matches whether the cursor exits via the bottom or any other side.
    this.addEventListener("mouseleave", () => {
      if (
        this._controls &&
        !this.isDragging &&
        !this.isTouchDragging &&
        !this.isAnyMenuOpen() &&
        Date.now() - this.lastTouchTime >= 1000
      ) {
        this.hideControls();
      }
    });
  }

  private setupContextMenu(shadowRoot: ShadowRoot): void {
    const contextMenu = shadowRoot.querySelector(
      ".movi-context-menu",
    ) as HTMLElement;
    if (!contextMenu) {
      Logger.error(
        TAG,
        "[ContextMenu] Context menu element not found in shadow root!",
      );
      return;
    }
    Logger.debug(TAG, "[ContextMenu] Context menu element found");

    this._contextMenuVisible = false;

    // Prevent default context menu on all elements
    const preventDefaultContextMenu = (e: MouseEvent) => {
      // If we are currently scrubbing/dragging, just kill the menu event silently
      if (this.isDragging || this.isTouchDragging) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // No `controls` attribute → the player exposes no UI, so the custom
      // context menu (Play/Pause/Speed/…) shouldn't appear either. Suppress the
      // event (the browser default is already blocked by the canvas/video
      // oncontextmenu handlers) so right-click is a clean no-op.
      if (!this._controls) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      Logger.debug(TAG, "[ContextMenu] preventDefaultContextMenu called", {
        type: e.type,
        target: e.target,
        clientX: e.clientX,
        clientY: e.clientY,
      });

      // CRITICAL: Always prevent default FIRST, before any other logic
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // On touch, a long-press now drives hold-to-2x, so it must NOT open the
      // context menu — that opens from the gear button, which sets
      // _openMenuViaGear before dispatching this event. (Desktop right-click is
      // unaffected: pointer is fine, so this gate is skipped.)
      const isCoarse = window.matchMedia("(pointer: coarse)").matches;
      if (isCoarse && !this._openMenuViaGear) {
        return false;
      }
      this._openMenuViaGear = false;

      // Don't show on controls
      const target = e.target as Element;
      const shadowTarget = e.composedPath
        ? (e.composedPath()[0] as Element)
        : target;

      Logger.debug(TAG, "[ContextMenu] Checking target", {
        target: target?.tagName,
        shadowTarget: shadowTarget?.tagName,
        isInControls: shadowTarget?.closest(".movi-controls-container"),
        isInMenu: shadowTarget?.closest(".movi-context-menu"),
      });

      // Suppress only when the click hits an interactive control or the
      // menu itself. The original "any click inside controls-container
      // is blocked" rule worked for video mode (the bar is a thin strip
      // overlaying the video, so the dead-zone is small) — but in audio
      // strip mode the controls-container IS the entire player surface,
      // so blanket-blocking on it would mean right-click never works.
      // Refined gate: allow context menu unless the click is on a real
      // button, the progress bar, or the menu itself.
      const inStripMode = this.classList.contains("movi-audio-strip");
      const isOnInteractive =
        !!shadowTarget?.closest(
          ".movi-btn, .movi-progress-container, .movi-volume-slider, .movi-context-menu",
        );
      const blockMenu = inStripMode
        ? isOnInteractive
        : shadowTarget &&
          (shadowTarget.closest(".movi-controls-container") ||
            shadowTarget.closest(".movi-context-menu"));
      if (blockMenu) {
        Logger.debug(
          TAG,
          "[ContextMenu] Clicked on controls or menu, not showing menu",
        );
        return false;
      }

      Logger.debug(TAG, "[ContextMenu] Showing custom context menu");

      // Update context menu content before showing
      this.updateContextMenuContent(contextMenu, shadowRoot);
      // Re-enumerate output devices each open (cheap) so a just-plugged
      // headset shows up; the async result re-renders the submenu in place.
      this.refreshAudioOutputs();

      // Touch-only: narrow desktop windows still get the hover-based menu,
      // because slide-panel submenus require tap-to-open semantics.
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

      if (isTouchDevice) {
        contextMenu.classList.add("movi-context-menu-mobile");
        contextMenu.style.left = "";
        contextMenu.style.top = "";
        contextMenu.style.display = "flex";
        contextMenu.style.visibility = "visible";

        // Show backdrop
        const backdrop = shadowRoot.querySelector(
          ".movi-context-menu-backdrop",
        ) as HTMLElement;
        if (backdrop) backdrop.style.display = "block";

        // Ensure all submenus are hidden when opening main menu on mobile
        shadowRoot
          .querySelectorAll(
            ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
          )
          .forEach((sm) =>
            sm.classList.remove("movi-context-menu-submenu-visible"),
          );
      } else {
        contextMenu.classList.remove("movi-context-menu-mobile");
        const backdrop = shadowRoot.querySelector(
          ".movi-context-menu-backdrop",
        ) as HTMLElement;
        if (backdrop) backdrop.style.display = "none";

        // Audio-strip mode: the player is a 56px tall bar, so anchoring
        // the menu inside its bounds gives a 36px usable region which is
        // useless. Switch to position:fixed in viewport coordinates so
        // the menu can spill into the empty page area below the strip.
        const isStripMode = this.classList.contains("movi-audio-strip");
        // In fullscreen the player host IS the fullscreen element (the browser's
        // top layer), so the body-level portal renders OUTSIDE it and the menu
        // never appears. There are also no page clipping ancestors to escape here
        // (the host fills the screen). So keep the menu in the shadow root, lift
        // the host's paint clip so it isn't chopped at the host edge, and position
        // it with fixed viewport coordinates — the fullscreen host box == viewport.
        const inFullscreen = this.isFullscreenActive();
        if (isStripMode || inFullscreen) {
          if (inFullscreen) this.classList.add("movi-menu-overflow");
          contextMenu.style.position = "fixed";
          contextMenu.style.maxHeight = `${Math.max(180, window.innerHeight - 40)}px`;
          contextMenu.style.display = "block";
          contextMenu.style.visibility = "hidden";
          const menuWidth = contextMenu.offsetWidth;
          const menuHeight = contextMenu.offsetHeight;
          contextMenu.style.visibility = "visible";
          let fx = e.clientX;
          let fy = e.clientY;
          if (fx + menuWidth > window.innerWidth) fx = window.innerWidth - menuWidth - 10;
          if (fx < 10) fx = 10;
          if (fy + menuHeight > window.innerHeight) fy = window.innerHeight - menuHeight - 10;
          if (fy < 10) fy = 10;
          contextMenu.style.left = `${fx}px`;
          contextMenu.style.top = `${fy}px`;
          this.clampMenuToViewport(contextMenu);
          // skip the host-relative absolute-position path below
          requestAnimationFrame(() => contextMenu.classList.add("visible"));
          this._contextMenuVisible = true;
          return;
        }

        // Portal the menu to a body-level shadow root and switch to fixed
        // positioning so it escapes EVERY clipping ancestor of the player (a
        // page wrapper's overflow:hidden, body{overflow-x:hidden}, etc.) and
        // spills freely into the page like a native context menu. Lifting the
        // player's own clip isn't enough — the ancestors still chop it. Once
        // portaled + fixed, positions are plain viewport coordinates.
        this.portalContextMenu(contextMenu);
        contextMenu.style.position = "fixed";

        let x = e.clientX;
        let y = e.clientY;

        // Cap height to the VIEWPORT so a tall menu extends downward instead of
        // scrolling inside a tiny box.
        contextMenu.style.maxHeight = `${Math.max(180, window.innerHeight - 40)}px`;

        // Temporarily show menu to get its dimensions
        contextMenu.style.display = "block";
        contextMenu.style.visibility = "hidden";
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        contextMenu.style.visibility = "visible";

        // Flip to the left of / above the cursor near the viewport edge.
        if (x + menuWidth > window.innerWidth - 10) x -= menuWidth;
        if (y + menuHeight > window.innerHeight - 10) y -= menuHeight;

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        this.clampMenuToViewport(contextMenu);
      }

      // Delay adding visible class slightly to ensure transition works
      requestAnimationFrame(() => {
        contextMenu.classList.add("visible");
      });

      this._contextMenuVisible = true; // Refactored to use class property

      Logger.debug(TAG, "[ContextMenu] Menu positioned and shown", {
        left: contextMenu.style.left,
        top: contextMenu.style.top,
        display: contextMenu.style.display,
        visibility: contextMenu.style.visibility,
        computedDisplay: window.getComputedStyle(contextMenu).display,
        computedVisibility: window.getComputedStyle(contextMenu).visibility,
      });

      return false; // Return false to ensure preventDefault works
    };

    // Helper to hide context menu
    const hideContextMenu = () => {
      contextMenu.classList.remove("visible");
      // Restore the host's paint/overflow clip (lifted while the desktop menu
      // was open so it could spill outside the player).
      this.classList.remove("movi-menu-overflow");
      this._contextMenuVisible = false;

      // Set just-closed flag to prevent play/pause toggle
      this._contextMenuJustClosed = true;
      setTimeout(() => {
        this._contextMenuJustClosed = false;
      }, 100);

      // Hide backdrop
      const backdrop = shadowRoot.querySelector(
        ".movi-context-menu-backdrop",
      ) as HTMLElement;
      if (backdrop) backdrop.style.display = "none";

      // On touch devices, let slide-out transition finish before display none
      const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
      if (isTouchDevice) {
        setTimeout(() => {
          if (!this._contextMenuVisible) {
            contextMenu.style.display = "none";
            // Re-arm auto-hide once the menu is truly gone (display drives the
            // isAnyMenuOpen gate, which only clears now on touch).
            this.showControls();
          }
        }, 400);
      } else {
        contextMenu.style.display = "none";
        // Return the menu from the body portal to the shadow root and clear its
        // fixed positioning so the next open (incl. strip/touch modes) starts
        // clean and the submenu query below finds it back home.
        contextMenu.style.position = "";
        this.unportalContextMenu(contextMenu);
      }

      // Hide all submenus
      shadowRoot
        .querySelectorAll(
          ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
        )
        .forEach((sm) =>
          sm.classList.remove("movi-context-menu-submenu-visible"),
        );

      // Re-arm the auto-hide timer now the menu is gone. While it was open
      // showControls() refused to set the timer (the isAnyMenuOpen gate), so
      // without this nudge the bar would stay up until the next mouse move.
      // (Desktop: display is already "none" above; touch re-arms in its own
      // deferred block once the slide-out finishes.)
      if (!isTouchDevice) this.showControls();
    };

    // Touch: drag the mobile menu drawer to the right to dismiss it. The drawer
    // slides in from the right edge (translateX(100%) -> 0), so dragging it back
    // toward the right is the natural close gesture. Only the full-height drawer
    // participates (the audio-strip variant is an opacity-fade, not a slide),
    // and vertical/leftward moves are handed back to native scrolling / taps so
    // menu buttons and scrolling still work. The drawer's CSS transform/
    // transition carry `!important`, so inline overrides must use setProperty
    // with the "important" priority to win.
    const SWIPE_SLOP = 8; // px of travel before we lock an axis
    const SWIPE_CLOSE_RATIO = 0.35; // fraction of drawer width that dismisses
    let swStartX = 0;
    let swStartY = 0;
    let swDecided = false; // axis for this gesture chosen
    let swDragging = false; // horizontal drag-to-close has taken over
    const drawerActive = () =>
      contextMenu.classList.contains("movi-context-menu-mobile") &&
      contextMenu.classList.contains("visible") &&
      !this.classList.contains("movi-audio-strip");

    contextMenu.addEventListener(
      "touchstart",
      (e: TouchEvent) => {
        if (!drawerActive() || e.touches.length !== 1) return;
        swStartX = e.touches[0].clientX;
        swStartY = e.touches[0].clientY;
        swDecided = false;
        swDragging = false;
      },
      { passive: true },
    );

    contextMenu.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        if (!drawerActive() || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - swStartX;
        const dy = e.touches[0].clientY - swStartY;
        if (!swDecided) {
          if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return;
          swDecided = true;
          // Own the gesture only when it's a clear rightward horizontal swipe;
          // otherwise leave it to the menu's own vertical scroll.
          swDragging = Math.abs(dx) > Math.abs(dy) && dx > 0;
          if (swDragging)
            contextMenu.style.setProperty("transition", "none", "important");
        }
        if (!swDragging) return;
        e.preventDefault(); // we own this gesture now — no scroll/tap
        const offset = Math.max(0, dx); // rightward only
        contextMenu.style.setProperty(
          "transform",
          `translateX(${offset}px)`,
          "important",
        );
      },
      { passive: false },
    );

    const endSwipe = (e: TouchEvent) => {
      if (!swDragging) {
        swDecided = false;
        return;
      }
      swDragging = false;
      swDecided = false;
      const dx = (e.changedTouches[0]?.clientX ?? swStartX) - swStartX;
      const width = contextMenu.offsetWidth || 1;
      // Restore the CSS 0.4s slide and commit the dragged position as its
      // start, then hand the transform back to CSS so it animates to the
      // resting/closed state instead of jumping.
      contextMenu.style.removeProperty("transition");
      void contextMenu.offsetWidth; // reflow: lock in the current translateX
      if (dx > width * SWIPE_CLOSE_RATIO) {
        hideContextMenu(); // drops .visible -> CSS target translateX(100%)
      }
      contextMenu.style.removeProperty("transform");
    };
    contextMenu.addEventListener("touchend", endSwipe, { passive: true });
    contextMenu.addEventListener("touchcancel", endSwipe, { passive: true });

    // Add event listeners with capture phase and passive: false to allow preventDefault
    // Use capture phase to intercept before it reaches other handlers
    // Add to multiple elements to ensure we catch it everywhere
    const options = { capture: true, passive: false };

    Logger.debug(TAG, "[ContextMenu] Adding event listeners");
    this.addEventListener("contextmenu", preventDefaultContextMenu, options);
    Logger.debug(TAG, "[ContextMenu] Added listener to host element");

    this.canvas.addEventListener(
      "contextmenu",
      preventDefaultContextMenu,
      options,
    );
    Logger.debug(TAG, "[ContextMenu] Added listener to canvas");

    this.video.addEventListener(
      "contextmenu",
      preventDefaultContextMenu,
      options,
    );
    Logger.debug(TAG, "[ContextMenu] Added listener to video");

    const overlay = shadowRoot.querySelector(
      ".movi-controls-overlay",
    ) as HTMLElement;
    if (overlay) {
      overlay.addEventListener(
        "contextmenu",
        preventDefaultContextMenu,
        options,
      );
      Logger.debug(TAG, "[ContextMenu] Added listener to overlay");
    } else {
      Logger.warn(TAG, "[ContextMenu] Overlay element not found");
    }

    // Also prevent on subtitle overlay
    if (this.subtitleOverlay) {
      this.subtitleOverlay.addEventListener(
        "contextmenu",
        preventDefaultContextMenu,
        options,
      );
      Logger.debug(TAG, "[ContextMenu] Added listener to subtitle overlay");
    }

    // Also add to shadow root to catch events from all shadow DOM elements
    shadowRoot.addEventListener(
      "contextmenu",
      ((e: Event) => {
        Logger.debug(TAG, "[ContextMenu] Shadow root contextmenu event");
        const mouseEvent = e as MouseEvent;
        return preventDefaultContextMenu(mouseEvent);
      }) as EventListener,
      options,
    );
    Logger.debug(TAG, "[ContextMenu] Added listener to shadow root");

    // Add a document-level listener as a fallback (but only for clicks within this element)
    const documentContextMenuHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      Logger.debug(TAG, "[ContextMenu] Document contextmenu handler", {
        target: target,
        contains: this.contains(target),
        shadowContains: this.shadowRoot?.contains(target),
      });
      if (this.contains(target) || this.shadowRoot?.contains(target)) {
        // Call the main handler to show the menu
        Logger.debug(
          TAG,
          "[ContextMenu] Document handler calling preventDefaultContextMenu",
        );
        preventDefaultContextMenu(e);
        return false;
      }
      return false;
    };
    document.addEventListener("contextmenu", documentContextMenuHandler, {
      capture: true,
      passive: false,
    });
    Logger.debug(TAG, "[ContextMenu] Added document-level listener");

    // Also use oncontextmenu attribute on the element itself (most reliable)
    // This must also show the menu, not just prevent default
    this.oncontextmenu = (e: MouseEvent) => {
      Logger.debug(TAG, "[ContextMenu] oncontextmenu handler called");
      preventDefaultContextMenu(e);
      return false;
    };
    Logger.debug(TAG, "[ContextMenu] Set oncontextmenu handler");

    // Store handler for cleanup
    (this as any)._documentContextMenuHandler = documentContextMenuHandler;

    // Hide context menu on click outside
    document.addEventListener(
      "click",
      (e) => {
        if (!this._contextMenuVisible) return;

        // Use composedPath to get all elements in the event path (including shadow DOM)
        const path = e.composedPath ? e.composedPath() : [e.target];
        const isClickOnMenu = path.some((node) => {
          if (node === contextMenu) return true;
          if (
            node instanceof Element &&
            (node.classList.contains("movi-context-menu") ||
              node.closest(".movi-context-menu") ||
              node.closest(
                ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
              ))
          ) {
            return true;
          }
          return false;
        });

        Logger.debug(TAG, "[ContextMenu] Click outside check", {
          contextMenuVisible: this._contextMenuVisible,
          isClickOnMenu,
          pathLength: path.length,
          target: e.target,
        });

        // Hide if click is NOT on the menu
        if (!isClickOnMenu) {
          hideContextMenu(); // Used new local method
        }
      },
      true,
    );

    // Handle backdrop click to close menu
    const backdrop = shadowRoot.querySelector(
      ".movi-context-menu-backdrop",
    ) as HTMLElement;
    backdrop?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      hideContextMenu(); // Used new local method
    });

    // Handle context menu item clicks. The same handler is attached to
    // submenus too because they live as siblings of contextMenu in shadowRoot
    // (moved out so they escape the menu's overflow containing block).
    const itemClickHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      const item = target.closest(".movi-context-menu-item") as HTMLElement;
      if (!item) return;

      e.stopPropagation();
      e.preventDefault(); // Added e.preventDefault()

      const action = item.dataset.action;

      // Handle Back button for mobile submenus
      if (action === "back") {
        const submenu = item.closest(
          ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
        );
        if (submenu) {
          submenu.classList.remove("movi-context-menu-submenu-visible");
        }
        return;
      }

      const speed = item.dataset.speed;
      const audioTrackId = item.dataset.audioTrackId;
      const audioLang = item.dataset.audioLang;
      const audioOutputId = item.dataset.audioOutputId;
      const audioOutputUnlock = item.dataset.audioOutputUnlock;
      const subtitleTrackId = item.dataset.subtitleTrackId;
      const subtitleId = item.dataset.subtitleId;

      if (action === "play-pause") {
        if (this.player) {
          const state = this.player.getState();
          if (state === "playing" || state === "buffering") {
            this.pause();
          } else {
            this.play();
          }
        }
        hideContextMenu();
      } else if (action === "speed") {
        // Show speed submenu (changed from toggle to add)
        const submenu = shadowRoot.querySelector(
          '.movi-context-menu-submenu[data-submenu="speed"]',
        ) as HTMLElement;
        if (submenu) {
          contextMenu.scrollTop = 0;
          submenu.classList.add("movi-context-menu-submenu-visible");
        }
      } else if (action === "fit") {
        const submenu = shadowRoot.querySelector('.movi-context-menu-submenu[data-submenu="fit"]') as HTMLElement;
        if (submenu) {
          this.syncFitSubmenuActive(submenu); // touch: reflect current fit
          contextMenu.scrollTop = 0;
          submenu.classList.add("movi-context-menu-submenu-visible");
        }
      } else if (action === "audio-track") {
        // Show audio track submenu (changed from toggle to add)
        const submenu = shadowRoot.querySelector(
          ".movi-context-menu-submenu-audio",
        ) as HTMLElement;
        if (submenu) {
          contextMenu.scrollTop = 0;
          submenu.classList.add("movi-context-menu-submenu-visible");
        }
      } else if (audioLang !== undefined) {
        // Select native audio language track
        if (this.player) {
          const langTrack = this.player.getAudioLangs().find(t => t.lang === audioLang);
          this.player.selectAudioLang(audioLang);
          this.updateAudioTrackMenu();
          this.showOSD(
            OSD.audio,
            langTrack?.label || audioLang,
          );
        }
        hideContextMenu();
      } else if (audioTrackId !== undefined) {
        // Select muxed audio track
        const trackId = parseInt(audioTrackId);
        if (this.player) {
          if (this.player.isNativeAudioActive()) {
            this.player.useMuxedAudio();
          }
          this.player.selectAudioTrack(trackId);
          this.updateAudioTrackMenu();
          const trk = this.player.getAudioTracks().find(t => t.id === trackId);
          this.showOSD(
            OSD.audio,
            trk?.label || trk?.language || `Audio ${trackId}`,
          );
        }
        hideContextMenu();
      } else if (action === "audio-output") {
        // Show the audio output device submenu
        const submenu = shadowRoot.querySelector(
          ".movi-context-menu-submenu-audiodevice",
        ) as HTMLElement;
        if (submenu) {
          contextMenu.scrollTop = 0;
          submenu.classList.add("movi-context-menu-submenu-visible");
        }
      } else if (audioOutputUnlock !== undefined) {
        // "Show output devices…" — this click is the gesture getUserMedia
        // needs to surface the permission prompt; keep the menu open so the
        // populated list re-shows in place.
        this.unlockAudioOutputs();
      } else if (audioOutputId !== undefined) {
        // Select an audio output device ("" = system default)
        this.setAudioOutput(audioOutputId);
        const label = audioOutputId
          ? this._audioOutputs.find((d) => d.deviceId === audioOutputId)
              ?.label || "Audio Output"
          : "System Default";
        this.showOSD(OSD.audio, label);
        hideContextMenu();
      } else if (action === "subtitle-track") {
        // Show subtitle track submenu (changed from toggle to add)
        const submenu = shadowRoot.querySelector(
          ".movi-context-menu-submenu-subtitle",
        ) as HTMLElement;
        if (submenu) {
          contextMenu.scrollTop = 0;
          submenu.classList.add("movi-context-menu-submenu-visible");
        }
      } else if (subtitleId !== undefined) {
        // Select external subtitle track
        if (this.player) {
          const subTrack = this.player.getSubtitleLangs().find((t) => t.id === subtitleId);
          this.player.selectExternalSubtitle(subtitleId);
          this.updateSubtitleTrackMenu();
          this.showOSD(
            OSD.subOn,
            subTrack?.label || subtitleId,
          );
        }
        hideContextMenu();
      } else if (subtitleTrackId !== undefined) {
        // Select muxed subtitle track
        const trackId = parseInt(subtitleTrackId);
        if (this.player) {
          const subOsdIcon = OSD.subOn;
          if (trackId === -1) {
            this.player.selectSubtitleTrack(null);
            this.player.selectExternalSubtitle(null);
            this.showOSD(
              OSD.subOff,
              "Subtitles Off",
            );
          } else {
            this.player.selectExternalSubtitle(null);
            this.player.selectSubtitleTrack(trackId);
            const trk = this.player.getSubtitleTracks().find(t => t.id === trackId);
            const ctxSubLang = trk?.language?.toUpperCase() || "";
            const ctxSubLabel = trk?.label || ctxSubLang || `Subtitle ${trackId}`;
            const ctxSubOsd = ctxSubLang && ctxSubLabel !== ctxSubLang ? `${ctxSubLabel} [${ctxSubLang}]` : ctxSubLabel;
            this.showOSD(subOsdIcon, ctxSubOsd);
          }
        }
        hideContextMenu();
      } else if (speed) {
        // Set playback speed
        const playbackSpeed = parseFloat(speed);
        if (this.player) {
          this.player.setPlaybackRate(playbackSpeed);
          this._playbackRate = playbackSpeed;
          this.setAttribute("playbackrate", playbackSpeed.toString());
        }

        // Update active state (query the item's own submenu — the speed submenu
        // is a moved-out sibling of contextMenu, so contextMenu wouldn't find
        // these items and the active class would accumulate; see the fit case).
        item.parentElement
          ?.querySelectorAll(".movi-context-menu-item[data-speed]")
          .forEach((el) => el.classList.remove("movi-context-menu-active"));
        item.classList.add("movi-context-menu-active");

        this.showOSD(
          OSD.speed,
          `Speed ${playbackSpeed}x`,
        );
        hideContextMenu();
      } else if (item.dataset.fit) {
        const fitMode = item.dataset.fit as "contain" | "cover" | "fill" | "zoom";
        if (this._objectFit === "control") {
          this._currentFit = fitMode;
        } else {
          this._objectFit = fitMode;
        }
        this.updateFitMode();
        this.updateAspectRatioIcon();
        // Query within the item's own submenu, NOT contextMenu: the fit submenu
        // is moved out to be a sibling of contextMenu (so it escapes the menu's
        // overflow), so contextMenu.querySelectorAll finds none of these items —
        // the active class was never cleared and every tapped option stayed
        // highlighted (most visible on touch, where the submenu lingers open).
        item.parentElement
          ?.querySelectorAll(".movi-context-menu-item[data-fit]")
          .forEach((el) => el.classList.remove("movi-context-menu-active"));
        item.classList.add("movi-context-menu-active");
        // Update the new context menu status too
        const aspectStatus = shadowRoot.querySelector(".movi-aspect-status");
        const fitLabels: Record<string, string> = { contain: "Fit", cover: "Fill", fill: "Stretch", zoom: "Zoom" };
        if (aspectStatus) {
          aspectStatus.textContent = fitLabels[fitMode] || fitMode;
        }
        // Surface the same Fit/Fill/… OSD the aspect button and keyboard show —
        // changing the fit from the menu was silently skipping it.
        this.showOSD(
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${MoviElement.ASPECT_ICONS[fitMode] || MoviElement.ASPECT_ICONS.contain}</svg>`,
          fitLabels[fitMode] || fitMode,
        );
        hideContextMenu();
      } else if (action === "hdr-toggle") {
        this.hdr = !this.hdr;
        this.showOSD(
          OSD.hdr,
          this.hdr ? "HDR On" : "HDR Off",
        );
        hideContextMenu();
      } else if (action === "rotate-video") {
        if (this.player && !this._pipWindow) {
          const deg = this.player.rotateVideo();
          const statusEl = this.contextMenuRoot().querySelector(".movi-rotate-status");
          if (statusEl) statusEl.textContent = `${deg}°`;
          this.syncThumbnailRotation(deg);
          this.showOSD(
            OSD.rotate,
            `Rotate ${deg}°`,
          );
        }
        hideContextMenu();
      } else if (action === "loop-toggle") {
        this.loop = !this.loop;
        this.showOSD(
          OSD.loop,
          this.loop ? "Loop On" : "Loop Off",
        );
        hideContextMenu();
      } else if (action === "stable-audio-toggle") {
        if (this.player) {
          this.stableVolume = !this._stableVolume;
          this.showOSD(
            OSD.stableAudio,
            this._stableVolume ? "Stable Volume On" : "Stable Volume Off",
          );
        }
        hideContextMenu();
      } else if (action === "ambient-toggle") {
        this.ambientMode = !this._ambientMode;
        this.updateAmbientUI();
        this.showOSD(
          OSD.ambient,
          this._ambientMode ? "Ambient Mode On" : "Ambient Mode Off",
        );
        hideContextMenu();
      } else if (action === "nerd-stats") {
        this.toggleNerdStats(shadowRoot);
        hideContextMenu();
      } else if (action === "keyboard-shortcuts") {
        const panel = shadowRoot.querySelector(
          ".movi-shortcuts-panel",
        ) as HTMLElement;
        if (panel) {
          panel.style.display = panel.style.display === "none" ? "flex" : "none";
        }
        hideContextMenu();
      } else if (action === "timeline") {
        this.toggleTimeline();
        hideContextMenu();
      } else if (action === "pip") {
        this.togglePiP();
        hideContextMenu();
      } else if (action === "fullscreen") {
        this.toggleFullscreen();
        hideContextMenu();
      } else if (action === "snapshot") {
        this.takeSnapshot();
        this.showOSD(
          OSD.snapshot,
          "Snapshot",
        );
        hideContextMenu();
      }
    };
    contextMenu.addEventListener("click", itemClickHandler);
    shadowRoot
      .querySelectorAll(
        ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle",
      )
      .forEach((sm) => sm.addEventListener("click", itemClickHandler));

    // Handle hover for submenu
    const speedItem = contextMenu.querySelector(
      '.movi-context-menu-item[data-action="speed"]',
    ) as HTMLElement;
    const speedSubmenu = shadowRoot.querySelector(
      '.movi-context-menu-submenu[data-submenu="speed"]',
    ) as HTMLElement;

    // Simplified speed submenu setup using shared handler
    if (speedItem && speedSubmenu) {
      this.setupSubmenuHover(speedItem, speedSubmenu);
    }

    // Audio and subtitle track hover handlers will be set up dynamically in updateContextMenuContent
    // when the items are shown, to avoid issues with hidden elements

    // Fit submenu hover handler
    const fitItem = contextMenu.querySelector(
      '.movi-context-menu-item[data-action="fit"]',
    ) as HTMLElement;
    const fitSubmenu = shadowRoot.querySelector(
      '.movi-context-menu-submenu[data-submenu="fit"]',
    ) as HTMLElement;
    if (fitItem && fitSubmenu) {
      this.setupSubmenuHover(fitItem, fitSubmenu);
    }
  }

  private updateContextMenuContent(
    contextMenu: HTMLElement,
    shadowRoot: ShadowRoot,
  ): void {
    if (!this.player) return;

    // Update Play/Pause text based on current state
    const playPauseItem = contextMenu.querySelector(
      '.movi-context-menu-item[data-action="play-pause"]',
    ) as HTMLElement;
    const playPauseLabel = playPauseItem?.querySelector(
      ".movi-context-menu-label",
    ) as HTMLElement;
    if (playPauseLabel) {
      const state = this.player.getState();
      playPauseLabel.textContent = state === "playing" ? "Pause" : "Play";
    }

    // Update audio tracks
    const audioTracks = this.player.getAudioTracks();
    const activeAudioTrack = this.player.trackManager.getActiveAudioTrack();
    const audioDivider = contextMenu.querySelector(
      ".movi-context-menu-divider-audio",
    ) as HTMLElement;
    const audioItem = contextMenu.querySelector(
      ".movi-context-menu-item-audio",
    ) as HTMLElement;
    const audioSubmenu = shadowRoot.querySelector(
      ".movi-context-menu-submenu-audio",
    ) as HTMLElement;

    const nativeLangs = this.player.getAudioLangs();
    const ctxIsNativeActive = this.player.isNativeAudioActive();
    const totalAudioTracks = audioTracks.length + nativeLangs.length;

    if (totalAudioTracks > 1 && audioDivider && audioItem && audioSubmenu) {
      audioDivider.style.display = "block";
      audioItem.style.display = "flex";
      audioSubmenu.style.removeProperty("display");

      let html = "";
      if (
        window.innerWidth <= 1024 ||
        window.matchMedia("(pointer: coarse)").matches
      ) {
        html += `<div class="movi-context-menu-item movi-context-menu-back" data-action="back">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span class="movi-context-menu-label">Back</span>
        </div>`;
      }

      // Muxed audio tracks
      if (audioTracks.length > 0) {
        html += audioTracks
          .map((track) => {
            const isActive = !ctxIsNativeActive && activeAudioTrack?.id === track.id;
            const label = track.label || `Audio ${track.id}`;
            const infoParts: string[] = [];
            if (track.language) {
              const langCode = track.language.length >= 2
                ? track.language.substring(0, 3).toUpperCase()
                : track.language.toUpperCase();
              infoParts.push(langCode);
            }
            if (track.channels) infoParts.push(`${track.channels}ch`);
            const info = infoParts.length > 0 ? ` (${infoParts.join(" • ")})` : "";
            const activeClass = isActive ? " movi-context-menu-active" : "";
            return `<div class="movi-context-menu-item${activeClass}" data-audio-track-id="${track.id}">${label}${info}</div>`;
          })
          .join("");
      }

      // External audio tracks
      if (nativeLangs.length > 0) {
        html += nativeLangs
          .map((t) => {
            const activeClass = t.active ? " movi-context-menu-active" : "";
            return `<div class="movi-context-menu-item${activeClass}" data-audio-lang="${t.lang}">${t.label} (${t.lang.toUpperCase()})</div>`;
          })
          .join("");
      }

      audioSubmenu.innerHTML = html;

      // Setup hover handlers for audio track submenu
      this.setupSubmenuHover(audioItem, audioSubmenu);
    } else {
      if (audioDivider) audioDivider.style.display = "none";
      if (audioItem) audioItem.style.display = "none";
      if (audioSubmenu) audioSubmenu.style.display = "none";
    }

    // Audio output device submenu (renders from the cached device list;
    // refreshAudioOutputs() on menu-open re-renders it once enumeration lands).
    this.updateAudioOutputMenu();

    // Update subtitle tracks
    const subtitleTracks = this.player.getSubtitleTracks();
    const activeSubtitleTrack =
      this.player.trackManager.getActiveSubtitleTrack();
    const ctxExternalSubs = this.player.getSubtitleLangs();
    const ctxAnyExternalSubActive = ctxExternalSubs.some((t) => t.active);
    const subtitleDivider = contextMenu.querySelector(
      ".movi-context-menu-divider-subtitle",
    ) as HTMLElement;
    const subtitleItem = contextMenu.querySelector(
      ".movi-context-menu-item-subtitle",
    ) as HTMLElement;
    const subtitleSubmenu = shadowRoot.querySelector(
      ".movi-context-menu-submenu-subtitle",
    ) as HTMLElement;

    if (
      (subtitleTracks.length > 0 || ctxExternalSubs.length > 0) &&
      subtitleDivider &&
      subtitleItem &&
      subtitleSubmenu
    ) {
      subtitleDivider.style.display = "block";
      subtitleItem.style.display = "flex";
      subtitleSubmenu.style.removeProperty("display");

      // Update Context Menu Icon
      const contextMenuSubtitleIcon = subtitleItem.querySelector(
        "svg:not(.movi-context-menu-subtitle-filled)",
      ) as HTMLElement;
      const contextMenuSubtitleFilledIcon = subtitleItem.querySelector(
        ".movi-context-menu-subtitle-filled",
      ) as HTMLElement;

      const ctxSubActive = activeSubtitleTrack !== null || ctxAnyExternalSubActive;
      if (ctxSubActive) {
        if (contextMenuSubtitleIcon) contextMenuSubtitleIcon.style.display = "none";
        if (contextMenuSubtitleFilledIcon) contextMenuSubtitleFilledIcon.style.display = "block";
      } else {
        if (contextMenuSubtitleIcon) contextMenuSubtitleIcon.style.display = "block";
        if (contextMenuSubtitleFilledIcon) contextMenuSubtitleFilledIcon.style.display = "none";
      }

      const ctxOffActive = !activeSubtitleTrack && !ctxAnyExternalSubActive;
      let html = "";
      if (
        window.innerWidth <= 1024 ||
        window.matchMedia("(pointer: coarse)").matches
      ) {
        html += `<div class="movi-context-menu-item movi-context-menu-back" data-action="back">
          <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span class="movi-context-menu-label">Back</span>
        </div>`;
      }
      html += `<div class="movi-context-menu-item${ctxOffActive ? " movi-context-menu-active" : ""}" data-subtitle-track-id="-1">Off</div>`;

      // Muxed subtitle tracks
      html += subtitleTracks
        .map((track) => {
          const isActive = activeSubtitleTrack?.id === track.id;
          const label = track.label || track.language || `Subtitle ${track.id}`;
          const infoParts: string[] = [];

          if (track.language && !track.label) {
            const langCode =
              track.language.length >= 2
                ? track.language.substring(0, 3).toUpperCase()
                : track.language.toUpperCase();
            infoParts.push(langCode);
          }

          const info =
            infoParts.length > 0 ? ` (${infoParts.join(" • ")})` : "";
          const activeClass = isActive ? " movi-context-menu-active" : "";

          return `<div class="movi-context-menu-item${activeClass}" data-subtitle-track-id="${track.id}">${label}${info}</div>`;
        })
        .join("");

      // External subtitle tracks
      html += ctxExternalSubs
        .map((t) => {
          const activeClass = t.active ? " movi-context-menu-active" : "";
          return `<div class="movi-context-menu-item${activeClass}" data-subtitle-id="${t.id}">${t.label} (${t.lang.toUpperCase()})</div>`;
        })
        .join("");

      subtitleSubmenu.innerHTML = html;

      this.setupSubmenuHover(subtitleItem, subtitleSubmenu);
    } else {
      if (subtitleDivider) subtitleDivider.style.display = "none";
      if (subtitleItem) subtitleItem.style.display = "none";
      if (subtitleSubmenu) subtitleSubmenu.style.display = "none";
    }

    // Update HDR visibility/state in context menu
    this.updateHDRVisibility();

    // Update active state for Fit mode.
    const currentActiveFit =
      this._objectFit === "control" ? this._currentFit : this._objectFit;
    const fitItems = contextMenu.querySelectorAll(
      ".movi-context-menu-item[data-fit]",
    );
    fitItems.forEach((item) => {
      const fit = (item as HTMLElement).dataset.fit;
      if (fit === currentActiveFit) {
        item.classList.add("movi-context-menu-active");
      } else {
        item.classList.remove("movi-context-menu-active");
      }
    });

    // Disable rotate during PiP
    const rotateItem = contextMenu.querySelector('.movi-context-menu-item[data-action="rotate-video"]');
    if (rotateItem) {
      rotateItem.classList.toggle("movi-context-menu-disabled", !!this._pipWindow);
    }
  }

  /**
   * Highlight the current fit as the active row in the aspect-ratio submenu, so
   * it reflects the live fit however it was last changed — context menu, the
   * bottom-controls aspect button, or the keyboard shortcut. Called each time
   * the fit submenu is shown: on hover (desktop, via showSubmenu) and on tap
   * (touch, via the action==="fit" branch). Kept OUT of updateContextMenuContent
   * (which runs on the main menu's open) to avoid touch-open side effects.
   */
  private syncFitSubmenuActive(submenu: HTMLElement): void {
    const currentFit =
      this._objectFit === "control" ? this._currentFit : this._objectFit;
    submenu
      .querySelectorAll(".movi-context-menu-item[data-fit]")
      .forEach((el) =>
        el.classList.toggle(
          "movi-context-menu-active",
          (el as HTMLElement).dataset.fit === currentFit,
        ),
      );
  }

  private setupSubmenuHover(item: HTMLElement, submenu: HTMLElement): void {
    // Check if listeners are already attached (using a data attribute)
    if (item.dataset.hoverSetup === "true") {
      return; // Already set up
    }

    // Mark as set up
    item.dataset.hoverSetup = "true";

    let hideTimeout: number | null = null;

    const showSubmenu = () => {
      // Clear any pending hide timeout
      if (hideTimeout !== null) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      // The menu (and its submenu panels) may be in the body portal (desktop)
      // rather than the shadow root — find it wherever it lives.
      const contextMenu = (this._menuPortalRoot?.querySelector(
        ".movi-context-menu",
      ) ||
        this.shadowRoot?.querySelector(
          ".movi-context-menu",
        )) as HTMLElement | null;
      if (contextMenu) {
        // Use VIEWPORT coordinates when the menu itself is viewport-positioned:
        // the desktop menu is portaled (absolute inside the fixed portal host at
        // 0,0), and the audio-strip menu is fixed (strip mode drops the host's
        // container-type, so a fixed submenu is viewport-relative too and lines
        // up with it — the tiny 56px strip's bounds must NOT confine it).
        // Otherwise the submenu is :host-relative and confined to the player.
        const portaled = contextMenu.getRootNode() === this._menuPortalRoot;
        const strip = this.classList.contains("movi-audio-strip");
        const useViewport = portaled || strip;
        // Strip: pin the submenu to the viewport like the strip menu.
        submenu.style.position = strip ? "fixed" : "";
        const itemRect = item.getBoundingClientRect();
        const menuRect = contextMenu.getBoundingClientRect();
        const playerRect = this.getBoundingClientRect();
        const submenuWidth = submenu.offsetWidth || 160;
        const gap = 4;
        const padding = 10;

        const originLeft = useViewport ? 0 : playerRect.left;
        const originTop = useViewport ? 0 : playerRect.top;
        const boundsLeft = useViewport ? 0 : playerRect.left;
        const boundsRight = useViewport ? window.innerWidth : playerRect.right;
        const boundsBottom = useViewport ? window.innerHeight : playerRect.bottom;

        const spaceOnRight = boundsRight - menuRect.right;
        const spaceOnLeft = menuRect.left - boundsLeft;

        submenu.style.right = "auto";
        submenu.style.marginLeft = "0";
        submenu.style.marginRight = "0";

        // Positions are relative to the submenu's containing block (viewport
        // origin when portaled, else :host), so subtract the origin.
        if (spaceOnRight >= submenuWidth + padding) {
          // 1. RIGHT (Preferred)
          submenu.style.left = `${menuRect.right + gap - originLeft}px`;
          submenu.style.transform = "translateX(-8px)";
        } else if (spaceOnLeft >= submenuWidth + padding) {
          // 2. LEFT
          submenu.style.left = `${menuRect.left - submenuWidth - gap - originLeft}px`;
          submenu.style.transform = "translateX(8px)";
        } else {
          // 3. OVERLAP (tight space)
          submenu.style.left = `${menuRect.left + 20 - originLeft}px`;
          submenu.style.transform = "translateY(10px)";
        }

        let topPx = itemRect.top - originTop;
        submenu.style.top = `${topPx}px`;

        // Measure submenu height (force layout if hidden)
        const wasClassVisible = submenu.classList.contains(
          "movi-context-menu-submenu-visible",
        );
        if (!wasClassVisible) {
          submenu.style.visibility = "hidden";
          submenu.style.display = "block";
        }
        const submenuHeight = submenu.getBoundingClientRect().height;
        if (!wasClassVisible) {
          submenu.style.display = "";
          submenu.style.visibility = "";
        }

        // Clamp to the bounds (viewport when portaled, else player).
        const maxTop = boundsBottom - originTop - padding - submenuHeight;
        if (topPx > maxTop) {
          topPx = Math.max(padding, maxTop);
          submenu.style.top = `${topPx}px`;
        }
      }

      // Desktop hover-open of the aspect submenu: reflect the current fit.
      if (submenu.dataset.submenu === "fit") this.syncFitSubmenuActive(submenu);

      submenu.classList.add("movi-context-menu-submenu-visible");
    };

    const hideSubmenu = () => {
      submenu.classList.remove("movi-context-menu-submenu-visible");
    };

    const scheduleHide = () => {
      // Clear any existing timeout
      if (hideTimeout !== null) {
        clearTimeout(hideTimeout);
      }
      // Add a small delay to allow mouse to move to submenu
      hideTimeout = window.setTimeout(() => {
        hideSubmenu();
        hideTimeout = null;
      }, 150); // 150ms delay
    };

    // Setup listeners - ONLY on hover-capable devices (touch uses tap-to-open)
    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    if (!isTouchDevice) {
      item.addEventListener("mouseenter", showSubmenu);

      item.addEventListener("mouseleave", (e) => {
        const relatedTarget = e.relatedTarget as Node;
        // Check if mouse is moving to submenu
        if (!submenu.contains(relatedTarget) && relatedTarget !== submenu) {
          scheduleHide();
        }
      });

      // When mouse enters submenu, cancel hide and show it
      submenu.addEventListener("mouseenter", () => {
        if (hideTimeout !== null) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
        showSubmenu();
      });

      submenu.addEventListener("mouseleave", (e) => {
        const relatedTarget = e.relatedTarget as Node;
        // Check if mouse is moving back to parent item
        if (!item.contains(relatedTarget) && relatedTarget !== item) {
          scheduleHide();
        }
      });
    }
  }

  private async toggleFullscreen(): Promise<void> {
    if (this.isLoading || this._isUnsupported || !this.player) {
      return;
    }
    // Audio-only sources (bare strip OR cover-art view) have nothing to show
    // fullscreen. Block it at this single chokepoint so double-click, the F
    // key, and the button are all covered, in both audio layouts.
    if (this.classList.contains("movi-audio-mode")) {
      return;
    }

    // Give the host a chance to take over (e.g. VS Code webviews where
    // requestFullscreen is blocked, or embedded apps that drive their own
    // fullscreen layout). Hosts call event.preventDefault() and then drive
    // setHostFullscreen() themselves to keep the UI in sync.
    const currentlyActive = this.isFullscreenActive();
    const requestEvent = new CustomEvent("movi-fullscreen-request", {
      cancelable: true,
      bubbles: true,
      composed: true,
      detail: { active: currentlyActive },
    });
    this.dispatchEvent(requestEvent);
    if (requestEvent.defaultPrevented) {
      return;
    }

    // iOS Safari (and any engine without element-fullscreen): the Fullscreen
    // API only works on <video>, and we render to a canvas — so fall back to a
    // CSS viewport-fill "pseudo fullscreen" instead of throwing on requestFullscreen.
    if (!this.nativeFullscreenSupported()) {
      if (this._presentation === "native") {
        const v = this.video as HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
        };
        if (typeof v.webkitEnterFullscreen === "function") {
          v.webkitEnterFullscreen();
          return;
        }
      }
      this.setPseudoFullscreen(!this._pseudoFullscreen);
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await this.requestFullscreen();
        this.applyFullscreenUiState(true);
      } else {
        await document.exitFullscreen();
        this.applyFullscreenUiState(false);
      }
    } catch (error) {
      Logger.error(TAG, "Failed to toggle fullscreen", error);
    }
  }

  private _pipWindow: Window | null = null;

  private restorePiPCanvas(): void {
    Logger.info(TAG, `restorePiPCanvas called — _pipWindow: ${!!this._pipWindow}, canvas: ${!!this.canvas}, shadowRoot: ${!!this.shadowRoot}`);
    if (!this._pipWindow) {
      Logger.info(TAG, "restorePiPCanvas: already restored, skipping");
      return;
    }
    this._pipWindow = null;
    if (this.player) this.player.isPiPActive = false;

    const canvas = this.canvas;
    const sr = this.shadowRoot;
    if (!canvas || !sr) {
      Logger.warn(TAG, `restorePiPCanvas: missing canvas=${!!canvas} shadowRoot=${!!sr}`);
      return;
    }

    // Always move canvas back to shadowRoot as first child (original position)
    if (canvas.parentNode !== sr) {
      sr.insertBefore(canvas, sr.firstChild);
      Logger.info(TAG, "restorePiPCanvas: moved canvas back to shadowRoot");
    } else {
      Logger.info(TAG, "restorePiPCanvas: canvas already in shadowRoot");
    }

    Logger.info(TAG, `restorePiPCanvas: canvas isConnected=${canvas.isConnected}`);

    // Invalidate the cached host dimensions so updateCanvasSize() actually
    // re-runs the resize. While in PiP, resizeInPiP() set canvas.width to
    // the small PiP window size (e.g. 400x225) directly, bypassing
    // updateCanvasSize — so _lastCanvasW still matches the host's bounding
    // rect from before we entered PiP. Without this reset, the coalescing
    // guard at the top of updateCanvasSize early-returns and the buffer
    // stays at PiP resolution → pixelated render at full size.
    this._lastCanvasW = 0;
    this._lastCanvasH = 0;

    // Restore original size
    requestAnimationFrame(() => {
      this.updateCanvasSize();
      Logger.info(TAG, `restorePiPCanvas: after resize — ${this.canvas?.width}x${this.canvas?.height}`);
    });
    Logger.info(TAG, "PiP closed, canvas restored");
  }

  private async togglePiP(): Promise<void> {
    if (!this.player || !this.canvas) return;

    const docPiP = (window as any).documentPictureInPicture;
    if (!docPiP) return;

    // If already in PiP, close it and restore immediately
    if (this._pipWindow) {
      Logger.info(TAG, "togglePiP: closing PiP, restoring canvas first");
      const win = this._pipWindow;
      this.restorePiPCanvas();
      try { win.close(); } catch (_) {}
      Logger.info(TAG, "togglePiP: PiP window closed");
      this.dispatchEvent(new CustomEvent("pipchange", { detail: { pip: false } }));
      return;
    }

    try {
      const videoTrack = this.player.getVideoTracks()?.[0];
      const vw = videoTrack?.width || 640;
      const vh = videoTrack?.height || 360;
      const savedRotation = this.player.getVideoRotation();
      // PiP always shows original (unrotated) video
      const aspect = vw / vh;
      const maxW = Math.min(400, window.innerWidth * 0.35);
      const maxH = Math.min(500, window.innerHeight * 0.5);
      let pipWidth: number, pipHeight: number;
      if (aspect >= 1) {
        pipWidth = maxW;
        pipHeight = Math.round(maxW / aspect);
      } else {
        pipHeight = maxH;
        pipWidth = Math.round(maxH * aspect);
      }
      // Reset rotation for PiP (restore on close)
      if (savedRotation !== 0) {
        this.player.setVideoRotation(0);
      }

      const pipWindow: Window = await docPiP.requestWindow({
        width: Math.round(pipWidth),
        height: Math.round(pipHeight),
      });
      this._pipWindow = pipWindow;
      this.dispatchEvent(new CustomEvent("pipchange", { detail: { pip: true } }));

      // Chrome may ignore requestWindow size (remembers last PiP size), force resize
      try {
        const chromeW = pipWindow.outerWidth - pipWindow.innerWidth;
        const chromeH = pipWindow.outerHeight - pipWindow.innerHeight;
        pipWindow.resizeTo(Math.round(pipWidth) + chromeW, Math.round(pipHeight) + chromeH);
      } catch {};

      // Style the PiP window
      const style = pipWindow.document.createElement("style");
      style.textContent = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #000; overflow: hidden; width: 100%; height: 100%; position: relative; }
        canvas { width: 100%; height: 100%; object-fit: contain; display: block; }
        .pip-controls {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.85));
          padding: 8px 10px 6px; display: flex; flex-direction: column; gap: 4px;
          opacity: 0; transition: opacity 0.2s;
        }
        body:hover .pip-controls, body.show-controls .pip-controls { opacity: 1; }
        .pip-progress-row { display: flex; flex-direction: column; gap: 4px; }
        .pip-progress-bar {
          width: 100%; height: 3px; background: rgba(255,255,255,0.2);
          border-radius: 2px; cursor: pointer; position: relative;
        }
        .pip-progress-bar:hover { height: 5px; }
        .pip-progress-fill {
          height: 100%; background: var(--movi-primary, #8B5CF6); border-radius: 2px;
          width: 0%; pointer-events: none;
        }
        .pip-time { font: 500 10px/1 -apple-system, sans-serif; color: rgba(255,255,255,0.7); white-space: nowrap; }
        .pip-time-row { display: flex; justify-content: space-between; padding: 0 2px; }
        .pip-btn-row { display: flex; align-items: center; justify-content: center; gap: 16px; position: relative; }
        .pip-btn {
          background: none; border: none; cursor: pointer; padding: 4px;
          color: var(--movi-chrome-fg, #fff); opacity: 0.85; display: flex; align-items: center; justify-content: center;
        }
        .pip-btn:hover { opacity: 1; }
        .pip-btn svg { width: 20px; height: 20px; }
        .pip-btn.play-pause svg { width: 26px; height: 26px; }
        .pip-btn.mute-toggle { position: absolute; left: 0; }
        .pip-btn.mute-toggle svg { width: 18px; height: 18px; }
        .pip-btn.back-to-tab { position: absolute; right: 0; }
        .pip-btn.back-to-tab svg { width: 18px; height: 18px; }
      `;
      pipWindow.document.head.appendChild(style);

      // Move canvas to PiP window
      pipWindow.document.body.appendChild(this.canvas);
      // Clear any leftover cursor:none (from a hidden-controls state before
      // entering PiP) so the pointer is visible in the PiP window immediately.
      this.canvas.style.cursor = "default";
      Logger.info(TAG, `PiP: canvas moved to PiP window, isConnected=${this.canvas.isConnected}`);

      // Build PiP controls
      const controls = pipWindow.document.createElement("div");
      controls.className = "pip-controls";

      // Progress row
      const progressRow = pipWindow.document.createElement("div");
      progressRow.className = "pip-progress-row";
      const timeRow = pipWindow.document.createElement("div");
      timeRow.className = "pip-time-row";
      const timeCurrent = pipWindow.document.createElement("div");
      timeCurrent.className = "pip-time";
      timeCurrent.textContent = "00:00";
      const timeDuration = pipWindow.document.createElement("div");
      timeDuration.className = "pip-time";
      timeDuration.textContent = "00:00";
      timeRow.appendChild(timeCurrent);
      timeRow.appendChild(timeDuration);
      const progressBar = pipWindow.document.createElement("div");
      progressBar.className = "pip-progress-bar";
      const progressFill = pipWindow.document.createElement("div");
      progressFill.className = "pip-progress-fill";
      progressBar.appendChild(progressFill);
      progressRow.appendChild(timeRow);
      progressRow.appendChild(progressBar);

      // Button row
      const btnRow = pipWindow.document.createElement("div");
      btnRow.className = "pip-btn-row";

      const makeBtn = (cls: string, svg: string) => {
        const btn = pipWindow.document.createElement("button");
        btn.className = `pip-btn ${cls}`;
        btn.innerHTML = svg;
        return btn;
      };

      const seekBackBtn = makeBtn("seek-back", `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3C7.81 3 4.01 6.54 3.58 11H1l3.5 4L8 11H5.59c.42-3.35 3.33-6 6.91-6 3.87 0 7 3.13 7 7s-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.96 8.96 0 0012.5 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z"/><text x="12.5" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" font-family="-apple-system,sans-serif">10</text></svg>`);
      const playPauseBtn = makeBtn("play-pause", this.player.getState() === "playing"
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`);
      const seekFwdBtn = makeBtn("seek-fwd", `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 3c4.69 0 8.49 3.54 8.92 8H23l-3.5 4L16 11h2.41c-.42-3.35-3.33-6-6.91-6-3.87 0-7 3.13-7 7s3.13 7 7 7c1.93 0 3.68-.79 4.94-2.06l1.42 1.42A8.96 8.96 0 0111.5 21c-4.97 0-9-4.03-9-9s4.03-9 9-9z"/><text x="11.5" y="15.5" text-anchor="middle" font-size="7.5" font-weight="700" font-family="-apple-system,sans-serif">10</text></svg>`);
      const backToTabBtn = makeBtn("back-to-tab", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`);
      const isMuted = this._muted;
      const muteBtn = makeBtn("mute-toggle", isMuted
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`);

      btnRow.appendChild(muteBtn);
      btnRow.appendChild(seekBackBtn);
      btnRow.appendChild(playPauseBtn);
      btnRow.appendChild(seekFwdBtn);
      btnRow.appendChild(backToTabBtn);

      controls.appendChild(progressRow);
      controls.appendChild(btnRow);
      pipWindow.document.body.appendChild(controls);

      // PiP control handlers
      const updatePlayPauseIcon = () => {
        if (!this.player) return;
        const isPlaying = this.player.getState() === "playing";
        playPauseBtn.innerHTML = isPlaying
          ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
      };

      playPauseBtn.addEventListener("click", () => {
        if (!this.player) return;
        const pipPlayState = this.player.getState();
        if (pipPlayState === "playing" || pipPlayState === "buffering") this.pause();
        else this.play();
      });

      seekBackBtn.addEventListener("click", () => {
        if (!this.player) return;
        this.currentTime = Math.max(0, this.currentTime - 10);
      });

      seekFwdBtn.addEventListener("click", () => {
        if (!this.player) return;
        this.currentTime = Math.min(this.duration, this.currentTime + 10);
      });

      backToTabBtn.addEventListener("click", () => {
        this.togglePiP();
      });

      muteBtn.addEventListener("click", () => {
        this.muted = !this.muted;
        this.showOSD(
          this.muted
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
          this.muted ? "Muted" : "Unmuted",
        );
      });

      // Progress bar seek
      progressBar.addEventListener("click", (e: MouseEvent) => {
        if (!this.player || !this.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.currentTime = this.barFractionToTime(pct);
      });

      // Update progress + time on interval
      const pipUpdateInterval = setInterval(() => {
        if (!this._pipWindow || !this.player) { clearInterval(pipUpdateInterval); return; }
        const cur = this.currentTime;
        const dur = this.duration || 0;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        progressFill.style.width = `${pct}%`;
        timeCurrent.textContent = this.formatTime(cur);
        timeDuration.textContent = this.formatTime(dur);
        updatePlayPauseIcon();
        const muted = this._muted;
        muteBtn.innerHTML = muted
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      }, 250);

      // Show controls briefly on open
      pipWindow.document.body.classList.add("show-controls");
      setTimeout(() => pipWindow.document.body.classList.remove("show-controls"), 2000);

      // Keyboard shortcuts in PiP window
      pipWindow.document.addEventListener("keydown", (e: KeyboardEvent) => {
        if (!this.player) return;
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          const pipState = this.player.getState();
          if (pipState === "playing" || pipState === "buffering") this.pause();
          else this.play();
        } else if (e.key === "ArrowLeft") {
          this.currentTime = Math.max(0, this.currentTime - 10);
        } else if (e.key === "ArrowRight") {
          this.currentTime = Math.min(this.duration, this.currentTime + 10);
        } else if (e.key === "m") {
          muteBtn.click();
        } else if (e.key === "Escape" || e.key === "p") {
          this.togglePiP();
        }
      });

      // Mark PiP active so background handler doesn't drop frames
      this.player.isPiPActive = true;

      // Resize canvas to fit PiP window
      const resizeInPiP = () => {
        if (this._pipWindow && this.player) {
          this.player.resizeCanvas(pipWindow.innerWidth, pipWindow.innerHeight);
        }
      };
      pipWindow.addEventListener("resize", resizeInPiP);
      resizeInPiP();

      // Handle PiP window close — move canvas back
      const restore = (e: Event) => {
        Logger.info(TAG, `PiP event: ${e.type} fired`);
        clearInterval(pipUpdateInterval);
        this.restorePiPCanvas();
        // Restore rotation
        if (savedRotation !== 0 && this.player) {
          requestAnimationFrame(() => this.player?.setVideoRotation(savedRotation));
        }
      };
      pipWindow.addEventListener("pagehide", restore);
      pipWindow.addEventListener("unload", restore);

      Logger.info(TAG, `PiP opened: ${Math.round(pipWidth)}x${pipHeight}`);
    } catch (error) {
      Logger.error(TAG, "Failed to open PiP", error);
      this._pipWindow = null;
      // The Document PiP API exists but requestWindow was blocked — e.g. a
      // sandboxed iframe without allow-popups, or a Permissions-Policy the
      // upfront check couldn't see. That's a static property of the embedding
      // context, not a one-off, so retire the (dead) control rather than let it
      // fail again on every click.
      const pipBtn = this.shadowRoot?.querySelector(
        ".movi-pip-btn",
      ) as HTMLElement | null;
      if (pipBtn) pipBtn.style.display = "none";
      const pipCtxItem = this.shadowRoot?.querySelector(
        ".movi-context-menu-pip",
      ) as HTMLElement | null;
      if (pipCtxItem) pipCtxItem.style.display = "none";
    }
  }

  /** Tracks host-driven fullscreen so toggleFullscreen() and the
   *  movi-fullscreen-request event can reflect it correctly even when
   *  document.fullscreenElement is null. */
  private _hostFullscreen = false;

  /** CSS "fill the viewport" fallback used where the element Fullscreen API
   *  isn't available (iOS Safari only exposes it for <video>, and we render to
   *  a canvas). Not real fullscreen — no chrome hiding — but the player takes
   *  over the visible viewport. */
  private _pseudoFullscreen = false;
  private _prevBodyOverflow = "";

  /** True when the player is fullscreen by any route: native element FS, a
   *  host-driven FS, or the iOS pseudo-fullscreen fallback. */
  private isFullscreenActive(): boolean {
    return (
      document.fullscreenElement === this ||
      this._hostFullscreen ||
      this._pseudoFullscreen
    );
  }

  /** Whether the browser exposes the element Fullscreen API for this element
   *  (false on iOS Safari, which only fullscreens <video>). */
  private nativeFullscreenSupported(): boolean {
    if (this._presentation === "native") {
      const v = this.video as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
      };
      if (typeof v.webkitEnterFullscreen === "function") return true;
    }
    return (
      typeof this.requestFullscreen === "function" && !!document.fullscreenEnabled
    );
  }

  /** Re-evaluate on device rotation / viewport change while pseudo-fullscreen. */
  private _onPseudoFsResize = () => {
    this.updatePseudoFsRotation();
    this.updateCanvasSize();
  };

  /**
   * Forced-landscape for the pseudo-fullscreen fallback: iOS won't rotate the
   * screen for us, so a landscape video on a portrait screen is turned 90° via
   * CSS (the .movi-pseudo-fs-rotate class) to fill it — matching what Chrome /
   * Android do with an orientation lock. Once the device itself is landscape
   * (window wider than tall) the rotation is dropped.
   */
  private updatePseudoFsRotation(): void {
    if (!this._pseudoFullscreen) {
      this.classList.remove("movi-pseudo-fs-rotate");
      return;
    }
    const track = this.player?.trackManager?.getActiveVideoTrack?.();
    const rawW = track?.width ?? 0;
    const rawH = track?.height ?? 0;
    const rot = this.player?.getVideoRotation?.() ?? track?.rotation ?? 0;
    const swap = Math.abs(rot) % 180 !== 0;
    const vidW = swap ? rawH : rawW;
    const vidH = swap ? rawW : rawH;
    const videoLandscape = vidW > vidH && vidW > 0;
    const windowPortrait = window.innerHeight > window.innerWidth;
    this.classList.toggle(
      "movi-pseudo-fs-rotate",
      videoLandscape && windowPortrait,
    );
  }

  /** Enter/leave the CSS viewport-fill fallback. */
  private setPseudoFullscreen(on: boolean): void {
    if (this._pseudoFullscreen === on) return;
    this._pseudoFullscreen = on;
    this.classList.toggle("movi-pseudo-fullscreen", on);
    if (on) {
      // Lock the page scroll behind the overlay while active.
      this._prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      this.updatePseudoFsRotation();
      window.addEventListener("resize", this._onPseudoFsResize);
      window.addEventListener("orientationchange", this._onPseudoFsResize);
    } else {
      this.classList.remove("movi-pseudo-fs-rotate");
      window.removeEventListener("resize", this._onPseudoFsResize);
      window.removeEventListener("orientationchange", this._onPseudoFsResize);
      document.body.style.overflow = this._prevBodyOverflow;
    }
    this.applyFullscreenUiState(on);
    this.applyFullscreenOrientation(on);
    // Repaint the canvas at the new (viewport) size.
    this.updateCanvasSize();
  }

  private updateFullscreenIcon(isFullscreen: boolean): void {
    const fullscreenIcon = this.shadowRoot?.querySelector(
      ".movi-icon-fullscreen",
    ) as HTMLElement;
    const fullscreenExitIcon = this.shadowRoot?.querySelector(
      ".movi-icon-fullscreen-exit",
    ) as HTMLElement;

    if (isFullscreen) {
      fullscreenIcon?.style.setProperty("display", "none");
      fullscreenExitIcon?.style.setProperty("display", "block");
    } else {
      fullscreenIcon?.style.setProperty("display", "block");
      fullscreenExitIcon?.style.setProperty("display", "none");
    }
  }

  private updateFullscreenContextMenu(isFullscreen: boolean): void {
    const label = this.shadowRoot?.querySelector(
      '.movi-context-menu-item[data-action="fullscreen"] .movi-context-menu-label',
    ) as HTMLElement | null;
    if (label) label.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
  }

  /**
   * On phones/tablets, rotate to match the video when entering fullscreen and
   * release the lock on exit. Wide clips lock landscape, tall clips portrait;
   * defaults to landscape (the common case) if dimensions aren't known. No-op on
   * desktop, audio-only, or where the Screen Orientation lock API is missing
   * (e.g. iOS Safari, which rejects programmatic lock — caught and ignored).
   */
  private applyFullscreenOrientation(isFullscreen: boolean): void {
    const so = (
      screen as unknown as {
        orientation?: {
          lock?: (o: string) => Promise<void>;
          unlock?: () => void;
        };
      }
    ).orientation;
    if (!so || typeof so.lock !== "function") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (this.classList.contains("movi-audio-mode")) return;

    if (isFullscreen) {
      const track = this.player?.trackManager?.getActiveVideoTrack?.();
      const rawW = track?.width ?? 0;
      const rawH = track?.height ?? 0;
      // Portrait clips shot on phones are usually stored as landscape frames
      // plus a 90°/270° rotation flag, so the raw width/height read landscape.
      // Use the effective display rotation (metadata + manual) to swap them,
      // otherwise a tall video would wrongly lock landscape on entry.
      const rot = this.player?.getVideoRotation?.() ?? track?.rotation ?? 0;
      const rotated = Math.abs(rot) % 180 !== 0;
      const w = rotated ? rawH : rawW;
      const h = rotated ? rawW : rawH;
      const target = h > w && h > 0 ? "portrait" : "landscape";
      Promise.resolve(so.lock(target)).catch(() => {
        /* unsupported / user-denied — leave orientation as-is */
      });
    } else {
      try {
        so.unlock?.();
      } catch {
        /* ignore */
      }
    }
  }

  private applyFullscreenUiState(isFullscreen: boolean): void {
    this.updateFullscreenIcon(isFullscreen);
    this.updateFullscreenContextMenu(isFullscreen);
  }

  /**
   * Public hook for hosts (VS Code extension, embedded apps) that take over
   * fullscreen via the cancelable `movi-fullscreen-request` event. Call this
   * whenever the host enters/exits its custom fullscreen so the player's
   * toolbar icon and right-click context menu reflect the correct state.
   */
  public setHostFullscreen(active: boolean): void {
    this._hostFullscreen = active;
    this.applyFullscreenUiState(active);
  }

  private static readonly ASPECT_ICONS: Record<string, string> = {
    contain: `<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="6" y="8" width="12" height="8" rx="1"/>`,
    cover: `<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="1" y="7" width="22" height="10" rx="1"/>`,
    fill: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3h18v18H3z"/>`,
    zoom: `<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/>`,
  };

  private updateAspectRatioIcon(): void {
    const icon = this.shadowRoot?.querySelector(".movi-icon-aspect-ratio") as SVGElement;
    if (!icon) return;

    const fit = this._objectFit === "control" ? this._currentFit : (this._objectFit as any);
    const svg = MoviElement.ASPECT_ICONS[fit] || MoviElement.ASPECT_ICONS.contain;
    icon.innerHTML = svg;
  }

  private static readonly TRACK_ICON_AUDIO = `<svg class="movi-track-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  private static readonly TRACK_ICON_SUBTITLE = `<svg class="movi-track-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" ry="2"/><path d="M10 8.5H8a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2 M18 8.5h-2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2"/></svg>`;
  private static readonly TRACK_ICON_OFF = `<svg class="movi-track-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="6" y1="12" x2="18" y2="12"/></svg>`;
  private static readonly TRACK_ICON_CHECK = `<svg class="movi-track-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  private formatAudioBadge(track: AudioTrack): string {
    const codec = (track.codec || "").toUpperCase();
    const lang = track.language
      ? track.language.length >= 2
        ? track.language.substring(0, 3).toUpperCase()
        : track.language.toUpperCase()
      : "";

    let main = "";
    if (track.channels) {
      const layout =
        track.channels === 1
          ? "Mono"
          : track.channels === 2
            ? "Stereo"
            : track.channels === 6
              ? "5.1"
              : track.channels === 8
                ? "7.1"
                : `${track.channels}ch`;
      main = codec ? `${codec} ${layout}` : layout;
    } else {
      main = codec;
    }

    if (lang && main) return `${lang} • ${main}`;
    return main || lang;
  }

  private formatSubtitleBadge(track: SubtitleTrack): string {
    const parts: string[] = [];
    if (track.language) {
      const lang = track.language.length >= 2
        ? track.language.substring(0, 3).toUpperCase()
        : track.language.toUpperCase();
      parts.push(lang);
    }
    if (track.subtitleType) {
      parts.push(track.subtitleType === "image" ? "Image" : "Text");
    }
    return parts.join(" • ");
  }

  private updateAudioTrackMenu(): void {
    if (!this.player) return;

    const audioTrackList = this.shadowRoot?.querySelector(
      ".movi-audio-track-list",
    ) as HTMLElement;
    const audioTrackBtn = this.shadowRoot?.querySelector(
      ".movi-audio-track-btn",
    ) as HTMLElement;
    const audioTrackContainer = this.shadowRoot?.querySelector(
      ".movi-audio-track-container",
    ) as HTMLElement;
    if (!audioTrackList || !audioTrackBtn || !audioTrackContainer) return;

    const nativeLangs = this.player.getAudioLangs();
    const audioTracks = this.player.getAudioTracks();
    const activeTrack = this.player.trackManager.getActiveAudioTrack();
    const isNativeActive = this.player.isNativeAudioActive();
    const totalTracks = audioTracks.length + nativeLangs.length;

    // Volume is always visible when any audio exists (muxed, multi-lang
    // native, single split-source <audio>, or HLS stream).
    const hasAudio = this.player.hasAudibleSource();
    const volumeContainer = this.shadowRoot?.querySelector(
      ".movi-volume-container",
    ) as HTMLElement;
    if (volumeContainer) {
      volumeContainer.style.display = hasAudio ? "flex" : "none";
    }
    // Same reasoning for the "Tap to unmute" pill — if the source has
    // no audio at all, there's nothing to unmute, so don't bait the
    // user into clicking it. Refresh whenever audio-track discovery
    // finishes (this method is the natural hook).
    this.updateUnmuteOverlay();

    // Show audio selector only if multiple tracks total
    if (totalTracks <= 1) {
      audioTrackContainer.style.display = "none";
      return;
    }

    audioTrackContainer.style.display = "flex";
    audioTrackBtn.style.display = "flex";

    // Build combined menu — muxed tracks first, then external
    let menuHTML = "";

    const ICON = MoviElement.TRACK_ICON_AUDIO;
    const CHECK = MoviElement.TRACK_ICON_CHECK;

    // Muxed audio tracks (from MKV/MP4 demuxer)
    menuHTML += audioTracks
      .map((track) => {
        // Muxed track is active only when native audio is NOT active
        const isActive = !isNativeActive && activeTrack?.id === track.id;
        const label = track.label || `Audio ${track.id}`;
        const badge = this.formatAudioBadge(track);

        return `
        <div class="movi-audio-track-item ${isActive ? "movi-audio-track-active" : ""}"
             data-track-id="${track.id}">
          ${ICON}
          <span class="movi-audio-track-label">${label}</span>
          ${badge ? `<span class="movi-audio-track-info">${badge}</span>` : ""}
          ${CHECK}
        </div>`;
      })
      .join("");

    // External audio tracks (native <audio> element)
    menuHTML += nativeLangs
      .map((t) => `
        <div class="movi-audio-track-item ${t.active ? "movi-audio-track-active" : ""}"
             data-audio-lang="${t.lang}">
          ${ICON}
          <span class="movi-audio-track-label">${t.label}</span>
          <span class="movi-audio-track-info">${t.lang.toUpperCase()}</span>
          ${CHECK}
        </div>`)
      .join("");

    audioTrackList.innerHTML = menuHTML;

    // Footer count
    const audioFooter = this.shadowRoot?.querySelector(
      ".movi-audio-track-footer",
    ) as HTMLElement | null;
    if (audioFooter) {
      audioFooter.textContent =
        totalTracks === 1
          ? "1 audio track available"
          : `${totalTracks} audio tracks available`;
    }

    // Add click handlers
    audioTrackList
      .querySelectorAll(".movi-audio-track-item")
      .forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const el = item as HTMLElement;
          const lang = el.dataset.audioLang;
          const trackIdStr = el.dataset.trackId;

          if (this.player) {
            const audioIcon = OSD.audio;
            if (lang) {
              // External audio track — switch to native <audio>
              this.player.selectAudioLang(lang);
              const t = this.player.getAudioLangs().find(a => a.lang === lang);
              const extAudioOsd = t ? `${t.label} [${lang.toUpperCase()}]` : lang.toUpperCase();
              this.showOSD(audioIcon, extAudioOsd);
            } else if (trackIdStr) {
              // Muxed audio track — switch back to WASM if needed
              if (this.player.isNativeAudioActive()) {
                this.player.useMuxedAudio();
              }
              const tid = parseInt(trackIdStr);
              this.player.selectAudioTrack(tid);
              const trk = this.player.getAudioTracks().find(a => a.id === tid);
              const muxAudioLang = trk?.language?.toUpperCase() || "";
              const muxAudioLabel = trk?.label || muxAudioLang || `Audio ${tid}`;
              const muxAudioOsd = muxAudioLang && muxAudioLabel !== muxAudioLang ? `${muxAudioLabel} [${muxAudioLang}]` : muxAudioLabel;
              this.showOSD(audioIcon, muxAudioOsd);
            }
            this.updateAudioTrackMenu();
            const menu = this.shadowRoot?.querySelector(
              ".movi-audio-track-menu",
            ) as HTMLElement;
            // Close via setBottomMenuOpen, NOT display:none directly. Setting
            // display:none leaves the `is-open` class on the menu, so
            // isBottomMenuOpen()/isAnyMenuOpen() stay true FOREVER — every later
            // showControls() then no-ops and the controls auto-hide never
            // re-arms again (not just for audio, but for any subsequent menu or
            // playback). setBottomMenuOpen(false) removes is-open and re-arms
            // the auto-hide once the exit transition finishes.
            this.setBottomMenuOpen(menu, false);
          }
        });
      });
  }

  /*
   * Update quality menu based on current tracks
   */
  private updateQualityMenu(): void {
    if (!this.player) return;

    const qualityList = this.shadowRoot?.querySelector(
      ".movi-quality-list",
    ) as HTMLElement;
    const qualityBtn = this.shadowRoot?.querySelector(
      ".movi-quality-btn",
    ) as HTMLElement;
    const qualityContainer = this.shadowRoot?.querySelector(
      ".movi-quality-container",
    ) as HTMLElement;

    if (!qualityList || !qualityBtn || !qualityContainer) return;

    // Only show the quality menu for adaptive streams (HLS .m3u8 / DASH .mpd).
    // Local files or single-file URLs should not show quality selection.
    const isAdaptive =
      typeof this._src === "string" &&
      (this._src.toLowerCase().includes(".m3u8") ||
        this._src.toLowerCase().includes(".mpd"));

    // Pre-muxed multi-quality path: build a virtual track list from the
    // declarative <source> tags so the picker works without an adaptive stream.
    if (!isAdaptive && this._videoQualities.length > 1) {
      this.renderPremuxedQualityMenu(
        qualityList,
        qualityContainer,
      );
      return;
    }

    if (!isAdaptive) {
      qualityContainer.style.display = "none";
      return;
    }

    if (typeof (this.player as any).getVideoTracks !== "function") {
      qualityContainer.style.display = "none";
      return;
    }

    const tracks = (this.player as any).getVideoTracks() as VideoTrack[];

    // Log tracks for debugging
    Logger.debug(
      TAG,
      `Quality Menu: Found ${tracks ? tracks.length : 0} tracks`,
      tracks,
    );

    if (!tracks || tracks.length <= 1) {
      Logger.debug(TAG, "Quality Menu: Hiding (tracks <= 1)");
      qualityContainer.style.display = "none";
      return;
    }

    // Filter out invalid tracks (e.g. audio-only HLS levels surface as 0×0
    // entries which render as "0p" — useless to expose to the user)
    const validTracks = tracks.filter(
      (t) => t.id === -1 || (t.height && t.height > 0),
    );

    // Sort tracks: Auto (-1) first, then by resolution descending, then by bitrate descending
    const sortedTracks = [...validTracks].sort((a, b) => {
      if (a.id === -1) return -1;
      if (b.id === -1) return 1;
      const heightDiff = (b.height || 0) - (a.height || 0);
      if (heightDiff !== 0) return heightDiff;
      return (b.bitRate || 0) - (a.bitRate || 0);
    });

    // Deduplicate tracks by label (e.g. "720p")
    const uniqueTracks: VideoTrack[] = [];
    const seenLabels = new Set<string>();

    sortedTracks.forEach((track) => {
      // Always include Auto
      if (track.id === -1) {
        if (!seenLabels.has("Auto")) {
          seenLabels.add("Auto");
          uniqueTracks.push(track);
        }
        return;
      }

      const label = track.label || (track.height ? `${track.height}p` : "Auto");
      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        uniqueTracks.push(track);
      }
    });

    // Check visibility threshold
    // We need at least 2 unique items to offer a choice (e.g. Auto + 720p)
    // If we only have Auto + one quality, and Auto just picks that quality, is it worth showing?
    // standard behavior is: yes, show it so user can see what quality is playing or lock it.

    Logger.debug(TAG, `Quality Menu: Unique tracks: ${uniqueTracks.length}`);

    if (uniqueTracks.length < 2) {
      Logger.debug(TAG, "Quality Menu: Hiding (unique tracks < 2)");
      qualityContainer.style.display = "none";
      return;
    }

    qualityContainer.style.display = "flex";

    const activeTrack = (
      this.player as any
    ).trackManager?.getActiveVideoTrack();

    // In Auto/ABR mode the active track id is -1 with height 0; surface the
    // currently-playing rendition's dimensions instead so the gear badge stays
    // informative. Shaka backs both HLS and DASH via the unified streamWrapper.
    let activeHeight = activeTrack?.height || 0;
    let activeWidth = (activeTrack as any)?.width || 0;
    if (!activeHeight && activeTrack?.id === -1) {
      try {
        const res = (this.player as any).streamWrapper?.getActiveResolution?.();
        activeHeight = res?.height || 0;
        activeWidth = res?.width || 0;
      } catch {}
    }
    this._updateQualityBtnBadge(this._heightBadge(activeHeight, activeWidth));

    qualityList.innerHTML = uniqueTracks
      .map((track) => {
        const isActive = activeTrack?.id === track.id;
        let label =
          track.label || (track.height ? `${track.height}p` : "Auto");
        // In Auto mode, show the currently-playing rendition in brackets —
        // e.g. "Auto (720p)" — so the user sees what ABR is actually serving.
        if (track.id === -1 && activeTrack?.id === -1 && activeHeight > 0) {
          label = `Auto (${activeHeight}p)`;
        }
        const h = track.height || 0;
        const w = (track as any).width || 0;
        const eff = w > 0 ? Math.max(h, Math.round(w * 9 / 16)) : h;
        let badge = "";
        if (eff >= 4320) badge = "8K";
        else if (eff >= 2160) badge = "4K";
        else if (eff >= 1080) badge = "HD";
        const badgeHtml = badge
          ? `<span class="movi-quality-badge movi-quality-badge-${badge.toLowerCase()}">${badge}</span>`
          : "";

        return `
         <div class="movi-quality-item ${isActive ? "movi-quality-active" : ""}" data-track-id="${track.id}">
            <span class="movi-quality-label-wrap">
              <span class="movi-quality-label">${label}</span>
              ${badgeHtml}
            </span>
            ${
              isActive
                ? `
            <svg class="movi-quality-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>`
                : ""
            }
         </div>
       `;
      })
      .join("");

    qualityList.querySelectorAll(".movi-quality-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const trackId = parseInt((item as HTMLElement).dataset.trackId || "-1");
        if (
          this.player &&
          (this.player as any).trackManager &&
          typeof (this.player as any).trackManager.selectVideoTrack ===
            "function"
        ) {
          (this.player as any).trackManager.selectVideoTrack(trackId);
          this.updateQualityMenu(); // Update menu after selection to show checkmark
          const menu = this.shadowRoot?.querySelector(
            ".movi-quality-menu",
          ) as HTMLElement;
          if (menu) menu.style.display = "none";
          this.updateQualityMenu();
          this.dispatchEvent(new CustomEvent("qualitychange", { detail: { trackId } }));
        }
      });
    });
  }

  /**
   * Map a video height to its YouTube-style quality badge (HD/4K/8K) or
   * empty string when the resolution doesn't qualify.
   */
  private _heightBadge(height: number, width: number = 0): string {
    // Use the 16:9-normalised height when a width is known so ultrawide /
    // letterboxed tracks (e.g. 3840×2080) still tier as 4K rather than HD.
    const eff = width > 0 ? Math.max(height, Math.round(width * 9 / 16)) : height;
    if (eff >= 4320) return "8K";
    if (eff >= 2160) return "4K";
    if (eff >= 1080) return "HD";
    return "";
  }

  /**
   * Paint or hide the small badge pill on the gear button itself so the
   * user can see the active quality tier at a glance — same convention
   * as YouTube's player.
   */
  private _updateQualityBtnBadge(badge: string): void {
    const el = this.shadowRoot?.querySelector(
      ".movi-quality-btn-badge",
    ) as HTMLElement | null;
    if (!el) return;
    if (badge) {
      el.textContent = badge;
      el.className = `movi-quality-btn-badge movi-quality-badge-${badge.toLowerCase()}`;
      el.style.display = "inline-flex";
    } else {
      el.textContent = "";
      el.style.display = "none";
    }
  }

  /**
   * Render a quality menu for pre-muxed multi-source MP4s (no HLS manifest).
   * Driven by the cached `_videoQualities` list; switching just swaps the
   * active <source> URL and lets the existing src-change pipeline reload
   * the player while preserving currentTime / paused state.
   */
  private renderPremuxedQualityMenu(
    qualityList: HTMLElement,
    qualityContainer: HTMLElement,
  ): void {
    qualityContainer.style.display = "flex";

    const activeSrc = typeof this._src === "string" ? this._src : "";
    const activeQuality = this._videoQualities.find((q) => q.src === activeSrc);
    this._updateQualityBtnBadge(activeQuality?.badge || this._heightBadge(activeQuality?.height || 0));

    qualityList.innerHTML = this._videoQualities
      .map((q) => {
        const isActive = q.src === activeSrc;
        // Label may already include the fps suffix (e.g. "1080p60"). Only
        // append fps if it isn't already present in the label.
        const fpsSuffix =
          q.fps && q.fps > 30 && !new RegExp(`${q.fps}$`).test(q.label)
            ? q.fps
            : "";
        const label = `${q.label}${fpsSuffix}`;
        const badgeHtml = q.badge
          ? `<span class="movi-quality-badge movi-quality-badge-${q.badge.toLowerCase()}">${q.badge}</span>`
          : "";
        return `
          <div class="movi-quality-item ${isActive ? "movi-quality-active" : ""}" data-src="${q.src.replace(/"/g, "&quot;")}">
            <span class="movi-quality-label-wrap">
              <span class="movi-quality-label">${label}</span>
              ${badgeHtml}
            </span>
            ${
              isActive
                ? `<svg class="movi-quality-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    qualityList.querySelectorAll(".movi-quality-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const newSrc = (item as HTMLElement).dataset.src;
        if (!newSrc || newSrc === activeSrc) return;
        this.switchPremuxedQuality(newSrc);

        const menu = this.shadowRoot?.querySelector(
          ".movi-quality-menu",
        ) as HTMLElement;
        if (menu) menu.style.display = "none";
      });
    });
  }

  // Audio element preserved across a quality switch. Re-adopted by the new
  // MoviPlayer instance so its already-activated play() context survives —
  // creating a fresh <audio> from scratch would be blocked by autoplay
  // policy because the user-gesture token doesn't propagate across the
  // async destroy → init pipeline.
  private _carryAudioEl: HTMLAudioElement | null = null;

  // True between the start of a quality switch and the moment the new
  // player resumes playback. Suppresses the poster overlay so the user
  // sees a frozen last-frame instead of the static thumbnail flashing in.
  private _qualitySwitchInProgress: boolean = false;
  // Pre-switch playback position. Used as a fallback while the new player
  // is initialising so the time-display doesn't flash 00:00.
  private _switchResumeTime: number = 0;
  // Pre-switch total duration. Cached for the same reason — duration is
  // identical across quality variants, but the new player's mediaInfo
  // isn't populated until the demuxer opens.
  private _switchResumeDuration: number = 0;

  /**
   * Swap the active video source and resume playback at the same position.
   * The src setter pipeline tears down the player; we re-seek once metadata
   * is available on the new instance.
   */
  private switchPremuxedQuality(newSrc: string): void {
    const wasPaused = this.player ? (this.player as any).getState?.() === "paused" : true;
    let resumeTime = 0;
    try {
      resumeTime = this.player ? (this.player as any).getCurrentTime?.() || 0 : 0;
    } catch {}

    const target = this._videoQualities.find((q) => q.src === newSrc);

    // Detach the currently-playing native audio element so it survives the
    // teardown unmolested, then re-adopt it on the next player instance.
    try {
      this._carryAudioEl =
        (this.player as any)?.releaseNativeAudio?.() || null;
    } catch {
      this._carryAudioEl = null;
    }

    // Mark in-flight so the src attribute change doesn't re-paint the poster
    // overlay (which would flash the thumbnail in over the last video frame).
    this._qualitySwitchInProgress = true;
    this._switchResumeTime = resumeTime;
    try {
      this._switchResumeDuration = this.player ? (this.player as any).getDuration?.() || 0 : 0;
    } catch {
      this._switchResumeDuration = 0;
    }

    // Snapshot the current canvas frame and pin it as the poster overlay so
    // the user sees a frozen last-frame instead of black during the swap.
    // The WebGL context gets recreated on player teardown which wipes the
    // canvas; the snapshot bridges that gap until the new instance starts
    // pushing frames again.
    try {
      const snapshot = this.canvas?.toDataURL?.("image/jpeg", 0.85);
      if (snapshot && snapshot.length > 32) {
        this._lastFrameSnapshot = snapshot;
        this._showSnapshotPoster();
      }
    } catch {
      // tainted canvas — fall back to plain blank during switch
    }

    // Safety net: if the new player never reaches "playing" (e.g. autoplay
    // blocked AND user never resumes), make sure we don't leave the poster
    // permanently suppressed.
    setTimeout(() => {
      if (this._qualitySwitchInProgress) {
        this._qualitySwitchInProgress = false;
        this._switchResumeTime = 0;
        this._switchResumeDuration = 0;
        this._hideSnapshotPoster();
        this.updatePoster();
      }
    }, 8000);

    // Setting the attribute funnels through the existing observedAttributes
    // path which destroys the player and reinitialises with the new src.
    this._suppressSwReload = true;
    this.setAttribute("src", newSrc);

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      try {
        if (resumeTime > 0 && this.player) {
          (this.player as any).seek?.(resumeTime);
        }
        if (wasPaused) {
          (this.player as any)?.pause?.();
        } else {
          // Explicit play() from within the user-gesture event chain.
          // The default autoplay path attempts play() too, but its async
          // distance from the gear-click can exceed the browser's user
          // activation window — causing the freshly-created native <audio>
          // element to be blocked. Calling play() here keeps the activation
          // alive long enough for the audio element to start.
          Promise.resolve().then(() => {
            (this.player as any)?.play?.().catch(() => {});
          });
        }
      } catch {}
      this.removeEventListener("loadeddata", restore);
      this.removeEventListener("canplay", restore);
      this.removeEventListener("durationchange", restore);
    };
    // Different player wrappers fire different events first — listen to the
    // earliest signals that the new instance is ready to seek.
    this.addEventListener("loadeddata", restore);
    this.addEventListener("canplay", restore);
    this.addEventListener("durationchange", restore);
    // Hard-fallback in case none of the events bubble up to the host element
    // (e.g. when the wrapper proxies events differently): poll for readiness.
    if (resumeTime > 0) {
      const start = Date.now();
      const poll = () => {
        if (restored) return;
        try {
          const dur = (this.player as any)?.getDuration?.() || 0;
          if (dur > 0) {
            restore();
            return;
          }
        } catch {}
        if (Date.now() - start < 5000) {
          requestAnimationFrame(poll);
        }
      };
      requestAnimationFrame(poll);
    }

    this.dispatchEvent(
      new CustomEvent("qualitychange", {
        detail: {
          src: newSrc,
          height: target?.height || 0,
          label: target?.label || "",
          fps: target?.fps || null,
        },
      }),
    );

    // Re-render the menu shortly after so the active checkmark moves
    setTimeout(() => this.updateQualityMenu(), 0);
  }

  /*
   * Maximum playback rate the current source can sustain. All sources allow
   * the full 2x — the previous 8K+ cap has been removed.
   */
  private getMaxAllowedRate(): number {
    return 2;
  }

  /** Volume ceiling: 200% normally (boost via AudioContext gain), but 100% when
   *  audio plays through a native element (adaptive stream / native split-source)
   *  which can't boost — so the UI doesn't promise a boost that won't happen. */
  private getMaxVolume(): number {
    return this.player?.usesNativeAudio?.() ? 1 : 2;
  }

  /** Re-apply the volume ceiling to the slider + current volume when the audio
   *  path changes (source load, audio-track switch between muxed and native). */
  private updateVolumeCap(): void {
    const max = this.getMaxVolume();
    const slider = this.shadowRoot?.querySelector(
      ".movi-volume-slider",
    ) as HTMLInputElement | null;
    if (slider) {
      slider.max = String(max);
      slider.setAttribute("aria-valuemax", String(max * 100));
    }
    // Clamp a boosted volume back down when switching to a native (no-boost) path.
    if (this._volume > max) this.volume = max;
    else this.updateVolume();
  }

  /**
   * Start sampling render health once per second to detect sustained stutter
   * (decoder can't keep up above 1x on a heavy source → dropped video frames,
   * smooth audio). Runs only during active playback; cheap (reads a couple of
   * numbers). Idempotent.
   */
  private startStutterMonitor(): void {
    if (this._stutterInterval !== null) return;
    const h = this.player?.getRenderHealth?.();
    this._stutterLastPresented = h ? h.framesPresented : 0;
    this._stutterSeconds = 0;
    this._stutterInterval = window.setInterval(() => this.sampleStutter(), 1000);
  }

  private stopStutterMonitor(): void {
    if (this._stutterInterval !== null) {
      clearInterval(this._stutterInterval);
      this._stutterInterval = null;
    }
    this._stutterSeconds = 0;
  }

  /**
   * Clear the stutter-hint cooldown so the "play at 1x" warning can fire again.
   * Called on every playback-rate change — each new speed the user picks gets a
   * fresh chance to warn if it stutters (instead of showing only once per
   * source). The 3-second sustained requirement still prevents instant spam.
   */
  private resetStutterHint(): void {
    this._stutterSeconds = 0;
    this._stutterCooldown = false;
    if (this._stutterCooldownTimer !== null) {
      clearTimeout(this._stutterCooldownTimer);
      this._stutterCooldownTimer = null;
    }
  }

  /** One stutter sample: compare presented FPS to the smooth-playback baseline. */
  private sampleStutter(): void {
    // Only judge during genuine playback — buffering/seeking legitimately
    // present few/no frames and would false-positive.
    if (this.player?.getState?.() !== "playing") {
      this._stutterSeconds = 0;
      return;
    }
    const h = this.player?.getRenderHealth?.();
    if (!h) return;
    const presented = h.framesPresented - this._stutterLastPresented;
    this._stutterLastPresented = h.framesPresented;
    // framesPresented resets to 0 on seek → negative delta; skip that sample.
    if (presented < 0) {
      this._stutterSeconds = 0;
      return;
    }
    // Only meaningful above 1x — at ≤1x there's nothing slower to suggest.
    // Smooth playback presents ~min(60, sourceFps × rate) distinct frames/s
    // (display-capped); sustained < 60% of that means the decoder is dropping a
    // lot of frames. Profile-agnostic: works for any heavy source (4K/8K,
    // high-bitrate, software decode) that can't keep up above 1x.
    const expected = Math.min(60, h.sourceFps * this._playbackRate);
    if (this._playbackRate > 1 && presented < expected * 0.6) {
      this._stutterSeconds++;
    } else {
      this._stutterSeconds = 0;
    }
    if (this._stutterSeconds >= 3 && !this._stutterCooldown) {
      this._stutterSeconds = 0;
      this._stutterCooldown = true;
      // Cooldown so it doesn't nag while stuttering at the SAME rate; a rate
      // change (resetStutterHint) lifts it early so each new speed can warn.
      if (this._stutterCooldownTimer !== null) {
        clearTimeout(this._stutterCooldownTimer);
      }
      this._stutterCooldownTimer = window.setTimeout(() => {
        this._stutterCooldown = false;
        this._stutterCooldownTimer = null;
      }, 45000);
      this.showOSD(OSD.speed, "Play at 1x for smoother playback");
    }
  }

  /**
   * Show On-Screen Display (OSD) notification
   */
  private osdTimeout: number | null = null;

  private showOSD(icon: string, text: string): void {
    const osdContainer = this.shadowRoot?.querySelector(
      ".movi-osd-container",
    ) as HTMLElement;
    const osdIcon = this.shadowRoot?.querySelector(
      ".movi-osd-icon",
    ) as HTMLElement;
    const osdText = this.shadowRoot?.querySelector(
      ".movi-osd-text",
    ) as HTMLElement;

    // Don't show OSD if controls are disabled
    if (!this._controls) return;

    if (!osdContainer || !osdIcon || !osdText) return;

    osdIcon.innerHTML = icon;
    osdText.textContent = text;

    // Clear existing timeout
    if (this.osdTimeout) {
      clearTimeout(this.osdTimeout);
      this.osdTimeout = null;
    }

    // Show and animate
    osdContainer.style.display = "flex";
    // Force reflow
    void osdContainer.offsetWidth;
    osdContainer.classList.add("visible");

    this.osdTimeout = window.setTimeout(() => {
      osdContainer.classList.remove("visible");

      // Reset seek counter once OSD is hidden
      this.cumulativeSeekAmount = 0;
      this.lastSeekSide = null;
      this._seekChainTarget = null;

      setTimeout(() => {
        if (!osdContainer.classList.contains("visible")) {
          osdContainer.style.display = "none";
        }
      }, 300); // Wait for fade out
    }, 2000);
  }

  // ── Subtitle appearance customization ──────────────────────────────
  // YouTube-style settings panel. Settings are persisted under
  // localStorage["movi.subtitleSettings"] and pushed onto the host
  // element as CSS variables (--movi-sub-size-mult, --movi-sub-color,
  // --movi-sub-bg-alpha, --movi-sub-edge) which the subtitle styles
  // in the shadow DOM consume.

  private static readonly SUBTITLE_SETTINGS_STORAGE_KEY = "movi.subtitleSettings";

  /**
   * Returns the kind of subtitle currently active so the customize
   * panel can show only the options that apply.
   *
   *   - "vtt"   → WebVTT (karaoke-paced from YouTube proxy etc): all
   *               text styling options apply, INCLUDING the backdrop.
   *   - "text"  → SRT/ASS/SSA/TTML or muxed text subs: size/color/edge
   *               and shift apply; backdrop doesn't (it's gated to VTT
   *               in CSS).
   *   - "image" → PGS/DVD/DVB or other muxed image subs: only the
   *               subtitle-shift control applies; styling is baked
   *               into the bitmap.
   *   - null    → no subtitle selected → no customize gear shown.
   */
  private resolveExternalSubtitleId(sub: {
    src: string;
    id?: string;
  }): string {
    return sub.id ?? sub.src;
  }

  private getActiveSubtitleKind(): "vtt" | "text" | "image" | null {
    if (!this.player) return null;
    // External (declared via <track> children) — has a `format` hint.
    const ext = this.player.getSubtitleLangs().find((t) => t.active);
    if (ext) {
      const meta = this._subtitleTracks.find(
        (t) => this.resolveExternalSubtitleId(t) === ext.id,
      );
      const fmt = (meta?.format || "").toLowerCase();
      return fmt === "vtt" ? "vtt" : "text";
    }
    // Muxed — SubtitleTrack carries `subtitleType` ("text" | "image").
    const mux = this.player.trackManager.getActiveSubtitleTrack();
    if (mux) {
      return mux.subtitleType === "image" ? "image" : "text";
    }
    return null;
  }

  private static readonly SUBTITLE_EDGE_STYLES: Record<
    "none" | "shadow" | "outline" | "raised",
    string
  > = {
    none: "none",
    shadow: "0 0 4px rgba(0, 0, 0, 0.85)",
    outline:
      "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 2px rgba(0,0,0,0.9)",
    raised:
      "1px 1px 0 rgba(255,255,255,0.35), 2px 2px 4px rgba(0,0,0,0.85)",
  };

  private static readonly SUBTITLE_COLOR_PALETTE: {
    label: string;
    value: string;
  }[] = [
    { label: "White", value: "#FFFFFF" },
    { label: "Yellow", value: "#FFEB3B" },
    { label: "Green", value: "#69F0AE" },
    { label: "Cyan", value: "#80DEEA" },
    { label: "Blue", value: "#82B1FF" },
    { label: "Magenta", value: "#FF80AB" },
    { label: "Red", value: "#FF5252" },
    { label: "Black", value: "#000000" },
  ];

  private loadSubtitleSettings(): void {
    try {
      const raw = localStorage.getItem(
        MoviElement.SUBTITLE_SETTINGS_STORAGE_KEY,
      );
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.sizeMult === "number" && parsed.sizeMult > 0) {
          this._subtitleSettings.sizeMult = parsed.sizeMult;
        }
        if (typeof parsed.color === "string") {
          this._subtitleSettings.color = parsed.color;
        }
        if (typeof parsed.bgAlpha === "number") {
          this._subtitleSettings.bgAlpha = Math.min(
            1,
            Math.max(0, parsed.bgAlpha),
          );
        }
        if (
          parsed.edge === "none" ||
          parsed.edge === "shadow" ||
          parsed.edge === "outline" ||
          parsed.edge === "raised"
        ) {
          this._subtitleSettings.edge = parsed.edge;
        }
      }
    } catch {
      /* ignore — fall back to defaults */
    }
  }

  private saveSubtitleSettings(): void {
    try {
      localStorage.setItem(
        MoviElement.SUBTITLE_SETTINGS_STORAGE_KEY,
        JSON.stringify(this._subtitleSettings),
      );
    } catch {
      /* localStorage may be disabled — apply still works */
    }
  }

  private applySubtitleSettings(): void {
    const s = this._subtitleSettings;
    this.style.setProperty("--movi-sub-size-mult", String(s.sizeMult));
    this.style.setProperty("--movi-sub-color", s.color);
    this.style.setProperty("--movi-sub-bg-alpha", String(s.bgAlpha));
    this.style.setProperty(
      "--movi-sub-bg-rgb",
      MoviElement.contrastBackdropRgb(s.color),
    );
    this.style.setProperty(
      "--movi-sub-edge",
      MoviElement.SUBTITLE_EDGE_STYLES[s.edge],
    );
  }

  /**
   * Apply one of the public subtitle-customize attributes onto
   * _subtitleSettings. Returns true if the attribute name matched
   * (caller can decide whether to call applySubtitleSettings()).
   *
   *   subtitlesize="150"      (50–200, treated as %; also accepts 1.5)
   *   subtitlecolor="#FFEB3B" (any CSS color hex, 3 or 6 digits)
   *   subtitlebg="50"         (0–100, treated as %; also accepts 0.5)
   *   subtitleedge="outline"  (none | shadow | outline | raised)
   */
  private applySubtitleAttribute(name: string, raw: string | null): boolean {
    const s = this._subtitleSettings;
    switch (name) {
      case "subtitlesize": {
        if (raw === null) return true; // attribute removed → keep current
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) return true;
        // > 5 → percentage (e.g. 150). Else treat as multiplier (1.5).
        s.sizeMult = parsed > 5 ? parsed / 100 : parsed;
        return true;
      }
      case "subtitlecolor": {
        if (raw === null) return true;
        const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
        if (m) s.color = raw.trim();
        return true;
      }
      case "subtitlebg": {
        if (raw === null) return true;
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed)) return true;
        // > 1 → percentage (e.g. 75). Else treat as 0–1 alpha.
        s.bgAlpha = Math.max(0, Math.min(1, parsed > 1 ? parsed / 100 : parsed));
        return true;
      }
      case "subtitleedge": {
        if (raw === null) return true;
        const v = raw.trim().toLowerCase();
        if (v === "none" || v === "shadow" || v === "outline" || v === "raised") {
          s.edge = v;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Pick a backdrop RGB that contrasts with the text color so the cue
   * stays readable regardless of the user's color choice. Dark text on
   * dark backdrop (or vice versa) would render the subtitle invisible.
   */
  private static contrastBackdropRgb(color: string): string {
    const m = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
    if (!m) return "8, 8, 8";
    let h = m[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    if (h.length !== 6) return "8, 8, 8";
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    // Perceived (Rec. 601) luminance — 0..1
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Dark text → light backdrop; otherwise dark backdrop.
    return lum < 0.5 ? "245, 245, 245" : "8, 8, 8";
  }

  private renderSubtitleCustomizePanel(): string {
    const s = this._subtitleSettings;
    const kind = this.getActiveSubtitleKind();
    const showText = kind === "vtt" || kind === "text"; // color/edge
    // Font size applies to image subs too — the renderer multiplies the
    // bitmap's uniformScale by --movi-sub-size-mult, so PGS/VOBSUB respect
    // the same slider that resizes text/vtt cues.
    const showSize = kind !== null;
    const showBackdrop = kind === "vtt"; // backdrop only paints for VTT
    // Subtitle delay only makes sense on file sources — streamed sources
    // don't expose the timing surface this control nudges.
    const showShift = kind !== null && !!this.player?.isFileSource();
    const currentDelay = this.player ? this.player.getSubtitleDelay() : 0;

    const edges: {
      label: string;
      value: "none" | "shadow" | "outline" | "raised";
    }[] = [
      { label: "None", value: "none" },
      { label: "Shadow", value: "shadow" },
      { label: "Outline", value: "outline" },
      { label: "Raised", value: "raised" },
    ];

    // Live preview shows actual settings so the user sees every change
    // immediately. Uses the SAME CSS classes the real subtitles use,
    // so it matches the in-video output 1:1. The backdrop is only
    // painted for VTT — SRT and other text formats render plain in
    // the video too, so the preview must mirror that.
    const previewBgRgb = MoviElement.contrastBackdropRgb(s.color);
    const previewBlockBg =
      showBackdrop && s.bgAlpha > 0
        ? `background: rgba(${previewBgRgb}, ${s.bgAlpha});`
        : "background: transparent;";
    const previewLineStyle =
      `color: ${s.color};` +
      `font-size: calc(18px * ${s.sizeMult});` +
      `text-shadow: ${MoviElement.SUBTITLE_EDGE_STYLES[s.edge]};`;

    const colorSwatches = MoviElement.SUBTITLE_COLOR_PALETTE.map(
      (c) => `
      <button type="button"
              class="movi-sub-cust-swatch${c.value === s.color ? " is-active" : ""}"
              data-group="color"
              data-value="${c.value}"
              aria-label="${c.label}"
              title="${c.label}"
              style="--swatch:${c.value}"></button>
    `,
    ).join("");

    const edgeTiles = edges
      .map(
        (e) => `
      <button type="button"
              class="movi-sub-cust-edge-tile${e.value === s.edge ? " is-active" : ""}"
              data-group="edge"
              data-value="${e.value}">
        <span class="movi-sub-cust-edge-sample"
              style="text-shadow: ${MoviElement.SUBTITLE_EDGE_STYLES[e.value]};">Aa</span>
        <span class="movi-sub-cust-edge-name">${e.label}</span>
      </button>
    `,
      )
      .join("");

    const sizePct = Math.round(s.sizeMult * 100);
    const bgPct = Math.round(s.bgAlpha * 100);

    const fontSizeSection = showSize
      ? `
      <div class="movi-sub-cust-section">
        <div class="movi-sub-cust-section-head">
          <span class="movi-sub-cust-section-title">Font size</span>
          <span class="movi-sub-cust-section-value" data-readout="size">${sizePct}%</span>
        </div>
        <input type="range"
               class="movi-sub-cust-range"
               data-group="size"
               min="50" max="200" step="25"
               value="${sizePct}"
               aria-label="Font size">
      </div>`
      : "";

    const textColorSection = showText
      ? `
      <div class="movi-sub-cust-section">
        <div class="movi-sub-cust-section-head">
          <span class="movi-sub-cust-section-title">Text color</span>
        </div>
        <div class="movi-sub-cust-swatch-grid">
          ${colorSwatches}
        </div>
      </div>`
      : "";

    const backgroundSection = showBackdrop
      ? `
      <div class="movi-sub-cust-section">
        <div class="movi-sub-cust-section-head">
          <span class="movi-sub-cust-section-title">Background</span>
          <span class="movi-sub-cust-section-value" data-readout="bg">${bgPct}%</span>
        </div>
        <input type="range"
               class="movi-sub-cust-range"
               data-group="bg"
               min="0" max="100" step="25"
               value="${bgPct}"
               aria-label="Background opacity">
      </div>`
      : "";

    const edgeStyleSection = showText
      ? `
      <div class="movi-sub-cust-section">
        <div class="movi-sub-cust-section-head">
          <span class="movi-sub-cust-section-title">Edge style</span>
        </div>
        <div class="movi-sub-cust-edge-grid">
          ${edgeTiles}
        </div>
      </div>`
      : "";

    // Shift the cue timing forwards / backwards. VLC/mpv convention:
    // positive = subs appear LATER, negative = earlier. The number
    // field on the right accepts arbitrary entries (e.g. -1.7) for
    // sources where the preset ±0.1/±1 nudges aren't fine enough.
    const shiftSection = showShift
      ? `
      <div class="movi-sub-cust-section">
        <div class="movi-sub-cust-section-head">
          <span class="movi-sub-cust-section-title">Subtitle delay</span>
          <div class="movi-sub-cust-shift-input-wrap">
            <input type="number"
                   class="movi-sub-cust-shift-input"
                   data-readout="shift"
                   step="0.1" min="-300" max="300"
                   value="${currentDelay.toFixed(1)}"
                   aria-label="Subtitle delay in seconds">
            <span class="movi-sub-cust-shift-input-suffix">s</span>
          </div>
        </div>
        <div class="movi-sub-cust-shift-controls">
          <button type="button" class="movi-sub-cust-shift-btn" data-shift="-1" aria-label="Shift earlier by 1 s">−1s</button>
          <button type="button" class="movi-sub-cust-shift-btn" data-shift="-0.1" aria-label="Shift earlier by 0.1 s">−0.1s</button>
          <button type="button" class="movi-sub-cust-shift-btn movi-sub-cust-shift-zero" data-shift="zero" aria-label="Reset shift">0</button>
          <button type="button" class="movi-sub-cust-shift-btn" data-shift="0.1" aria-label="Shift later by 0.1 s">+0.1s</button>
          <button type="button" class="movi-sub-cust-shift-btn" data-shift="1" aria-label="Shift later by 1 s">+1s</button>
        </div>
      </div>`
      : "";

    // Empty-state: nothing to customize when no subtitle is active.
    if (kind === null) {
      return `
        <div class="movi-sub-cust-panel">
          <button type="button" class="movi-sub-cust-back" data-action="back" aria-label="Back to subtitles">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            <span>Back</span>
          </button>
          <div class="movi-sub-cust-empty">Select a subtitle track to customize.</div>
        </div>
      `;
    }

    return `
      <div class="movi-sub-cust-panel">
        <button type="button" class="movi-sub-cust-back" data-action="back" aria-label="Back to subtitles">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          <span>Back</span>
        </button>

        ${
          showText
            ? `
        <div class="movi-sub-cust-preview">
          <div class="movi-sub-cust-preview-stage">
            <div class="movi-sub-cust-preview-block" style="${previewBlockBg}">
              <div class="movi-sub-cust-preview-line" style="${previewLineStyle}">Sample subtitles</div>
            </div>
          </div>
        </div>`
            : ""
        }

        ${fontSizeSection}
        ${textColorSection}
        ${backgroundSection}
        ${edgeStyleSection}
        ${shiftSection}

        <div class="movi-sub-cust-footer">
          <button type="button" class="movi-sub-cust-reset" data-action="reset">Reset to default</button>
        </div>
      </div>
    `;
  }


  private wireSubtitleCustomizePanel(root: HTMLElement): void {
    // Update the preview, the live in-video subtitle, and persist —
    // without re-rendering the whole panel so a slider drag stays
    // smooth (no DOM rebuild on every input event).
    const refreshPreview = () => {
      const s = this._subtitleSettings;
      const block = root.querySelector<HTMLElement>(
        ".movi-sub-cust-preview-block",
      );
      const line = root.querySelector<HTMLElement>(
        ".movi-sub-cust-preview-line",
      );
      // Mirror the in-video CSS: backdrop only paints for VTT, so the
      // preview also goes transparent for SRT / other text formats.
      const previewShowsBackdrop = this.getActiveSubtitleKind() === "vtt";
      if (block) {
        const rgb = MoviElement.contrastBackdropRgb(s.color);
        block.style.background =
          previewShowsBackdrop && s.bgAlpha > 0
            ? `rgba(${rgb}, ${s.bgAlpha})`
            : "transparent";
      }
      if (line) {
        line.style.color = s.color;
        line.style.fontSize = `calc(18px * ${s.sizeMult})`;
        line.style.textShadow = MoviElement.SUBTITLE_EDGE_STYLES[s.edge];
      }
    };
    const refreshReadout = (group: "size" | "bg") => {
      const r = root.querySelector<HTMLElement>(
        `[data-readout="${group}"]`,
      );
      if (!r) return;
      r.textContent =
        group === "size"
          ? `${Math.round(this._subtitleSettings.sizeMult * 100)}%`
          : `${Math.round(this._subtitleSettings.bgAlpha * 100)}%`;
    };
    const persistAndApply = () => {
      this.saveSubtitleSettings();
      this.applySubtitleSettings();
    };

    // Range sliders — input fires continuously while dragging.
    root
      .querySelectorAll<HTMLInputElement>(".movi-sub-cust-range")
      .forEach((range) => {
        range.addEventListener("input", (e) => {
          e.stopPropagation();
          const group = range.dataset.group as "size" | "bg" | undefined;
          if (!group) return;
          const pct = parseFloat(range.value);
          if (group === "size") this._subtitleSettings.sizeMult = pct / 100;
          else this._subtitleSettings.bgAlpha = pct / 100;
          refreshReadout(group);
          refreshPreview();
          persistAndApply();
        });
      });

    // Color swatches.
    root
      .querySelectorAll<HTMLElement>(".movi-sub-cust-swatch")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const v = btn.dataset.value;
          if (!v) return;
          this._subtitleSettings.color = v;
          root
            .querySelectorAll(".movi-sub-cust-swatch")
            .forEach((el) => el.classList.remove("is-active"));
          btn.classList.add("is-active");
          refreshPreview();
          persistAndApply();
        });
      });

    // Edge style tiles.
    root
      .querySelectorAll<HTMLElement>(".movi-sub-cust-edge-tile")
      .forEach((tile) => {
        tile.addEventListener("click", (e) => {
          e.stopPropagation();
          const v = tile.dataset.value as
            | "none"
            | "shadow"
            | "outline"
            | "raised"
            | undefined;
          if (!v) return;
          this._subtitleSettings.edge = v;
          root
            .querySelectorAll(".movi-sub-cust-edge-tile")
            .forEach((el) => el.classList.remove("is-active"));
          tile.classList.add("is-active");
          refreshPreview();
          persistAndApply();
        });
      });

    // Back to subtitles list. The handler MUST run before the click bubbles
    // out — the document-level closeSubtitleMenuHandler will hide the whole
    // dropdown if it ever sees a click whose composedPath doesn't include
    // the menu, which can happen on this button alone because innerHTML is
    // about to replace the click target before bubbling completes (the
    // path captured at dispatch time is fine, but some browsers retarget).
    // stopImmediatePropagation + preventDefault belt-and-suspenders the
    // path; the explicit re-open guarantees the menu stays visible even
    // if some other listener slips through.
    const backBtn = root.querySelector<HTMLElement>(".movi-sub-cust-back");
    backBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();
      this._showingSubtitleCustomize = false;
      this.updateSubtitleTrackMenu();
      const menu = this.shadowRoot?.querySelector(
        ".movi-subtitle-track-menu",
      ) as HTMLElement | null;
      this.setBottomMenuOpen(menu, true);
    });

    // Subtitle shift (timing nudge). Preset buttons (±0.1s / ±1s / 0)
    // plus a number input for custom entry. Per-source state (lives on
    // the player, NOT in localStorage — drift is content-specific).
    const shiftInput = root.querySelector<HTMLInputElement>(
      'input[data-readout="shift"]',
    );
    const refreshShiftReadout = () => {
      if (!shiftInput || !this.player) return;
      const v = this.player.getSubtitleDelay();
      // Don't clobber the field while the user is typing in it.
      if (document.activeElement !== shiftInput) {
        shiftInput.value = v.toFixed(1);
      }
    };
    const applyShift = (next: number) => {
      if (!this.player) return;
      const clamped = Math.max(-300, Math.min(300, next));
      // Round to 1 decimal so consecutive nudges don't accumulate fp noise.
      const rounded = Math.round(clamped * 10) / 10;
      this.player.setSubtitleDelay(rounded);
      refreshShiftReadout();
      // If the transcript panel is showing, repaint its rows so the
      // displayed timestamps reflect the new delay (each row shows the
      // video time at which the cue actually appears, not the raw
      // stream time).
      const cuesPanel = this.shadowRoot?.querySelector(
        ".movi-cues-panel",
      ) as HTMLElement | null;
      if (cuesPanel && cuesPanel.style.display !== "none") {
        this.renderCuesPanel();
      }
    };
    root
      .querySelectorAll<HTMLElement>(".movi-sub-cust-shift-btn")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!this.player) return;
          const v = btn.dataset.shift;
          if (!v) return;
          if (v === "zero") applyShift(0);
          else {
            const delta = parseFloat(v);
            if (Number.isFinite(delta))
              applyShift(this.player.getSubtitleDelay() + delta);
          }
        });
      });
    if (shiftInput) {
      // Apply on Enter / blur so the user can type out a value without
      // every keystroke racing with re-formatting.
      const commit = () => {
        const parsed = parseFloat(shiftInput.value);
        if (Number.isFinite(parsed)) {
          applyShift(parsed);
          shiftInput.value = (
            this.player ? this.player.getSubtitleDelay() : 0
          ).toFixed(1);
        } else {
          // Restore last good value if the user typed garbage.
          shiftInput.value = (
            this.player ? this.player.getSubtitleDelay() : 0
          ).toFixed(1);
        }
      };
      shiftInput.addEventListener("keydown", (e) => {
        // Player has global key bindings (←/→ seek, Space play/pause,
        // ↑/↓ volume) — they must NOT fire while the user is typing
        // in this field. Stopping propagation keeps the key event
        // local to the input.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          shiftInput.blur(); // triggers commit via blur
        }
      });
      // Same shielding for keyup/keypress so capture-phase listeners
      // upstream don't pick the keys up either.
      shiftInput.addEventListener("keyup", (e) => e.stopPropagation());
      shiftInput.addEventListener("keypress", (e) => e.stopPropagation());
      shiftInput.addEventListener("blur", commit);
      // Stop the document-level close handler from eating focus events
      // that originate inside the field.
      shiftInput.addEventListener("click", (e) => e.stopPropagation());
    }

    // Reset.
    const resetBtn = root.querySelector<HTMLElement>(".movi-sub-cust-reset");
    resetBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._subtitleSettings = {
        sizeMult: 1,
        color: "#FFFFFF",
        bgAlpha: 0.75,
        edge: "shadow",
      };
      this.saveSubtitleSettings();
      this.applySubtitleSettings();
      this.updateSubtitleTrackMenu(); // full redraw — slider/swatch/tile state all need to flip
    });
  }

  private _showingSubtitleCustomize: boolean = false;

  // Cues browser state
  private _cuesPanelCues: { start: number; end: number; text: string }[] = [];
  private _cuesPanelFiltered: { start: number; end: number; text: string }[] = [];
  private _cuesPanelQuery: string = "";
  private _cuesPanelActiveIdx: number = -1;
  private _cuesPanelTimeUpdateUnsub: (() => void) | null = null;
  private _cuesPanelEscHandler: ((e: KeyboardEvent) => void) | null = null;

  private async openCuesPanel(): Promise<void> {
    const panel = this.shadowRoot?.querySelector(
      ".movi-cues-panel",
    ) as HTMLElement | null;
    const list = panel?.querySelector(
      ".movi-cues-list",
    ) as HTMLElement | null;
    const meta = panel?.querySelector(
      ".movi-cues-meta-count",
    ) as HTMLElement | null;
    const search = panel?.querySelector(
      ".movi-cues-search",
    ) as HTMLInputElement | null;
    if (!panel || !list || !this.player) return;

    panel.style.display = "flex";
    list.innerHTML = `<div class="movi-cues-empty">Loading…</div>`;
    if (meta) meta.textContent = "Scanning subtitle stream…";

    let cues: { start: number; end: number; text: string }[] = [];
    try {
      cues = await this.player.getAllSubtitleCues();
    } catch (err) {
      Logger.error(TAG, "Failed to load cues for browser", err);
    }

    // Panel may have been closed while we awaited — bail out cleanly.
    if (panel.style.display === "none") return;

    this._cuesPanelCues = cues;
    this._cuesPanelQuery = "";
    if (search) {
      search.value = "";
      // Wire input/keydown once per open — handlers reference the latest
      // _cuesPanelQuery via closure each time, so we replace listeners on
      // every open to avoid stacking.
      const newSearch = search.cloneNode(true) as HTMLInputElement;
      search.replaceWith(newSearch);
      newSearch.addEventListener("input", () => {
        this._cuesPanelQuery = newSearch.value;
        this.renderCuesPanel();
      });
      newSearch.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (newSearch.value.length > 0) {
            newSearch.value = "";
            this._cuesPanelQuery = "";
            this.renderCuesPanel();
            e.stopPropagation();
          }
        }
      });
      // Focus after rAF so the search field is ready to type into.
      requestAnimationFrame(() => newSearch.focus());
    }

    // Delegated click on list rows — survives re-renders since we listen
    // on the static list element itself.
    list.onclick = (e) => {
      const row = (e.target as HTMLElement)?.closest(
        ".movi-cues-row",
      ) as HTMLElement | null;
      if (!row || !this.player) return;
      const startStr = row.dataset.start;
      if (!startStr) return;
      const start = parseFloat(startStr);
      if (!Number.isFinite(start)) return;
      // Seek to (cue start − delay) so the cue lands at this video time.
      const delay = this.player.getSubtitleDelay();
      const target = Math.max(0, start - delay);
      this.player.seek(target).catch(() => {});
      this.closeCuesPanel();
    };

    this.renderCuesPanel();

    // Active cue follow — re-pick the active row whenever clock advances.
    if (this._cuesPanelTimeUpdateUnsub) this._cuesPanelTimeUpdateUnsub();
    const onTime = () => this.updateCuesPanelActive();
    this.player.on("timeUpdate", onTime);
    this._cuesPanelTimeUpdateUnsub = () =>
      this.player?.off("timeUpdate", onTime);

    // ESC to close.
    if (this._cuesPanelEscHandler) {
      document.removeEventListener("keydown", this._cuesPanelEscHandler);
    }
    this._cuesPanelEscHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Only swallow ESC when the search input is empty — otherwise
        // let the search input's own ESC handler clear the query first.
        const s = this.shadowRoot?.querySelector(
          ".movi-cues-search",
        ) as HTMLInputElement | null;
        if (!s || s.value.length === 0) {
          this.closeCuesPanel();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener("keydown", this._cuesPanelEscHandler);
  }

  private closeCuesPanel(): void {
    const panel = this.shadowRoot?.querySelector(
      ".movi-cues-panel",
    ) as HTMLElement | null;
    if (panel) panel.style.display = "none";
    if (this._cuesPanelTimeUpdateUnsub) {
      this._cuesPanelTimeUpdateUnsub();
      this._cuesPanelTimeUpdateUnsub = null;
    }
    if (this._cuesPanelEscHandler) {
      document.removeEventListener("keydown", this._cuesPanelEscHandler);
      this._cuesPanelEscHandler = null;
    }
    this._cuesPanelCues = [];
    this._cuesPanelFiltered = [];
    this._cuesPanelQuery = "";
    this._cuesPanelActiveIdx = -1;
  }

  private renderCuesPanel(): void {
    const list = this.shadowRoot?.querySelector(
      ".movi-cues-list",
    ) as HTMLElement | null;
    const meta = this.shadowRoot?.querySelector(
      ".movi-cues-meta-count",
    ) as HTMLElement | null;
    if (!list) return;

    const q = this._cuesPanelQuery.trim().toLowerCase();
    const filtered = q
      ? this._cuesPanelCues.filter((c) => c.text.toLowerCase().includes(q))
      : this._cuesPanelCues;
    this._cuesPanelFiltered = filtered;

    if (meta) {
      const total = this._cuesPanelCues.length;
      meta.textContent = q
        ? `${filtered.length} of ${total} matching “${this._cuesPanelQuery}”`
        : `${total} cues`;
    }

    if (filtered.length === 0) {
      list.innerHTML = `<div class="movi-cues-empty">${q ? "No matches." : "No cues."}</div>`;
      this._cuesPanelActiveIdx = -1;
      return;
    }

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    // Some subtitle decoders emit HTML-entity-encoded text (&gt;, &amp;,
    // &#39;, &nbsp;…). Decode those first so the user sees the real
    // characters — and so a "<i>" written as "&lt;i&gt;" still gets
    // recognised as an italic tag below. &amp; is decoded last to avoid
    // double-decoding (e.g. "&amp;gt;" should land at "&gt;", not ">").
    const decodeEntities = (s: string): string =>
      s
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&");

    // Tokenize the cue text into plain spans + safe inline-style tags
    // (<i>, <b>, <u>). The C-side decoder emits these for SubRip/ASS
    // italic/bold/underline, and they should render — escaping them as
    // raw <i> on screen looks broken. Anything else gets escaped.
    const SAFE_TAG_RE = /<\/?[biu]>/gi;
    type Token = { type: "text" | "tag"; value: string };
    const tokenize = (raw: string): Token[] => {
      const text = decodeEntities(raw);
      const tokens: Token[] = [];
      let pos = 0;
      let m: RegExpExecArray | null;
      SAFE_TAG_RE.lastIndex = 0;
      while ((m = SAFE_TAG_RE.exec(text)) !== null) {
        if (m.index > pos)
          tokens.push({ type: "text", value: text.slice(pos, m.index) });
        tokens.push({ type: "tag", value: m[0].toLowerCase() });
        pos = SAFE_TAG_RE.lastIndex;
      }
      if (pos < text.length)
        tokens.push({ type: "text", value: text.slice(pos) });
      return tokens;
    };

    const highlight = (text: string): string => {
      const tokens = tokenize(text);

      if (!q) {
        return tokens
          .map((t) => (t.type === "tag" ? t.value : escapeHtml(t.value)))
          .join("");
      }

      // Build a plain-text view (tags stripped) so the search query
      // matches across italic boundaries, then map matches back onto
      // the original token stream so the rendered output preserves
      // tags AND highlights the matched substrings.
      let plain = "";
      const textRanges: { tokenIdx: number; start: number }[] = [];
      tokens.forEach((t, i) => {
        if (t.type === "text") {
          textRanges.push({ tokenIdx: i, start: plain.length });
          plain += t.value;
        }
      });
      const plainLower = plain.toLowerCase();
      const matches: { start: number; end: number }[] = [];
      let cur = 0;
      while (cur <= plainLower.length - q.length) {
        const idx = plainLower.indexOf(q, cur);
        if (idx < 0) break;
        matches.push({ start: idx, end: idx + q.length });
        cur = idx + q.length;
      }

      const parts: string[] = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === "tag") {
          parts.push(t.value);
          continue;
        }
        const range = textRanges.find((r) => r.tokenIdx === i);
        if (!range) continue;
        const tStart = range.start;
        const tEnd = tStart + t.value.length;
        let cursor = tStart;
        for (const mm of matches) {
          if (mm.end <= tStart || mm.start >= tEnd) continue;
          const ovStart = Math.max(mm.start, tStart);
          const ovEnd = Math.min(mm.end, tEnd);
          if (ovStart > cursor)
            parts.push(escapeHtml(plain.slice(cursor, ovStart)));
          parts.push(`<mark>${escapeHtml(plain.slice(ovStart, ovEnd))}</mark>`);
          cursor = ovEnd;
        }
        if (cursor < tEnd) parts.push(escapeHtml(plain.slice(cursor, tEnd)));
      }
      return parts.join("");
    };

    const fmt = (sec: number): string => {
      const total = Math.max(0, Math.floor(sec));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const mm = m.toString().padStart(2, "0");
      const ss = s.toString().padStart(2, "0");
      return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    };

    // Display the video-time at which each cue actually appears so the
    // numbers stay meaningful when the user has dialled in a delay
    // offset. Raw stream time is preserved on data-start for active-row
    // matching against the renderer's own (also delay-aware) clock.
    const delay = this.player ? this.player.getSubtitleDelay() : 0;
    list.innerHTML = filtered
      .map(
        (c) => `
      <div class="movi-cues-row" role="option" data-start="${c.start}">
        <span class="movi-cues-row-time">${fmt(Math.max(0, c.start - delay))}</span>
        <span class="movi-cues-row-text">${highlight(c.text)}</span>
      </div>`,
      )
      .join("");

    this.updateCuesPanelActive();
  }

  private updateCuesPanelActive(): void {
    const list = this.shadowRoot?.querySelector(
      ".movi-cues-list",
    ) as HTMLElement | null;
    if (!list || !this.player) return;
    const cues = this._cuesPanelFiltered;
    if (cues.length === 0) return;
    // Apply the live subtitle delay so the highlighted row matches what's
    // actually showing on screen (cue.start refers to raw stream time).
    const delay = this.player.getSubtitleDelay();
    const adjusted = this.player.getCurrentTime() + delay;
    // Pick the latest cue whose start <= adjusted. Linear scan is fine
    // for ~thousands of cues; switch to binary search if that ever
    // becomes a hotspot.
    let idx = -1;
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].start <= adjusted) idx = i;
      else break;
    }
    // Only count it active while the cue is still in its display window.
    if (idx >= 0 && cues[idx].end + 0.5 < adjusted) idx = -1;
    if (idx === this._cuesPanelActiveIdx) return;
    this._cuesPanelActiveIdx = idx;

    const rows = list.querySelectorAll<HTMLElement>(".movi-cues-row");
    rows.forEach((r, i) => {
      r.classList.toggle("is-active", i === idx);
    });
    if (idx >= 0) {
      const row = rows[idx];
      if (row) {
        const rowTop = row.offsetTop;
        const rowBot = rowTop + row.offsetHeight;
        const viewTop = list.scrollTop;
        const viewBot = viewTop + list.clientHeight;
        if (rowTop < viewTop || rowBot > viewBot) {
          list.scrollTop = rowTop - list.clientHeight / 2 + row.offsetHeight / 2;
        }
      }
    }
  }

  private updateSubtitleTrackMenu(): void {
    if (!this.player) return;

    const subtitleTrackList = this.shadowRoot?.querySelector(
      ".movi-subtitle-track-list",
    ) as HTMLElement;
    const subtitleTrackBtn = this.shadowRoot?.querySelector(
      ".movi-subtitle-track-btn",
    ) as HTMLElement;
    const subtitleTrackContainer = this.shadowRoot?.querySelector(
      ".movi-subtitle-track-container",
    ) as HTMLElement;
    if (!subtitleTrackList || !subtitleTrackBtn || !subtitleTrackContainer)
      return;

    const subtitleTracks = this.player.getSubtitleTracks();
    const activeTrack = this.player.trackManager.getActiveSubtitleTrack();
    const externalSubs = this.getSubtitleLangs();
    const hasExternalSubs = externalSubs.length > 0;

    // Hide container if no subtitle tracks (muxed or external)
    if (subtitleTracks.length === 0 && !hasExternalSubs) {
      subtitleTrackContainer.style.display = "none";
      return;
    }

    subtitleTrackContainer.style.display = "flex";
    subtitleTrackBtn.style.display = "flex";

    // Reflect the customize state on the header gear icon and hide it
    // entirely when there is no active subtitle — there's nothing to
    // customize until the user picks a track.
    const gearBtn = this.shadowRoot?.querySelector(
      ".movi-subtitle-customize-btn",
    ) as HTMLElement | null;
    const browseBtn = this.shadowRoot?.querySelector(
      ".movi-subtitle-browse-btn",
    ) as HTMLElement | null;
    const activeSubtitleKind = this.getActiveSubtitleKind();
    const hasActiveSubtitle = activeSubtitleKind !== null;
    if (gearBtn) {
      gearBtn.style.display = hasActiveSubtitle ? "" : "none";
      gearBtn.classList.toggle("is-active", this._showingSubtitleCustomize);
      gearBtn.setAttribute(
        "aria-pressed",
        this._showingSubtitleCustomize ? "true" : "false",
      );
    }
    if (browseBtn) {
      // Transcript browser needs text cues — image subtitles (PGS/VOBSUB)
      // are bitmaps with no extractable text. Also file-source only, since
      // getAllSubtitleCues() can't yield a complete list for streamed sources.
      const canBrowse =
        hasActiveSubtitle &&
        activeSubtitleKind !== "image" &&
        !!this.player?.isFileSource();
      browseBtn.style.display = canBrowse ? "" : "none";
    }
    // If the user had the customize panel open and then hit "Off",
    // bounce them back to the track list automatically.
    if (this._showingSubtitleCustomize && !hasActiveSubtitle) {
      this._showingSubtitleCustomize = false;
    }

    // If the user pressed the gear, render the settings panel inside
    // the same dropdown. Pressing the gear (or the panel's Back) returns.
    if (this._showingSubtitleCustomize) {
      subtitleTrackList.innerHTML = this.renderSubtitleCustomizePanel();
      this.wireSubtitleCustomizePanel(subtitleTrackList);
      this.flashSubtitleListFade(subtitleTrackList);
      const subtitleFooter = this.shadowRoot?.querySelector(
        ".movi-subtitle-track-footer",
      ) as HTMLElement | null;
      if (subtitleFooter) subtitleFooter.textContent = "";
      return;
    }

    const anyExternalActive = externalSubs.some((t) => t.active);
    const offActive = activeTrack === null && !anyExternalActive;

    // Toggle icons based on active state
    const subtitleIcon = this.shadowRoot?.querySelector(
      ".movi-icon-subtitle",
    ) as HTMLElement;
    const subtitleIconFilled = this.shadowRoot?.querySelector(
      ".movi-icon-subtitle-filled",
    ) as HTMLElement;

    const subtitleActive = activeTrack !== null || anyExternalActive;
    if (subtitleActive) {
      if (subtitleIcon) subtitleIcon.style.display = "none";
      if (subtitleIconFilled) subtitleIconFilled.style.display = "block";
    } else {
      if (subtitleIcon) subtitleIcon.style.display = "block";
      if (subtitleIconFilled) subtitleIconFilled.style.display = "none";
    }

    const ICON = MoviElement.TRACK_ICON_SUBTITLE;
    const ICON_OFF = MoviElement.TRACK_ICON_OFF;
    const CHECK = MoviElement.TRACK_ICON_CHECK;

    // Build menu - start with "Off" option
    let menuHTML = `
      <div class="movi-subtitle-track-item ${offActive ? "movi-subtitle-track-active" : ""}"
           data-track-id="null">
        ${ICON_OFF}
        <span class="movi-subtitle-track-label">Off</span>
        ${CHECK}
      </div>
    `;

    // Add muxed subtitle tracks
    menuHTML += subtitleTracks
      .map((track) => {
        const isActive = activeTrack?.id === track.id;
        const label = track.label || `Subtitle ${track.id}`;
        const badge = this.formatSubtitleBadge(track);

        return `
        <div class="movi-subtitle-track-item ${isActive ? "movi-subtitle-track-active" : ""}"
             data-track-id="${track.id}">
          ${ICON}
          <span class="movi-subtitle-track-label">${label}</span>
          ${badge ? `<span class="movi-subtitle-track-info">${badge}</span>` : ""}
          ${CHECK}
        </div>
      `;
      })
      .join("");

    // Add external subtitle tracks
    menuHTML += externalSubs
      .map((t) => `
        <div class="movi-subtitle-track-item ${t.active ? "movi-subtitle-track-active" : ""}"
             data-subtitle-id="${t.id}">
          ${ICON}
          <span class="movi-subtitle-track-label">${t.label}</span>
          <span class="movi-subtitle-track-info">${t.lang.toUpperCase()}</span>
          ${CHECK}
        </div>
      `)
      .join("");

    subtitleTrackList.innerHTML = menuHTML;
    this.flashSubtitleListFade(subtitleTrackList);

    // Footer count
    const subtitleFooter = this.shadowRoot?.querySelector(
      ".movi-subtitle-track-footer",
    ) as HTMLElement | null;
    if (subtitleFooter) {
      const count = subtitleTracks.length + externalSubs.length;
      subtitleFooter.textContent =
        count === 1
          ? "1 subtitle track available"
          : `${count} subtitle tracks available`;
    }

    // Add click handlers
    subtitleTrackList
      .querySelectorAll(".movi-subtitle-track-item")
      .forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const trackIdStr = (item as HTMLElement).dataset.trackId;
          const subtitleId = (item as HTMLElement).dataset.subtitleId;

          if (this.player) {
            const subIconOn = OSD.subOn;
            const subIconOff = OSD.subOff;
            if (subtitleId !== undefined) {
              // External subtitle track
              const st = this.player.getSubtitleLangs().find((t) => t.id === subtitleId);
              this.player.selectExternalSubtitle(subtitleId);
              this.updateSubtitleTrackMenu();
              const extSubOsd = st ? `${st.label} [${st.lang.toUpperCase()}]` : subtitleId;
              this.showOSD(subIconOn, extSubOsd);
            } else if (trackIdStr === "null") {
              // Disable all subtitles (muxed + external)
              this.player.selectSubtitleTrack(null).catch(() => {});
              this.player.selectExternalSubtitle(null);
              this.updateSubtitleTrackMenu();
              this.showOSD(subIconOff, "Subtitles Off");
            } else {
              // Muxed subtitle track
              const trackId = parseInt(trackIdStr || "0");
              this.player.selectExternalSubtitle(null);
              this.player.selectSubtitleTrack(trackId).catch(() => {});
              const trk = this.player.getSubtitleTracks().find(t => t.id === trackId);
              const muxSubLangC = trk?.language?.toUpperCase() || "";
              const muxSubLabelC = trk?.label || muxSubLangC || `Subtitle ${trackId}`;
              const muxSubOsdC = muxSubLangC && muxSubLabelC !== muxSubLangC ? `${muxSubLabelC} [${muxSubLangC}]` : muxSubLabelC;
              this.showOSD(subIconOn, muxSubOsdC);
            }
            // Re-render so the active row's checkmark + the gear/browse
            // icons reflect the new selection. Do NOT close the menu —
            // user wants to glance at the panel, swap a track, and
            // possibly tweak something else (Transcript, customize)
            // without re-opening the dropdown each time.
            this.updateSubtitleTrackMenu();
          }
        });
      });
  }

  /**
   * True when an actual media source is loaded (plain src, a caller-supplied
   * SourceAdapter, or the encrypted video URL). Used to gate the controls
   * auto-hide — in the empty "No Video" state we keep the bar pinned.
   */
  private hasMediaSource(): boolean {
    return (
      !!this._src ||
      !!this._sourceAdapter ||
      (this._encrypted && !!this._videoUrl)
    );
  }

  /**
   * Switch the UI into linear (forward-only) playback: the source has no Range
   * support and is too big to cache, so seeking is impossible. Hide the
   * timeline and disable seek + thumbnail previews via the `movi-linear` host
   * class. Idempotent — safe to call from both the event and the loadEnd
   * backstop.
   */
  /**
   * In linear (non-seekable-source) playback only the bytes currently in the
   * RAM window are reachable, so clamp any seek target to the buffered time
   * range [bufferStart, bufferEnd]. A small margin keeps the (approximate,
   * linear byte→time) clamp safely inside the window so the keyframe for the
   * target is actually present. Returns the time unchanged when not linear.
   */
  private clampToBufferedWindow(time: number): number {
    if (!this._linearMode || !this.player) return time;
    // Backward edge: getSeekableStartTime already bakes in a byte safety margin
    // so the seek's keyframe lands inside the window (the linear time→byte
    // estimate alone is too optimistic — GOP + VBR push the keyframe lower).
    const lo = this.player.getSeekableStartTime?.()
      ?? (this.player.getBufferStartTime?.() ?? 0);
    const end = this.player.getBufferEndTime?.() ?? this.duration;
    if (!(end > lo)) return time;
    const hi = Math.max(lo, end - Math.max(1, (end - lo) * 0.02));
    return Math.min(hi, Math.max(lo, time));
  }

  private enterLinearMode(): void {
    if (this._linearMode) return;
    this._linearMode = true;
    this.classList.add("movi-linear");
    // If the seek-dependent timeline strip happens to be open, close it — it
    // can't generate frames without random access.
    const panel = this.shadowRoot?.querySelector(
      ".movi-timeline-panel",
    ) as HTMLElement | null;
    if (panel && panel.style.display !== "none") panel.style.display = "none";
  }

  /**
   * Mirror "is the controls bar currently taking up bottom space?" onto a
   * plain host class so the empty-state placeholder can re-center reliably.
   * The old approach keyed off `:host:has(.movi-controls-hidden)` /
   * `:host(:not([controls]))`, but `:has()` is flaky in Safari/Firefox (and
   * an unsupported selector in a comma list drops the WHOLE rule), which left
   * the "No Video" text stuck off-center there. `:host(.movi-bar-collapsed)`
   * is universally supported, so the centering works in every browser.
   */
  private syncBarCollapsedClass(): void {
    const collapsed =
      !this._controls ||
      !!this.controlsContainer?.classList.contains("movi-controls-hidden");
    this.classList.toggle("movi-bar-collapsed", collapsed);
  }

  private showControls(): void {
    if (!this._controls) return;
    const container = this.controlsContainer;

    // Flush time/progress/volume DOM only when the bar is actually
    // coming back from hidden — if it's already visible, the rAF loop
    // has been keeping it current and another flush here just thrashes
    // the inline `transition: none` toggle on every mousemove (the
    // restore-on-next-frame loses if a fresh strip lands in the same
    // task, killing the smooth playback animation entirely).
    //
    // The throttled rAF loop in startUIUpdates skips time/progress/
    // volume writes while the bar is hidden (perf), so without this
    // catch-up the bar would fade in showing stale values and only
    // catch up on the next ≤250ms tick — visible as a "bump" right
    // after the bar appears. Painting fresh values while still at
    // opacity 0 means the fade-in reveals the already-current state.
    //
    // `.movi-progress-filled`/`-handle` carry a `transition: width|all
    // …` for smooth playback growth, which would otherwise animate the
    // catch-up write from the stale position to the current one
    // (visible as a sliding "bump" alongside the fade-in). Strip the
    // transition while writing, force a reflow so the snap commits,
    // then restore on the NEXT frame via `removeProperty` — setting
    // `style.transition = ""` in the same task is unreliable, some
    // engines coalesce both writes and keep the transition active.
    const wasHidden = container?.classList.contains("movi-controls-hidden");
    if (this.player && wasHidden) {
      const filled = this.shadowRoot?.querySelector(
        ".movi-progress-filled",
      ) as HTMLElement | null;
      const handle = this.shadowRoot?.querySelector(
        ".movi-progress-handle",
      ) as HTMLElement | null;
      const buffer = this.shadowRoot?.querySelector(
        ".movi-progress-buffer",
      ) as HTMLElement | null;

      if (filled) filled.style.transition = "none";
      if (handle) handle.style.transition = "none";
      if (buffer) buffer.style.transition = "none";

      this.updateTimeDisplay();
      this.updateProgressBar();
      this.updateVolumeIcon();

      // Force a sync layout so the snap commits with transition:none
      // applied before the rAF restore lands.
      if (filled) void filled.offsetWidth;

      requestAnimationFrame(() => {
        filled?.style.removeProperty("transition");
        handle?.style.removeProperty("transition");
        buffer?.style.removeProperty("transition");
      });
    }

    if (container) {
      container.classList.add("movi-controls-visible");
      container.classList.remove("movi-controls-hidden");
      this.syncBarCollapsedClass();

      // Restore cursor — clear the inline `none` on the host so the
      // CSS-driven cursor (default on the visible-controls path)
      // takes back over. Mirrors what hideControls does in reverse.
      this.style.cursor = "";
      if (this.canvas) this.canvas.style.cursor = "default";
      if (this.video) this.video.style.cursor = "default";

      // Mirror hideControls — clear the inline cursor:none on the center
      // button so its stylesheet cursor:pointer takes back over.
      const centerBtn = this.shadowRoot?.querySelector(
        ".movi-center-play-pause",
      ) as HTMLElement | null;
      if (centerBtn) centerBtn.style.cursor = "";
    }

    // Mirror the hide path — when controls come back, the center play
    // button should reappear if the player is paused/ready, since
    // hideControls now strips its visible class. Without this, the
    // big play button stayed gone until the next state change.
    //
    // Gate on the loading INDICATOR's display, not the `isLoading`
    // field. The field stays true through the entire initializePlayer
    // call, but the indicator is suppressed during the initial
    // seek(0) (suppressSpinner) — so visually nothing is loading,
    // yet the field-based guard kept the big play button hidden on
    // first paint when autoplay is off. Match the same source-of-
    // truth `updatePlayPauseIcon` uses (line ~13024) so the two
    // can't disagree.
    const centerPlayPause = this.shadowRoot?.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement | null;
    const loadingIndicator = this.shadowRoot?.querySelector(
      ".movi-loading-indicator",
    ) as HTMLElement | null;
    const spinnerVisible = loadingIndicator?.style.display === "flex";
    if (
      centerPlayPause &&
      !spinnerVisible &&
      !this._isUnsupported &&
      !this._autoplayStarting
    ) {
      const state = this.player?.getState();
      if (state !== "playing" && state !== "buffering") {
        centerPlayPause.classList.add("movi-center-visible");
      }
    }
    // Bar visible → lift the centre button + loading spinner slightly to
    // balance against it (host class the CSS keys off; see hideControls).
    // But only once playback has started — on the initial load / autoplay-off
    // screen the big play button and the spinner belong at the true centre.
    if (this._hasEverPlayed) {
      this.classList.add("movi-bar-visible");
    } else {
      this.classList.remove("movi-bar-visible");
    }

    // Shift timeline panel up above controls
    const bar = this.shadowRoot?.querySelector(".movi-controls-bar") as HTMLElement;
    const barHeight = bar?.offsetHeight ?? 80;
    const timelinePanel = this.shadowRoot?.querySelector(".movi-timeline-panel") as HTMLElement;
    let subtitlePadding = barHeight + 20;

    if (timelinePanel && timelinePanel.style.display !== "none") {
      timelinePanel.style.bottom = `${barHeight + 20}px`;
      // Subtitle above timeline
      requestAnimationFrame(() => {
        const tlHeight = timelinePanel.offsetHeight || 0;
        if (tlHeight > 0 && this.player) {
          this.player.setSubtitleControlsPadding(barHeight + tlHeight + 30);
        }
      });
    } else if (this.player) {
      this.player.setSubtitleControlsPadding(subtitlePadding);
    }

    // Show title bar if showtitle is enabled
    if (this._showTitle && this.shadowRoot) {
      const titleBar = this.shadowRoot.querySelector(".movi-title-bar") as HTMLElement;
      if (titleBar && titleBar.style.display !== "none") {
        titleBar.classList.add("movi-title-visible");
      }
    }

    // Reveal the settings gear with the rest of the chrome — but only once a
    // source is set (nothing to configure in the empty "No Video" state).
    const gearEl = this.shadowRoot?.querySelector(".movi-gear-btn");
    if (gearEl) {
      gearEl.classList.toggle("movi-gear-visible", this.hasMediaSource());
    }

    // Clear existing timeout
    if (this.controlsTimeout) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = null;
    }

    // Auto-hide whenever the player isn't "actively held open":
    // 1. There IS a media source loaded
    // 2. Not dragging the scrubber
    // 3. Mouse is NOT over the controls bar
    // 4. No menu (speed / audio / subtitle / quality) is open
    //
    // Previously this only fired during `playing`, which left the
    // bar stuck on screen indefinitely after a pause + cursor-away.
    // YouTube hides the bar on pause too once you stop interacting,
    // so we match that — the player will only stay open while the
    // user is actually hovering / scrubbing / has a menu out.
    //
    // The source gate keeps the bar pinned in the empty "No Video"
    // state — with nothing loaded there's nothing to interact with,
    // so hiding the controls would just look broken.
    if (
      this.hasMediaSource() &&
      !this.isOverControls &&
      !this.isDragging &&
      !this.isTouchDragging &&
      !this._vrPadDragging &&
      !this.isAnyMenuOpen() &&
      !this.isTimelineOpen()
    ) {
      this.controlsTimeout = window.setTimeout(() => {
        // Re-check gating conditions before hiding — a menu may have
        // been opened, the cursor may have moved over the bar, the 360°
        // joystick may now be in use, etc.
        if (
          !this.isOverControls &&
          !this.isDragging &&
          !this.isTouchDragging &&
          !this._vrPadDragging &&
          !this.isAnyMenuOpen() &&
          !this.isTimelineOpen()
        ) {
          this.hideControls();
        }
        this.controlsTimeout = null;
      }, 3000); // 3 seconds of inactivity
    }
  }

  /**
   * Close every bottom-controls dropdown (speed, audio, subtitle,
   * quality) plus the context menu. Used to enforce one-menu-at-a-time
   * and to swallow a player-area click when a menu is open.
   * Pass a `keep` selector to skip closing the menu currently being
   * opened, otherwise everything goes away.
   */
  private closeAllBottomMenus(keep?: string): void {
    if (!this.shadowRoot) return;
    const animatedSelectors = [
      ".movi-speed-menu",
      ".movi-audio-track-menu",
      ".movi-subtitle-track-menu",
      ".movi-quality-menu",
    ];
    for (const sel of animatedSelectors) {
      if (sel === keep) continue;
      const el = this.shadowRoot.querySelector(sel) as HTMLElement | null;
      this.setBottomMenuOpen(el, false);
    }
    if (keep !== ".movi-context-menu") {
      const ctx = this.shadowRoot.querySelector(
        ".movi-context-menu",
      ) as HTMLElement | null;
      if (ctx && ctx.style.display !== "none") ctx.style.display = "none";
    }

    // Full close (not the open-one/close-others case): re-arm the auto-hide
    // timer. Selecting a menu item or closing a popup leaves the bar with no
    // menu open and nothing scheduled to hide it — on touch devices, where
    // there's no mouseleave to re-trigger showControls(), the bar would stay
    // up. With `keep` set a different menu is opening, so leave it alone.
    if (!keep) {
      this.showControls();
    }
  }

  /**
   * Toggle a bottom-bar dropdown with a pop-in / pop-out animation.
   * Inline display:none stays the truly-hidden terminal state so the
   * existing dom-presence checks elsewhere keep working — we just clear
   * it on open, run the CSS transition, and restore it once the exit
   * transition finishes.
   */
  private setBottomMenuOpen(
    el: HTMLElement | null,
    open: boolean,
  ): void {
    if (!el) return;
    if (open) {
      if (el.classList.contains("is-open")) return;
      el.style.display = ""; // revert to CSS default (flex/block)
      // In audio-strip mode the player is a 56px tall bar. Pop-up menus
      // normally rely on the bar's overflow:visible chain to extend
      // beyond the host — but the bar lives inside the consumer's own
      // layout (e.g. a .player-stage flex container), and ANY ancestor
      // with overflow:hidden will clip the menu regardless of our own
      // CSS. Sidestep the problem entirely by switching to position:
      // fixed with the button's bounding rect — viewport coordinates
      // can't be clipped by ancestor overflow.
      this.applyStripFixedMenuPosition(el);
      // Non-strip: keep the upward-opening dropdown INSIDE the player and scroll
      // it internally, rather than letting it spill into the page above — on a
      // short embedded player that overlapped unrelated page content and hid the
      // first rows. The menu's bottom edge is anchored just above its button;
      // cap its height to the room between the player's OWN top and that bottom.
      // This is player-relative (subtract the host's top), NOT viewport-relative,
      // so it stays contained wherever the player sits on a scrolled page.
      // scrollTop 0 keeps the first row (0.25x / Audio 1 / first subtitle)
      // visible; the rest is reachable by scrolling. The mobile menu CSS sets
      // max-height with !important, so the inline override must also carry it.
      if (!this.classList.contains("movi-audio-strip")) {
        // Cap the upward-opening menu to the room between the player's top and
        // the controls bar, measured from STABLE elements — the bar and the
        // host — NOT the menu's own rect, which on a very short player is
        // unreliable before .is-open (it sits at natural height, so the cap
        // wouldn't bite and the first rows would clip above the player instead
        // of scrolling). The menu's containing block is the bar and it anchors
        // ~15px above the bar's top; leave ~8px breathing room -> subtract ~23.
        // scrollTop 0 keeps the first row (0.25x / Audio 1 / first subtitle)
        // reachable at the top. The mobile menu CSS sets max-height !important,
        // so the inline override must carry it too.
        const hostTop = this.getBoundingClientRect().top;
        const bar = this.shadowRoot?.querySelector(
          ".movi-controls-bar",
        ) as HTMLElement | null;
        const barTop = bar
          ? bar.getBoundingClientRect().top
          : el.getBoundingClientRect().bottom;
        // Floor kept low (not ~96) on purpose: on a very short player the room
        // above the bar can be < 96px, and a floor larger than the room would
        // push the menu's top back out above the player and clip the first row.
        el.style.setProperty(
          "max-height",
          `${Math.max(32, barTop - hostTop - 23)}px`,
          "important",
        );
        el.scrollTop = 0;
      }
      // The dropdowns live inside the controls container's stacking context
      // (z-index 10), so the top-right gear (z-index 30) would paint on top of a
      // menu that opens up over it. Hide the gear while any dropdown is open.
      this.classList.add("movi-bottom-menu-open");
      void el.getBoundingClientRect(); // flush layout so transition starts
      el.classList.add("is-open");
      return;
    }
    if (!el.classList.contains("is-open") && el.style.display === "none") {
      return;
    }
    el.classList.remove("is-open");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // If the menu was reopened during the exit transition, leave it.
      if (el.classList.contains("is-open")) return;
      el.style.display = "none";
      // Reset the strip-mode fixed positioning + the viewport max-height cap so
      // a subsequent open (in a different mode / at a different scroll spot)
      // doesn't inherit stale inline values.
      el.style.position = "";
      el.style.top = "";
      el.style.left = "";
      el.style.right = "";
      el.style.bottom = "";
      el.style.removeProperty("max-height");
      // Menu fully closed — if nothing else is open, re-arm the auto-hide
      // timer. Covers toggling a popup shut from its own button (no
      // closeAllBottomMenus / mouseleave fires on touch), which otherwise
      // left the bar pinned open on touch devices.
      if (!this.isAnyMenuOpen()) {
        // Restore the host clip + gear once every dropdown is closed.
        this.classList.remove("movi-menu-overflow");
        this.classList.remove("movi-bottom-menu-open");
        this.showControls();
      }
    };
    el.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 240); // safety net if transitionend doesn't fire
  }

  /**
   * Strip-mode menu positioning: place the menu just below the anchor
   * button using viewport-relative position:fixed. The strip CSS drops
   * the host's `contain: paint` + `container-type` so fixed coords are
   * actually viewport-relative again (default behaviour) and paint
   * extends outside the 56px strip box.
   */
  private applyStripFixedMenuPosition(menu: HTMLElement): void {
    if (!this.classList.contains("movi-audio-strip")) return;
    const anchor = menu.parentElement?.querySelector(
      ".movi-btn",
    ) as HTMLElement | null;
    if (!anchor) return;
    const btnRect = anchor.getBoundingClientRect();
    // Measure intrinsic size by briefly placing the menu offscreen.
    menu.style.position = "fixed";
    menu.style.bottom = "auto";
    menu.style.right = "auto";
    menu.style.visibility = "hidden";
    menu.style.left = "0";
    menu.style.top = "0";
    const menuW = menu.offsetWidth || 200;
    // Right-align with the button; clamp into viewport on both edges.
    let left = btnRect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) {
      left = window.innerWidth - menuW - 8;
    }
    menu.style.left = `${left}px`;
    menu.style.top = `${btnRect.bottom + 8}px`;
    menu.style.visibility = "";
  }

  private isBottomMenuOpen(el: HTMLElement | null): boolean {
    return !!el && el.classList.contains("is-open");
  }

  /**
   * Restart the subtle fade-in on the subtitle dropdown's content area so
   * toggling between the track list and the customize panel feels like a
   * crossfade rather than a snap. Removing + re-adding the class with a
   * forced reflow restarts the CSS animation; without the reflow the
   * browser deduplicates the class change and the animation never replays.
   */
  private flashSubtitleListFade(el: HTMLElement | null): void {
    if (!el) return;
    el.classList.remove("movi-fade-in");
    void el.offsetWidth;
    el.classList.add("movi-fade-in");
  }

  /**
   * Hide the seek OSD pill immediately and reset the chain state.
   * Used when a relative-seek press lands on the boundary (delta 0)
   * so the previous chain's "- 25s" cue doesn't keep reading like the
   * playhead has gone past zero — the cue had served its purpose
   * before the boundary press, but holding it on screen with no
   * forward movement is what the user sees as "minus".
   */
  private dismissSeekOSD(): void {
    if (this.osdTimeout) {
      clearTimeout(this.osdTimeout);
      this.osdTimeout = null;
    }
    const osdContainer = this.shadowRoot?.querySelector(
      ".movi-osd-container",
    ) as HTMLElement | null;
    if (osdContainer) {
      osdContainer.classList.remove("visible");
      window.setTimeout(() => {
        if (!osdContainer.classList.contains("visible")) {
          osdContainer.style.display = "none";
        }
      }, 300);
    }
    this.cumulativeSeekAmount = 0;
    this.lastSeekSide = null;
    this._seekChainTarget = null;
  }

  /**
   * Run a relative seek (button / key / double-tap) and surface it
   * through the OSD. The OSD label tracks the *actual* delta between
   * the pre-seek time and the clamped target — so pressing left at 5s
   * with a 10s step shows "- 5s", not "- 10s", and a follow-up press
   * at 0s suppresses the OSD entirely instead of accumulating phantom
   * seconds the playhead never travelled. Same on the duration end.
   *
   * For rapid chained presses we anchor "before" on the previous
   * target rather than the (still-stale) playback time, so the cue
   * tracks where the playhead is *headed* even mid-seek.
   */
  private performRelativeSeek(direction: "left" | "right", step = 10): void {
    // In linear mode the currentTime setter clamps the target to the buffered
    // RAM window, so skipping stays within what's seekable.
    const now = Date.now();
    const continuing =
      this.lastSeekSide === direction &&
      now - this.lastSeekTime < 1000;
    const dur = this.duration;
    // Sanitise the dur cap. Infinity (live) and NaN/0 (not yet loaded)
    // both leave Math.min producing values that bypass clamping; pin
    // forward seeks to a sane upper bound so target never lands above
    // the playable range.
    const safeDur =
      Number.isFinite(dur) && dur > 0 ? dur : Number.POSITIVE_INFINITY;
    // Anchor chained presses on the previous *target* (where the
    // playhead is headed) instead of this.currentTime, since the
    // setter is async and a burst of presses would otherwise read the
    // same stale time and double-count the delta. Clamp to [0, dur]
    // so a stale chain (e.g. duration shrank on a live stream cap)
    // can't anchor outside the playable range.
    const rawBefore =
      continuing && this._seekChainTarget !== null
        ? this._seekChainTarget
        : this.currentTime;
    const before = Math.max(
      0,
      Math.min(safeDur, Number.isFinite(rawBefore) ? rawBefore : 0),
    );
    const target = direction === "left"
      ? Math.max(0, before - step)
      : Math.min(safeDur, before + step);
    this.currentTime = target;
    this._seekChainTarget = target;
    const delta =
      direction === "left" ? before - target : target - before;

    const nextCum =
      continuing && delta > 0
        ? this.cumulativeSeekAmount + delta
        : delta;
    // cum should be ≥ 0 by construction, but Math.max guards against
    // any weird state (NaN, transient float negatives) leaking into
    // the display.
    const safeCum = Math.max(0, Number.isFinite(nextCum) ? nextCum : 0);
    const rounded = Math.round(safeCum);
    // If the rounded amount is 0 (boundary hit, sub-second move, or
    // float noise) the OSD would read "- 0s" / "+ 0s" — which the
    // user reads as the playhead having gone past zero. Dismiss any
    // lingering chain cue and bail without re-showing the pill.
    if (rounded <= 0) {
      this.dismissSeekOSD();
      return;
    }

    this.cumulativeSeekAmount = safeCum;
    this.lastSeekSide = direction;
    this.lastSeekTime = now;

    const label = `${direction === "left" ? "-" : "+"} ${rounded}s`;
    const icon = direction === "left" ? OSD.seekBackward : OSD.seekForward;
    this.showOSD(icon, label);
  }

  /**
   * The Timeline panel (opened with "T") sits just above the controls bar but
   * is a shadow-root sibling of the controls container, so hovering it never
   * sets isOverControls — without this the 3s inactivity auto-hide fires while
   * the user scrubs the storyboard. Gates ONLY the inactivity timer (in
   * showControls) so the bar stays put while the timeline is open; the
   * cursor-left-the-controls / cursor-left-the-player hides keep their normal
   * behavior. Kept out of isAnyMenuOpen(), which also drives click-to-close.
   */
  private isTimelineOpen(): boolean {
    const panel = this.shadowRoot?.querySelector(
      ".movi-timeline-panel",
    ) as HTMLElement | null;
    return !!panel && panel.style.display !== "none";
  }

  // ===================== Audio output device =====================
  // Public API + context-menu wiring for AudioContext.setSinkId routing.

  /** True when the engine can route output to a chosen device. */
  private static audioSinkSupported(): boolean {
    return (
      typeof AudioContext !== "undefined" &&
      typeof (AudioContext.prototype as unknown as { setSinkId?: unknown })
        .setSinkId === "function"
    );
  }

  /** Running inside a (possibly cross-origin) iframe. */
  private isEmbeddedIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      // Cross-origin access to window.top can throw in some sandboxes — if we
      // can't even read it, we're definitely framed.
      return true;
    }
  }

  /**
   * Whether a Permissions-Policy feature (e.g. "fullscreen",
   * "picture-in-picture", "speaker-selection") is allowed in this document.
   * At the top level features are allowed by default; inside an iframe they
   * must be delegated via the `allow` attribute. Uses the (Chromium) feature
   * policy API when present and defaults to allowed when it isn't — the
   * features we gate this way are all Chromium-only, so a missing API means a
   * browser that wouldn't expose the capability regardless.
   */
  private featureAllowed(feature: string): boolean {
    const fp = (document as unknown as {
      featurePolicy?: { allowsFeature?: (f: string) => boolean };
    }).featurePolicy;
    if (fp && typeof fp.allowsFeature === "function") {
      try {
        return fp.allowsFeature(feature);
      } catch {
        return true;
      }
    }
    return true;
  }

  /**
   * List the available audio output devices. Labels may be empty until the
   * page has been granted audio-device access (the desktop app has it; a bare
   * web embed may show blank labels until a getUserMedia prompt is accepted).
   */
  async getAudioOutputs(): Promise<Array<{ deviceId: string; label: string }>> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
    } catch {
      return [];
    }
  }

  /** Current audio output device id ("" = system default). */
  getAudioOutput(): string {
    return this.player?.getAudioOutputDevice?.() ?? this._audioOutputDeviceId;
  }

  /**
   * Route audio to a device. Accepts a concrete deviceId, or — for
   * convenience — a label substring (case-insensitive); "" / "default" →
   * the system default. Returns false when unsupported or the device is gone.
   */
  async setAudioOutput(deviceId: string): Promise<boolean> {
    const resolved = await this.resolveAudioOutputId(deviceId || "");
    this._audioOutputDeviceId = resolved;
    let ok = false;
    if (this.player) ok = await this.player.setAudioOutputDevice(resolved);
    this.dispatchEvent(
      new CustomEvent("audiooutputchange", { detail: { deviceId: resolved } }),
    );
    this.updateAudioOutputMenu();
    return ok;
  }

  /** Resolve a deviceId or a label substring to a concrete deviceId. */
  private async resolveAudioOutputId(value: string): Promise<string> {
    if (!value || value === "default") return "";
    const outs = await this.getAudioOutputs();
    if (outs.some((d) => d.deviceId === value)) return value;
    const byLabel = outs.find(
      (d) => d.label && d.label.toLowerCase().includes(value.toLowerCase()),
    );
    return byLabel ? byLabel.deviceId : value;
  }

  /** Apply the `audiooutput` attribute once the player exists. */
  private async applyAudioOutput(): Promise<void> {
    if (!this.player) return; // re-applied from setupAudioOutputs() when ready
    const resolved = await this.resolveAudioOutputId(this._audioOutputDeviceId);
    this._audioOutputDeviceId = resolved;
    await this.player.setAudioOutputDevice(resolved);
    this.updateAudioOutputMenu();
  }

  /**
   * Cache the device list, re-applying any pending attribute selection and
   * re-rendering the menu. Bound once to `devicechange` so hot-plugging a
   * headset updates the list live.
   */
  private async setupAudioOutputs(): Promise<void> {
    if (!MoviElement.audioSinkSupported()) return;
    if (!this._audioOutputsBound && navigator.mediaDevices?.addEventListener) {
      this._audioOutputsBound = true;
      navigator.mediaDevices.addEventListener("devicechange", () => {
        this.refreshAudioOutputs();
      });
    }
    await this.refreshAudioOutputs();
    // The attribute may have been set before the player existed.
    if (this._audioOutputDeviceId) this.applyAudioOutput();
  }

  /** Refresh the cached device list and re-render the menu if it's open. */
  private async refreshAudioOutputs(): Promise<void> {
    this._audioOutputs = await this.getAudioOutputs();
    this.updateAudioOutputMenu();
  }

  /**
   * Browsers only expose output device ids/labels after the page holds audio
   * permission. When the user clicks "Show output devices…" in the (otherwise
   * locked) submenu, request mic permission — the universal unlock, same as
   * Google Meet — then re-render with the now-visible devices and re-open the
   * submenu. Triggered from an explicit click so the prompt has a user
   * gesture. No-op in the desktop app (devices already visible).
   */
  private async unlockAudioOutputs(): Promise<void> {
    const real = this._audioOutputs.filter(
      (d) =>
        d.deviceId &&
        d.deviceId !== "default" &&
        d.deviceId !== "communications",
    );
    if (real.length >= 1) return; // already have the real list
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the mic immediately — we only needed the permission grant so
      // enumerateDevices() returns labelled output devices.
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      return; // denied / unavailable
    }
    await this.refreshAudioOutputs();
    // Re-open the submenu so the freshly populated list is visible.
    const submenu = this.shadowRoot?.querySelector(
      ".movi-context-menu-submenu-audiodevice",
    ) as HTMLElement | null;
    submenu?.classList.add("movi-context-menu-submenu-visible");
  }

  /** (Re)build the Audio Output submenu from the cached device list. */
  private updateAudioOutputMenu(): void {
    const sr = this.shadowRoot;
    if (!sr) return;
    const divider = sr.querySelector(
      ".movi-context-menu-divider-audiodevice",
    ) as HTMLElement | null;
    const item = sr.querySelector(
      ".movi-context-menu-item-audiodevice",
    ) as HTMLElement | null;
    const submenu = sr.querySelector(
      ".movi-context-menu-submenu-audiodevice",
    ) as HTMLElement | null;
    if (!divider || !item || !submenu) return;

    // Drop Chromium's "default"/"communications" aliases — the synthetic
    // "System Default" entry below already routes to the OS default. Only
    // surface the menu when there's a real alternative device to pick.
    const real = this._audioOutputs.filter(
      (d) =>
        d.deviceId &&
        d.deviceId !== "default" &&
        d.deviceId !== "communications",
    );
    // Browsers hide output deviceIds/labels until the page has audio-device
    // permission, so `real` is empty in a bare web embed. Still surface the
    // menu when we can prompt for that permission on demand (getUserMedia) —
    // opening the submenu triggers the Meet-style prompt and the list fills
    // in. The desktop app already has permission, so `real` is populated and
    // no prompt is needed.
    // In an iframe, routing to a device needs allow="speaker-selection", and
    // the getUserMedia unlock needs allow="microphone". Without those the menu
    // would be a dead control (setSinkId / getUserMedia throw NotAllowedError),
    // so gate on the Permissions Policy.
    const speakerAllowed = this.featureAllowed("speaker-selection");
    const canUnlock =
      !!navigator.mediaDevices?.getUserMedia && this.featureAllowed("microphone");
    if (
      !MoviElement.audioSinkSupported() ||
      !speakerAllowed ||
      (real.length < 1 && !canUnlock)
    ) {
      divider.style.display = "none";
      item.style.display = "none";
      submenu.style.display = "none";
      return;
    }

    divider.style.display = "block";
    item.style.display = "flex";
    submenu.style.removeProperty("display");

    const current = this.getAudioOutput();
    const isDefault = !current || current === "default";
    const esc = (s: string) =>
      s.replace(
        /[<>&]/g,
        (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string,
      );

    let html = "";
    if (
      window.innerWidth <= 1024 ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      html += `<div class="movi-context-menu-item movi-context-menu-back" data-action="back">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span class="movi-context-menu-label">Back</span>
      </div>`;
    }
    html += `<div class="movi-context-menu-item${
      isDefault ? " movi-context-menu-active" : ""
    }" data-audio-output-id="">System Default</div>`;
    html += real
      .map((d, i) => {
        const active =
          !isDefault && d.deviceId === current
            ? " movi-context-menu-active"
            : "";
        const label = esc(d.label || `Output ${i + 1}`);
        return `<div class="movi-context-menu-item${active}" data-audio-output-id="${esc(
          d.deviceId,
        )}">${label}</div>`;
      })
      .join("");

    // Locked (browser, no permission yet): the only real entry is System
    // Default. Offer an explicit click to unlock the device list — a click
    // gives getUserMedia the user gesture it needs to show the prompt (hover
    // opening the submenu does not).
    if (real.length < 1 && canUnlock) {
      html += `<div class="movi-context-menu-item movi-context-menu-audiodevice-unlock" data-audio-output-unlock="1">
        <svg class="movi-context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span class="movi-context-menu-label">Show output devices…</span>
      </div>`;
    }

    submenu.innerHTML = html;
    this.setupSubmenuHover(item, submenu);
  }

  private isAnyMenuOpen(): boolean {
    if (!this.shadowRoot) return false;

    const speedMenu = this.shadowRoot.querySelector(".movi-speed-menu") as HTMLElement;
    const audioMenu = this.shadowRoot.querySelector(".movi-audio-track-menu") as HTMLElement;
    const subtitleMenu = this.shadowRoot.querySelector(".movi-subtitle-track-menu") as HTMLElement;
    const qualityMenu = this.shadowRoot.querySelector(".movi-quality-menu") as HTMLElement;
    const contextMenu = this.shadowRoot.querySelector(".movi-context-menu") as HTMLElement;

    return (
      this.isBottomMenuOpen(speedMenu) ||
      this.isBottomMenuOpen(audioMenu) ||
      this.isBottomMenuOpen(subtitleMenu) ||
      this.isBottomMenuOpen(qualityMenu) ||
      (contextMenu && (contextMenu.style.display === "block" || contextMenu.style.display === "flex"))
    );
  }

  private hideControls(): void {
    if (!this._controls) return;
    const container = this.controlsContainer;
    if (container) {
      container.classList.remove("movi-controls-visible");
      container.classList.add("movi-controls-hidden");
      this.syncBarCollapsedClass();

      // Collapse the touch-expanded volume slider along with the bar — leaving
      // it open over a hidden bar looks orphaned.
      const volumeContainer = this.shadowRoot?.querySelector(
        ".movi-volume-container",
      ) as HTMLElement | null;
      volumeContainer?.classList.remove("active");

      // Hide cursor. Setting the host element's inline cursor is the
      // single most reliable signal — the :has-based CSS rule below
      // does the right thing in spec terms, but Safari (and Chrome
      // on idle frames without mouse movement) sometimes doesn't
      // repaint the cursor until the pointer moves. Forcing the host
      // (and canvas/video, which sit underneath the overlay) via
      // inline style makes the change take effect immediately.
      this.style.cursor = "none";
      // In document-PiP the canvas is MOVED into the PiP window (out of the
      // shadow tree, so the cursor-hiding CSS can't reach it) — this inline
      // style still travels with the element and would hide the pointer over
      // the whole PiP video area above its own controls. Keep it visible there.
      if (this.canvas)
        this.canvas.style.cursor = this._pipWindow ? "default" : "none";
      if (this.video) this.video.style.cursor = "none";

      // The center play/pause button stays visible with pointer-events:auto
      // while paused (the "click to resume" affordance). It has its own
      // cursor:pointer, and because the pointer sits over it the host's
      // cursor:none never wins — leaving a visible pointer over an
      // otherwise hidden UI. Force it inline so the cursor hides there too.
      const centerBtn = this.shadowRoot?.querySelector(
        ".movi-center-play-pause",
      ) as HTMLElement | null;
      if (centerBtn) centerBtn.style.cursor = "none";
    }

    // The center play/pause button is a separate sibling, so the bar's
    // hidden class doesn't reach it. Only strip it when the player is
    // actually playing — that's the pause-confirmation flash from a
    // click, which should fade out alongside the bar. When the player
    // is paused/ready/ended, keep the big play icon visible so the
    // user always has a "click to resume" affordance even after the
    // bottom bar has auto-hidden. updatePlayPauseIcon's paused branch
    // will re-add the class on the next 250ms tick anyway, but the
    // visible flicker between strip-and-re-add is what we're avoiding.
    const centerPlayPause = this.shadowRoot?.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement | null;
    const state = this.player?.getState();
    if (centerPlayPause && state === "playing") {
      centerPlayPause.classList.remove("movi-center-visible");
    }
    // Bar hidden → centre button + loading spinner sit at the true centre.
    // (The :host:has(.movi-controls-hidden) CSS rule meant to do this doesn't
    // apply against the shadow tree in some engines, e.g. Electron's Chromium,
    // so the CSS keys off this host class we toggle instead.)
    this.classList.remove("movi-bar-visible");

    // Shift timeline panel down when controls hide
    const timelinePanel = this.shadowRoot?.querySelector(".movi-timeline-panel") as HTMLElement;
    if (timelinePanel) {
      timelinePanel.style.bottom = "12px";
    }

    // Shift subtitles — if timeline open, keep above it
    if (this.player) {
      if (timelinePanel && timelinePanel.style.display !== "none") {
        requestAnimationFrame(() => {
          const tlHeight = timelinePanel.offsetHeight || 0;
          this.player?.setSubtitleControlsPadding(tlHeight + 24);
        });
      } else {
        this.player.setSubtitleControlsPadding(0);
      }
    }

    // Hide title bar when controls are hidden
    if (this.shadowRoot) {
      const titleBar = this.shadowRoot.querySelector(".movi-title-bar") as HTMLElement;
      if (titleBar) {
        titleBar.classList.remove("movi-title-visible");
      }
    }

    // Hide the settings gear with the rest of the chrome — EXCEPT in audio
    // strip mode, where the bar is the whole (always-visible) player, so its
    // gear must stay put rather than auto-hiding with the transient controls.
    if (!this.classList.contains("movi-audio-strip")) {
      this.shadowRoot
        ?.querySelector(".movi-gear-btn")
        ?.classList.remove("movi-gear-visible");
    }
  }

  private updateControlsVisibility(): void {
    const container = this.controlsContainer;
    if (!container) return;

    const centerPlayPause = this.shadowRoot?.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement;

    if (this._controls) {
      // Make the bar a layout participant, but start it in the hidden
      // state — the YouTube-style first paint is just the big centre
      // play icon over the poster/frame, no chrome. The host-level
      // mouseenter / mousemove handlers surface the bar on the first
      // real interaction, and stateChange → "paused" / "ended" still
      // re-shows it after playback has started.
      container.style.display = "block";
      container.classList.remove("movi-controls-visible");
      container.classList.add("movi-controls-hidden");
    } else {
      container.style.display = "none";
      if (centerPlayPause) centerPlayPause.classList.remove("movi-center-visible");
    }
    this.syncBarCollapsedClass();
  }

  private startUIUpdates(): void {
    this.updateAspectRatioIcon();
    // Throttle UI updates to ~4Hz (250ms). Time display, progress bar
    // and icons don't need 60fps precision — at 60fps the six DOM
    // mutations below burn ~30-50ms/sec of main-thread time on a
    // low-end phone, enough to starve the <video> element's media
    // pipeline and trigger GOP-boundary rebuffering on 4K AV1. This
    // matches the cadence of HTMLMediaElement's own `timeupdate`
    // event, so reactive listeners still feel immediate.
    const UI_UPDATE_MIN_MS = 250;
    let lastRun = 0;
    const updateUI = (timestamp: number) => {
      if (!this.player) return;

      if (timestamp - lastRun >= UI_UPDATE_MIN_MS) {
        lastRun = timestamp;
        // When the controls *bar* is auto-hidden, progress bar / time /
        // volume icon are invisible — skip those DOM writes. Play/pause
        // icon stays out of the gate because its update ALSO drives the
        // centred big play/pause button overlay, which sits separately
        // from the controls bar and is visible even when the bar is
        // hidden — without this update the centre button gets stuck on
        // its initial "pause" SVG. Loading indicator + title overlay
        // also stay live; they aren't part of the bar.
        // In strip mode, controls are permanently visible (the bar IS
        // the player), so the auto-hide optimisation below would freeze
        // the time / progress / volume icon updates against an empty
        // class on the controls-container. Force the updates through.
        const inStripMode = this.classList.contains("movi-audio-strip");
        const controlsHidden = !inStripMode && this.controlsContainer?.classList.contains(
          "movi-controls-hidden",
        );
        this.updatePlayPauseIcon();
        this.updateLoadingIndicator();
        this.updateTitle();
        if (!controlsHidden) {
          this.updateTimeDisplay();
          this.updateProgressBar();
          this.updateVolumeIcon();
        }
      }

      requestAnimationFrame(updateUI);
    };
    requestAnimationFrame(updateUI);
  }

  private addStyles(shadowRoot: ShadowRoot): void {
    // Load the webfont in its OWN sheet, appended a frame AFTER the main styles.
    // WebKit/Safari treats a shadow-DOM <style> whose first rule is a remote
    // @import as "pending" until that font finishes downloading — so on the
    // first (uncached) load the ENTIRE stylesheet is withheld and the shadow
    // content paints UNSTYLED for ~1s: the VR pad, gear, etc. flash in at their
    // default (static, opacity 1) positions before snapping to their real
    // hidden state. Isolating the @import — and adding it only after the first
    // paint — guarantees the layout/visibility rules below apply immediately;
    // Inter just swaps in late (font-display: swap). Chromium never had this
    // bug (it applies the other rules right away regardless of the @import).
    requestAnimationFrame(() => {
      if (shadowRoot.querySelector("style[data-movi-font]")) return;
      const fontStyle = document.createElement("style");
      fontStyle.setAttribute("data-movi-font", "");
      fontStyle.textContent =
        "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');";
      shadowRoot.appendChild(fontStyle);
    });

    const style = document.createElement("style");
    style.textContent = `
      /* ========================================
         MOVI PLAYER - PREMIUM UI STYLES
         Rich, Elegant & Responsive Design
      ======================================== */
      
      /* Global rules to remove all outlines and focus rings */
      * {
        outline: none !important;
        -webkit-tap-highlight-color: transparent !important;
        box-sizing: border-box;
      }
      
      *:focus,
      *:active,
      *:focus-visible,
      *:focus-within {
        outline: none !important;
        outline-width: 0 !important;
        outline-style: none !important;
        outline-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      button,
      input,
      button:focus,
      button:active,
      button:focus-visible,
      button:focus-within,
      input:focus,
      input:active,
      input:focus-visible,
      input:focus-within {
        outline: none !important;
        outline-width: 0 !important;
        outline-style: none !important;
        outline-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
      }

      :host {
        /* Treat the host as a query container so the responsive
           breakpoints below trigger off the PLAYER's own width
           instead of the viewport's. Without this, embedding the
           player inside a desktop layout with a sidebar (player
           width < 640px while viewport > 640px) keeps the desktop
           controls layout and clips the rightmost icons. */
        container-type: inline-size;
        container-name: movi-host;

        /* CSS containment isolates the player's layout/style/paint
           subtree from the host page. On a busy marketing page (heavy
           CSS, infinite animations, large DOM), every body-level
           style invalidation otherwise triggers a recalc cascade that
           reaches into the player's shadow tree and competes with
           frame presentation. Telling the browser "this subtree
           cannot affect outside, and outside cannot affect this
           subtree's internal layout/paint" is a large win on low-end
           devices when the player is embedded in a non-minimal page.
           Skipped contain:size so the host can still derive its
           dimensions from its parent. */
        contain: layout style paint;

        /* Premium Color Palette */
        --movi-primary: #8B5CF6;
        /* Derived so themecolor attribute cascades to light/dark variants */
        --movi-primary-light: color-mix(in srgb, var(--movi-primary) 70%, white);
        --movi-primary-dark: color-mix(in srgb, var(--movi-primary) 70%, black);
        --movi-accent: #06B6D4;
        --movi-accent-light: #22D3EE;
        /* Use solid color instead of gradient */
        --movi-gradient: var(--movi-primary);
        
        /* Glass-morphism */
        --movi-glass-bg: rgba(15, 15, 20, 0.85);
        --movi-glass-border: rgba(255, 255, 255, 0.08);
        --movi-glass-blur: 20px;
        
        /* Text Colors */
        --movi-controls-color: #FFFFFF;
        /* Foreground for chrome that is ALWAYS dark (bottom bar, OSD capsule,
           dark pills) — stays white in both themes, unlike --movi-controls-color
           which flips to dark for menus on light surfaces. Public theming hook. */
        --movi-chrome-fg: #ffffff;
        --movi-text-secondary: rgba(255, 255, 255, 0.7);
        --movi-text-tertiary: rgba(255, 255, 255, 0.5);
        
        /* Dynamic Theme Backgrounds */
        /* Same three-stop fade-to-transparent gradient the light
           theme uses now — feathered top edge reads like proper
           chrome over the video instead of a hard band. */
        --movi-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.35) 60%, transparent 100%);
        /* Overlay's dark wash sits behind the controls bar gradient.
           Fading out at 12% instead of 30% keeps the glow confined
           to the chrome band — it used to bleed a third of the way
           up the frame. */
        --movi-overlay-bg: linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 12%);
        --movi-progress-bg: rgba(255, 255, 255, 0.15);
        
        /* Sizing */
        --movi-controls-height: 72px;
        --movi-controls-height-mobile: 64px;
        --movi-progress-height: 4px;
        --movi-progress-height-hover: 6px;
        --movi-btn-size: 44px;
        --movi-btn-size-mobile: 40px;
        
        /* Shadows & Effects */
        --movi-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
        --movi-shadow-md: 0 8px 32px rgba(0, 0, 0, 0.4);
        --movi-shadow-lg: 0 16px 64px rgba(0, 0, 0, 0.5);
        --movi-shadow-glow: 0 0 20px color-mix(in srgb, var(--movi-primary) 0.3);
        
        /* Transitions */
        --movi-transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        --movi-transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        --movi-transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        --movi-transition-bounce: 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        
        /* Legacy variables for compatibility */
        --movi-controls-bg: var(--movi-glass-bg);
        --movi-progress-color: var(--movi-primary);
        --movi-progress-buffer-color: rgba(255, 255, 255, 0.2);
        --movi-btn-hover-bg: rgba(255, 255, 255, 0.1);
        
        display: block;
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
        background: #000;
        outline: none !important;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        overflow: hidden;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      /* While a desktop context menu is open, let it spill past the player's
         own box the way strip mode does: lift the host's paint containment and
         overflow clip. container-type stays, so the responsive @container
         queries keep firing and the menu is still positioned relative to the
         host — it just isn't clipped to the player edges anymore. Transient:
         the class is removed the moment the menu closes. */
      :host(.movi-menu-overflow) {
        overflow: visible !important;
        contain: layout style !important;
      }

      /* iOS pseudo-fullscreen: iOS Safari only fullscreens <video>, and we
         render to a canvas, so the element Fullscreen API is unavailable. Fill
         the whole screen via CSS instead. Sized in LARGE viewport units
         (100lvw/100lvh, 100vw/100vh fallback) so the box spans the entire
         screen — behind Safari's toolbars — instead of just the shrunken
         visible area (dvh/inset left page content peeking at the edges). */
      :host(.movi-pseudo-fullscreen) {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: auto !important;
        bottom: auto !important;
        width: 100vw !important;
        width: 100lvw !important;
        height: 100vh !important;
        height: 100lvh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        border-radius: 0 !important;
        z-index: 2147483647 !important;
        background: #000 !important;
      }
      /* Forced-landscape: a landscape video on a portrait screen (where iOS
         won't rotate for us) is turned 90° via CSS so it fills the screen the
         way Chrome/Android's orientation lock does. Swapped large-viewport
         dimensions so, after the rotate, the box maps onto the full screen;
         centred so the rotate pivots about the middle. */
      :host(.movi-pseudo-fs-rotate) {
        width: 100vh !important;
        width: 100lvh !important;
        height: 100vw !important;
        height: 100lvw !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) rotate(90deg) !important;
        transform-origin: center center !important;
      }

      /* The :host{display:block} above is an author rule, so it beats the
         UA stylesheet's [hidden]{display:none}. Without this, the standard
         hidden attribute does nothing and the player stays visible. Honour
         it explicitly. !important so source-order/specificity can't regress it. */
      :host([hidden]) {
        display: none !important;
      }

      /* Light Theme Override */
      :host([theme="light"]) {
        --movi-primary: #7c3aed; /* Vibrancy boost for light theme */
        --movi-glass-bg: rgba(255, 255, 255, 0.7);
        --movi-glass-border: rgba(0, 0, 0, 0.1);
        --movi-controls-color: #11142d;
        --movi-text-secondary: rgba(0, 0, 0, 0.6);
        --movi-text-tertiary: rgba(0, 0, 0, 0.4);
        
        --movi-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.05);
        --movi-shadow-md: 0 8px 32px rgba(0, 0, 0, 0.1);
        --movi-shadow-lg: 0 16px 64px rgba(0, 0, 0, 0.15);
        --movi-shadow-glow: 0 0 20px color-mix(in srgb, var(--movi-primary) 0.15);
        
        --movi-btn-hover-bg: rgba(0, 0, 0, 0.05);
        --movi-btn-hover-bg: rgba(0, 0, 0, 0.05);
        --movi-progress-buffer-color: rgba(0, 0, 0, 0.15);

        /* Light Theme Backgrounds. Bottom bar uses the same dark
           gradient as the dark theme + as the title bar — the white
           variant was reading as a washed-out slab on bright frames
           and made dark icons fight the video underneath. Chrome
           consistently dark across themes is what YouTube / Netflix
           do; per-element colour overrides below force the icons
           and text white inside the bar so the dark theme's icon
           rules still apply over the dark gradient. */
        --movi-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.35) 60%, transparent 100%);
        /* Light theme overlay used to bleed bright white halfway up
           the frame too; match the dark theme's tighter 12% fade. */
        --movi-overlay-bg: linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 12%);
        --movi-progress-bg: rgba(0, 0, 0, 0.1);
      }
      
      /* Light Theme colour overrides for elements that sit on the
         light surfaces — dropdown menu rows still need dark text
         since they pop over the player on a light card. */
      :host([theme="light"]) .movi-speed-item,
      :host([theme="light"]) .movi-audio-track-item,
      :host([theme="light"]) .movi-subtitle-track-item,
      :host([theme="light"]) .movi-quality-item {
         color: #11142d !important;
      }

      /* Inside the bottom controls bar we keep icons / text white
         in both themes, because the bar surface is now a dark
         gradient in both themes (see --movi-bar-bg above). Without
         these overrides the light theme's dark icon colour would
         disappear into the dark bar. */
      :host([theme="light"]) .movi-controls-bar,
      :host([theme="light"]) .movi-controls-bar .movi-btn,
      :host([theme="light"]) .movi-controls-bar .movi-time,
      :host([theme="light"]) .movi-controls-bar .movi-current-time,
      :host([theme="light"]) .movi-controls-bar .movi-duration {
         color: #FFFFFF !important;
      }

      :host([theme="light"]) .movi-controls-bar .movi-time-separator {
         color: rgba(255, 255, 255, 0.5) !important;
      }
      
      /* Light theme bar is dark now — drop the light-on-dark slider
         overrides. The default white-on-dark slider (declared on
         .movi-volume-slider further down) already reads correctly
         against the dark gradient, so the previous "dark thumb on
         light track" overrides would just disappear the thumb. */

      /* Light Theme Tooltip */
      :host([theme="light"]) .movi-seek-thumbnail {
        background-color: rgba(255, 255, 255, 0.65) !important;
        color: #11142d !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
      }

      /* Chapter title inside the seek tooltip has its own hardcoded
         white color for the dark theme — needs an explicit dark
         override here or it disappears against the light backdrop. */
      :host([theme="light"]) .movi-seek-chapter-title {
        color: #11142d !important;
      }

      :host([theme="light"]) .movi-thumbnail-img {
         border-color: rgba(0, 0, 0, 0.1) !important;
         background-color: #f0f0f0 !important;
      }

      /* OSD stays the dark capsule in light theme too — it's chrome
         floating over the video, same logic as the bottom bar. The
         old white pill blended into bright frames and hid behind
         seek-OSD timing cues. */

      /* Light Theme Button Hover */
      :host([theme="light"]) .movi-btn:hover {
        background: var(--movi-btn-hover-bg) !important;
      }

      /* Light theme controls overlay — use the dark wash that
         matches the dark theme bar; the old white wash on light
         theme made the bottom third of bright frames look hazy
         instead of cleanly anchored to the chrome band. */
      :host([theme="light"]) .movi-controls-overlay {
        background: linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 12%) !important;
      }

      /* Light Theme Title Bar — keep dark like dark theme for readability */
      :host([theme="light"]) .movi-title-bar {
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 100%) !important;
      }

      /* Light theme progress bar — bar surface is dark now, so the
         track / buffer use the same white-on-dark values as the
         dark theme defaults. Explicit !important needed to win over
         the more-general dark-theme rules without re-tinting to
         black-on-light. */
      :host([theme="light"]) .movi-progress-bar {
        background: rgba(255, 255, 255, 0.15) !important;
      }

      :host([theme="light"]) .movi-progress-bar:hover {
        background: rgba(255, 255, 255, 0.25) !important;
      }

      :host([theme="light"]) .movi-progress-buffer {
        background: rgba(255, 255, 255, 0.25) !important;
      }

      /* Light Theme Center Play Button */
      :host([theme="light"]) .movi-center-play-pause {
        background: color-mix(in srgb, var(--movi-primary) 15%, transparent) !important;
        border-color: color-mix(in srgb, var(--movi-primary) 30%, transparent) !important;
        box-shadow: 0 8px 32px color-mix(in srgb, var(--movi-primary) 20%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--movi-primary) 10%, transparent) !important;
      }

      :host([theme="light"]) .movi-center-play-pause:hover {
        background: color-mix(in srgb, var(--movi-primary) 25%, transparent) !important;
        border-color: color-mix(in srgb, var(--movi-primary) 50%, transparent) !important;
        box-shadow: 0 8px 40px color-mix(in srgb, var(--movi-primary) 30%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--movi-primary) 15%, transparent) !important;
      }

      :host([theme="light"]) .movi-center-play-pause svg {
        filter: drop-shadow(0 0 4px color-mix(in srgb, var(--movi-primary) 30%, transparent)) !important;
      }

      :host([theme="light"]) .movi-center-play-pause:hover svg {
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--movi-primary) 50%, transparent)) !important;
      }

      /* Light Theme Context Menu */
      :host([theme="light"]) .movi-context-menu {
        background: rgba(255, 255, 255, 0.95) !important;
        border-color: rgba(0, 0, 0, 0.1) !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
        color: #11142d !important;
      }

      :host([theme="light"]) .movi-context-menu-item:hover {
        background-color: rgba(0, 0, 0, 0.05) !important;
      }

      :host([theme="light"]) .movi-context-menu-divider {
        background: rgba(0, 0, 0, 0.1) !important;
      }

      :host([theme="light"]) .movi-speed-menu,
      :host([theme="light"]) .movi-audio-track-menu,
      :host([theme="light"]) .movi-subtitle-track-menu,
      :host([theme="light"]) .movi-quality-menu,
      :host([theme="light"]) .movi-context-menu-submenu,
      :host([theme="light"]) .movi-context-menu-submenu-audio,
      :host([theme="light"]) .movi-context-menu-submenu-subtitle {
        background: rgba(255, 255, 255, 0.95) !important;
        border-color: rgba(0, 0, 0, 0.1) !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
        color: #11142d !important;
      }

      /* Light Theme Menu Items Hover */
      :host([theme="light"]) .movi-audio-track-item:hover,
      :host([theme="light"]) .movi-subtitle-track-item:hover,
      :host([theme="light"]) .movi-speed-item:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.08) !important;
      }

      :host([theme="light"]) .movi-audio-track-item.movi-audio-track-active,
      :host([theme="light"]) .movi-subtitle-track-item.movi-subtitle-track-active,
      :host([theme="light"]) .movi-speed-item.movi-speed-active {
        background: color-mix(in srgb, var(--movi-primary) 0.15) !important;
      }

      /* The active item's info badge hard-codes color:var(--movi-controls-color)
         (white) for the dark theme; in light theme that leaves the selected
         track's codec text white-on-light (unreadable). Match the item text. */
      :host([theme="light"]) .movi-audio-track-item.movi-audio-track-active .movi-audio-track-info,
      :host([theme="light"]) .movi-subtitle-track-item.movi-subtitle-track-active .movi-subtitle-track-info {
        color: #11142d !important;
      }

      :host([theme="light"]) .movi-quality-item:hover {
        background: rgba(0, 0, 0, 0.05) !important;
      }

      :host([theme="light"]) .movi-quality-item.movi-quality-active {
        background: color-mix(in srgb, var(--movi-primary) 0.12) !important;
      }

      :host:focus,
      :host:active,
      :host:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
        border: none !important;
        box-shadow: none !important;
      }

      /* Ensure element fills fullscreen viewport */
      :host(:fullscreen) {
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      canvas, video {
        position: relative;
        z-index: 1;
        width: 100%;
        height: 100%;
        display: block;
        object-fit: contain; /* Maintain aspect ratio */
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      /* Ensure canvas fills fullscreen */
      :host(:fullscreen) canvas:not(.movi-nerd-stats-graph),
      :host(:fullscreen) video {
        width: 100vw !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      .movi-controls-container {
        display: none;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 10;
        pointer-events: none;
        transition: opacity var(--movi-transition-normal), transform var(--movi-transition-normal);
        transform: translateY(0);
      }

      .movi-controls-container.movi-controls-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
      }
      
      /* Hide cursor whenever controls are hidden. The overlay (z:1,
         pointer-events:all) sits on top of canvas/video and was
         showing the default cursor — covering canvas/video alone
         wasn't enough. Wildcard inside the host catches the overlay,
         controls-container, title bar, and any other layered child
         without having to enumerate them. */
      :host:has(.movi-controls-container.movi-controls-hidden),
      :host:has(.movi-controls-container.movi-controls-hidden) * {
        cursor: none !important;
      }

      .movi-controls-container.movi-controls-visible {
        opacity: 1;
        pointer-events: none;
        transform: translateY(0);
      }
      
      /* Show normal cursor on canvas when controls are visible */
      :host:has(.movi-controls-container.movi-controls-visible) canvas,
      :host:has(.movi-controls-container.movi-controls-visible) video {
        cursor: default !important;
      }
      
      /* Move timeline panel above controls bar when visible */
      :host:has(.movi-controls-container.movi-controls-visible) .movi-timeline-panel {
        bottom: 125px;
      }

      /* Hide seek thumbnail when timeline is open — prevents z-index overlap */
      :host:has(.movi-timeline-panel[style*="flex"]) .movi-seek-thumbnail {
        display: none !important;
      }

      /* Compact players: when the storyboard timeline (T) is open, hide the
         controls bar so the thumbnail strip gets the whole area, and drop the
         panel into the freed space. Keyed off the panel's inline display:flex
         (same signal as the seek-thumbnail rule above), so every close path
         restores the bar automatically. Desktop keeps the bar visible. */
      @container movi-host (max-width: 720px) {
        :host:has(.movi-timeline-panel[style*="flex"]) .movi-controls-container {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(10px) !important;
        }
        :host:has(.movi-timeline-panel[style*="flex"]) .movi-controls-bar {
          pointer-events: none !important;
        }
        :host:has(.movi-timeline-panel[style*="flex"]) .movi-timeline-panel {
          bottom: 12px !important;
        }
      }

      /* Force enable pointer events on all interactive controls */
      .movi-controls-container.movi-controls-visible .movi-controls-bar,
      .movi-controls-container.movi-controls-visible .movi-controls-bar *,
      .movi-controls-container.movi-controls-visible button,
      .movi-controls-container.movi-controls-visible input {
        pointer-events: auto !important;
      }

      .movi-controls-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        /* Spans the entire player (bottom:0, not bottom:controls-height)
           so its mouseenter/mouseleave catch the cursor crossing any
           edge — including over the controls bar. The controls-container
           sits on z-index:10 (overlay is z:1), so buttons inside the bar
           still receive their clicks; the overlay just provides the hit
           surface for cursor-tracking. The gradient is bottom-anchored
           and fades to transparent in the upper portion, so extending
           the bottom edge under the bar doesn't change how the gradient
           reads visually. */
        bottom: 0;
        pointer-events: all;
        z-index: 1;
        background: var(--movi-overlay-bg);
        opacity: 0;
        transition: opacity var(--movi-transition-normal);
      }
      
      /* Overlay is no longer nested inside .movi-controls-container, so
         the visibility class isn't an ancestor — use :has on the host. */
      :host:has(.movi-controls-container.movi-controls-visible) .movi-controls-overlay {
        opacity: 1;
      }

      /* Unmute pill — surfaces a one-tap path to sound when the player
         autoplayed muted (browser policy). Top-left so it doesn't fight
         with the title bar's text on the gradient OR with the close/PiP
         buttons on the top-right that some integrators add. z-index sits
         above the canvas/overlay but below the controls-container so the
         bottom bar can render over it if they ever collide. */
      .movi-unmute-overlay {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 8;
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: rgba(0, 0, 0, 0.75);
        color: var(--movi-chrome-fg, #fff);
        font-size: 13px;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 999px;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.18s ease, transform 0.18s ease;
        font-family: inherit;
      }
      .movi-unmute-overlay:hover {
        background: rgba(0, 0, 0, 0.9);
        transform: scale(1.03);
      }
      .movi-unmute-overlay svg {
        width: 16px;
        height: 16px;
      }
      @container movi-host (max-width: 480px) {
        .movi-unmute-overlay {
          top: 10px;
          left: 10px;
          padding: 6px 11px;
          font-size: 12px;
        }
        .movi-unmute-overlay svg { width: 14px; height: 14px; }
      }

      .movi-title-bar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        /* Extra right padding keeps the title text from running under the
           settings gear pinned in the top-right corner. */
        padding: 16px 62px 16px 20px;
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
        z-index: 5;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
      }

      .movi-title-bar.movi-title-visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* Settings gear (top-right) — opens the context menu. Vertically centred
         on the title text (title padding-top 16px + ~half the ~20px line) and
         inset to match; the title bar reserves right padding so the title
         doesn't run under it. */
      .movi-gear-btn {
        position: absolute;
        top: 9px;
        right: 14px;
        z-index: 30;
        width: 38px;
        height: 38px;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
        color: var(--movi-chrome-fg, #fff);
        background: rgba(0, 0, 0, 0.35);
        border-radius: 50%;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
        pointer-events: none;
      }
      .movi-gear-btn.movi-gear-visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
        pointer-events: auto;
      }
      /* Hide the gear while a bottom dropdown OR the storyboard timeline is
         open — it lives in a higher stacking context than either and would
         otherwise paint over them. */
      :host(.movi-bottom-menu-open) .movi-gear-btn,
      :host:has(.movi-timeline-panel[style*="flex"]) .movi-gear-btn {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      .movi-gear-btn:hover {
        background: rgba(0, 0, 0, 0.55);
      }
      .movi-gear-btn svg {
        width: 22px;
        height: 22px;
      }
      /* The gear is a TOUCH affordance — it only exists because touch has no
         right-click and the long-press context menu is gated. On non-touch
         (mouse/hover) devices, right-clicking the video opens the same menu,
         so the gear is redundant chrome; hide it there. (Mirrors the VR pad,
         which does the inverse — hidden on touch, shown on desktop.) */
      @media (hover: hover) and (pointer: fine) {
        .movi-gear-btn {
          display: none !important;
        }
      }

      /* Press-and-hold-to-2x pill (top-centre, shown only while held). */
      .movi-hold-speed {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 40;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: rgba(0, 0, 0, 0.6);
        color: var(--movi-chrome-fg, #fff);
        border-radius: 999px;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.02em;
        pointer-events: none;
      }
      .movi-hold-speed svg {
        width: 14px;
        height: 14px;
      }

      .movi-title-text {
        color: var(--movi-controls-color);
        font-size: clamp(16px, 4vw, 20px);
        font-weight: 500;
        display: block;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.4;
      }

      .movi-controls-bar {
        position: relative;
        pointer-events: auto !important;
        z-index: 10 !important;
        display: flex;
        flex-direction: column;
        padding: 4px 20px 12px;
        background: var(--movi-bar-bg);
        color: var(--movi-controls-color);
        height: auto;
        min-height: var(--movi-controls-height);
        /* Hairline top accent. Reads as a separator between video
           and chrome the way YouTube's progress bar does, but with a
           wider feel since our progress bar sits inside the bar. */
        box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
      }

      /* Light theme bar uses the same dark gradient — keep the
         hairline accent so the separator between video and chrome
         is just as visible. */
      :host([theme="light"]) .movi-controls-bar {
        box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
      }

      .movi-progress-container {
        width: 100%;
        padding: 10px 0 15px;
        display: flex;
        align-items: center;
        position: relative;
      }

      .movi-buttons-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 16px;
      }

      .movi-controls-left,
      .movi-controls-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }

      .movi-btn {
        background: transparent;
        border: none;
        color: var(--movi-controls-color);
        cursor: pointer;
        padding: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--movi-btn-size);
        height: var(--movi-btn-size);
        border-radius: 50%;
        transition: all var(--movi-transition-fast);
        pointer-events: auto !important;
        outline: none !important;
      }

      .movi-btn:hover {
        /* Sober hover: neutral tint over the bar instead of a colour
           splash, plus a barely-there lift. The aggressive 1.1 scale
           was reading as "jumpy" against the calm surface. */
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.06);
      }

      /* Light theme bar is now dark too (see --movi-bar-bg), so the
         hover tint should also be the light-on-dark variant — the
         old dark-on-light tint disappeared into the new dark bar. */
      :host([theme="light"]) .movi-controls-bar .movi-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .movi-btn:active {
        transform: scale(0.94);
        transition-duration: 0.08s;
      }

      .movi-btn:focus,
      .movi-btn:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
        outline-width: 0 !important;
        outline-style: none !important;
        outline-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-focus-ring-color: transparent !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      /* Remove Firefox button inner border */
      .movi-btn::-moz-focus-inner {
        border: 0 !important;
        outline: none !important;
        padding: 0;
      }

      .movi-btn svg {
        width: 22px;
        height: 22px;
        transition: transform var(--movi-transition-fast);
      }
      
      .movi-btn:hover svg {
        /* Removed the purple glow drop-shadow on icons. Combined with
           the new neutral hover backdrop it was overdoing the chrome
           — the backdrop alone reads as "interactive" without making
           the icon look like it's lighting up. */
      }

      /* 360° on-screen pan joystick (YouTube-style), top-left. Hidden unless
         360 is active AND the controls are visible. */
      .movi-vr360-pad {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 11;
        width: 76px;
        height: 76px;
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--movi-transition-normal), top var(--movi-transition-normal);
        touch-action: none;
      }
      /* Opt-in via the vrpad attribute. Without it the pad never shows —
         drag-to-look already covers desktop navigation; the pad is
         for those who want a YouTube-style continuous-pan compass. */
      :host(.movi-vr360-active[vrpad]) .movi-vr360-pad {
        opacity: 1;
        pointer-events: auto;
      }
      /* Sit below the title bar so they never overlap. Keyed on the showtitle
         feature (not the title's transient visibility) so the pad position
         stays put as the controls/title fade — no snap up over the title. */
      :host(.movi-vr360-active[showtitle]) .movi-vr360-pad {
        top: 60px;
      }
      /* Fold away with the controls when they auto-hide. */
      :host(.movi-vr360-active):has(.movi-controls-container.movi-controls-hidden) .movi-vr360-pad {
        opacity: 0;
        pointer-events: none;
      }
      /* Never on touch / coarse-pointer devices — there you just drag the video. */
      @media (hover: none), (pointer: coarse) {
        .movi-vr360-pad { display: none !important; }
      }
      .movi-vr360-pad-ring {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.55);
        border: 1.5px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        cursor: grab;
      }
      .movi-vr360-pad-ring:active {
        cursor: grabbing;
      }
      .movi-vr360-pad-arrow {
        position: absolute;
        color: rgba(255, 255, 255, 0.55);
        font-size: 9px;
        line-height: 1;
        pointer-events: none;
        user-select: none;
      }
      .movi-vr360-pad-arrow-n { top: 4px; left: 50%; transform: translateX(-50%); }
      .movi-vr360-pad-arrow-s { bottom: 4px; left: 50%; transform: translateX(-50%); }
      .movi-vr360-pad-arrow-w { left: 5px; top: 50%; transform: translateY(-50%); }
      .movi-vr360-pad-arrow-e { right: 5px; top: 50%; transform: translateY(-50%); }
      .movi-vr360-pad-knob {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 30px;
        height: 30px;
        margin: -15px 0 0 -15px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
        transition: transform 0.18s ease-out;
        pointer-events: none;
      }
      .movi-vr360-pad.movi-vr360-pad-dragging .movi-vr360-pad-knob {
        transition: none;
      }
      /* In 360° the canvas is a draggable viewport. Grab cursor + disable
         browser touch panning so one-finger drags look around instead of
         scrolling the page. */
      :host(.movi-vr360-active) .movi-controls-overlay,
      :host(.movi-vr360-active) canvas {
        cursor: grab;
        touch-action: none;
      }
      :host(.movi-vr360-active) .movi-controls-overlay:active,
      :host(.movi-vr360-active) canvas:active {
        cursor: grabbing;
      }

      .movi-icon-play {
        margin-left: 2px;
      }

      .movi-time {
        font-size: 13px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        letter-spacing: 0.01em;
        /* Total duration sits secondary; the current-time override
           below promotes the playhead to primary so the eye can find
           it without scanning. */
        color: var(--movi-text-secondary);
        display: inline-flex;
        align-items: baseline;
        gap: 4px;
      }

      .movi-current-time {
        color: var(--movi-controls-color);
        font-weight: 600;
      }

      .movi-time-separator {
        color: var(--movi-text-tertiary);
        font-weight: 400;
      }

      /* LIVE indicator — shown only for live (dynamic) streams. Clicking jumps
         to the live edge. Bright red + pulsing at the edge; dimmed grey when
         the viewer has scrubbed back into the DVR window. */
      /* Badge follows the player theme colour (themecolor / --movi-primary),
         falling back to a live-red. The dot inherits it via currentColor so the
         glow ring matches. When scrubbed back ("behind") it dims to grey. */
      .movi-live-badge {
        display: none;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        font: inherit;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--movi-primary, #ff4d4f);
        line-height: 1;
      }
      .movi-live-badge:hover { background: rgba(255, 255, 255, 0.12); }
      .movi-live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        /* Blink while at the live edge. */
        animation: movi-live-blink 1.2s ease-in-out infinite;
      }
      .movi-live-badge.behind { color: var(--movi-text-tertiary); }
      .movi-live-badge.behind .movi-live-dot {
        /* Scrubbed back into the DVR window → steady grey dot, no blink. */
        animation: none;
        opacity: 1;
      }
      @keyframes movi-live-blink {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.15; }
      }
      @media (prefers-reduced-motion: reduce) {
        .movi-live-dot { animation: none; }
      }
      /* Live mode: wall-clock duration is meaningless (Infinity) — show only
         the LIVE badge, hide the running time / separator / duration. */
      :host(.movi-live) .movi-current-time,
      :host(.movi-live) .movi-time-separator,
      :host(.movi-live) .movi-duration { display: none; }
      :host(.movi-live) .movi-live-badge { display: inline-flex; }

      .movi-progress-container {
        width: 100%;
        padding: 10px 0 15px;
        display: flex;
        align-items: center;
        position: relative;
      }

      .movi-progress-bar {
        position: relative;
        width: 100%;
        height: var(--movi-progress-height);
        min-height: 4px;
        background: var(--movi-progress-bg);
        border-radius: 100px;
        cursor: pointer;
        pointer-events: auto !important;
        z-index: 11 !important;
        outline: none !important;
        border: none;
        /* Slightly slower than --movi-transition-fast — the height
           change is the user's *signal* that the bar is interactive,
           so it should breathe rather than snap. */
        transition: height 0.18s cubic-bezier(0.4, 0, 0.2, 1), background 0.18s ease;
        overflow: visible;
      }

      .movi-progress-bar:hover {
        height: var(--movi-progress-height-hover);
        background: rgba(255, 255, 255, 0.25);
      }

      .movi-progress-bar:focus,
      .movi-progress-bar:active,
      .movi-progress-bar:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
        outline-width: 0 !important;
        outline-style: none !important;
        outline-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-focus-ring-color: transparent !important;
        -webkit-tap-highlight-color: transparent !important;
      }

      .movi-progress-filled {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--movi-primary);
        border-radius: 100px;
        width: 0%;
        transition: width 0.1s linear;
      }

      .movi-chapter-markers {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100%;
        z-index: 3;
        pointer-events: none;
      }

      .movi-chapter-marker {
        position: absolute;
        top: 0;
        width: 3px;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        transform: translateX(-1.5px);
        border-radius: 1px;
        z-index: 3;
      }

      .movi-chapter-segment {
        position: absolute;
        top: 0;
        height: 100%;
        pointer-events: none;
        border-radius: 100px;
      }

      .movi-chapter-segment--intro {
        background: rgb(217 70 239 / 0.42);
      }

      .movi-chapter-segment--recap {
        background: rgb(245 158 11 / 0.42);
      }

      .movi-chapter-segment--credits {
        background: rgb(99 102 241 / 0.42);
      }

      .movi-chapter-segment--preview {
        background: rgb(34 197 94 / 0.42);
      }

      .movi-progress-buffer {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: rgba(255, 255, 255, 0.25);
        border-radius: 100px;
        width: 0%;
        /* No transition: animating width across the brief post-seek window
           where the source's buffered-end is still stale produced a
           "scan" sweep that then snapped back. State updates should
           reflect instantly. */
      }

      .movi-progress-handle {
        position: absolute;
        top: 50%;
        left: 0%;
        transform: translate(-50%, -50%) scale(0);
        width: 16px;
        height: 16px;
        background: var(--movi-controls-color);
        border-radius: 50%;
        opacity: 0;
        transition: all var(--movi-transition-fast);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 3px color-mix(in srgb, var(--movi-primary) 30%, transparent);
        z-index: 5;
      }

      .movi-progress-bar:hover .movi-progress-handle {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }

      .movi-progress-handle:active {
        transform: translate(-50%, -50%) scale(1.2);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4), 0 0 0 5px color-mix(in srgb, var(--movi-primary) 40%, transparent);
      }

      /* Always show progress handle on touch devices */
      @media (hover: none) and (pointer: coarse) {
        .movi-progress-handle {
          opacity: 1 !important;
          transform: translate(-50%, -50%) scale(1) !important;
          transition: none !important;
        }
      }

      .movi-volume-container {
        display: flex;
        align-items: center;
        gap: 4px;
        height: 100%;
      }

      .movi-volume-slider-container {
        width: 0;
        overflow: hidden;
        transition: all var(--movi-transition-normal);
        padding: 8px 0;
        box-sizing: content-box;
        display: flex;
        align-items: center;
        opacity: 0;
      }

      .movi-volume-container:hover .movi-volume-slider-container,
      .movi-volume-container.active .movi-volume-slider-container {
        width: 80px !important;
        padding: 8px 8px;
        overflow: visible;
        opacity: 1 !important;
      }

      .movi-volume-slider {
        width: 100%;
        height: 4px;
        -webkit-appearance: none;
        appearance: none;
        /* Two-tone track: primary up to thumb, muted past it. The
           hard stop at --movi-volume-pct (set in JS on every volume
           change) means there's no anti-aliased blur where the two
           colours meet. */
        background: linear-gradient(
          to right,
          var(--movi-primary) 0%,
          var(--movi-primary) var(--movi-volume-pct, 100%),
          rgba(255, 255, 255, 0.2) var(--movi-volume-pct, 100%),
          rgba(255, 255, 255, 0.2) 100%
        );
        border-radius: 100px;
      }
      /* Boosting above 100% (VLC-style): amber fill flags the boost zone, and
         a tick at the 50%-of-track unity point marks where "normal" sits. */
      .movi-volume-slider.movi-volume-boosted {
        background: linear-gradient(
          to right,
          var(--movi-primary) 0%,
          var(--movi-primary) 50%,
          var(--movi-volume-boost, #f5a623) 50%,
          var(--movi-volume-boost, #f5a623) var(--movi-volume-pct, 100%),
          rgba(255, 255, 255, 0.2) var(--movi-volume-pct, 100%),
          rgba(255, 255, 255, 0.2) 100%
        );
        outline: none !important;
        pointer-events: auto !important;
        cursor: pointer;
        position: relative;
        z-index: 11 !important;
        margin: 0;
        padding: 0;
        border: none;
        vertical-align: middle;
      }

      .movi-volume-slider:focus,
      .movi-volume-slider:active,
      .movi-volume-slider:focus-visible {
        outline: none !important;
        outline-offset: 0 !important;
        outline-width: 0 !important;
        outline-style: none !important;
        outline-color: transparent !important;
        border: none !important;
        box-shadow: none !important;
        -webkit-focus-ring-color: transparent !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      
      /* Remove Firefox input inner border */
      .movi-volume-slider::-moz-focus-inner {
        border: 0 !important;
        outline: none !important;
      }

      .movi-volume-slider::-webkit-slider-runnable-track {
        height: 4px;
        /* Track must be transparent so the input's gradient
           background (filled-vs-rest) shows through. */
        background: transparent;
        border-radius: 100px;
      }

      .movi-volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: var(--movi-chrome-fg, #fff);
        border-radius: 50%;
        cursor: pointer;
        margin-top: -5px;
        outline: none !important;
        border: none !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        transition: transform var(--movi-transition-fast), box-shadow var(--movi-transition-fast);
      }
      
      .movi-volume-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 3px color-mix(in srgb, var(--movi-primary) 0.3);
      }
      
      .movi-volume-slider::-webkit-slider-thumb:focus,
      .movi-volume-slider::-webkit-slider-thumb:active {
        outline: none !important;
        border: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 3px color-mix(in srgb, var(--movi-primary) 0.3);
      }

      .movi-volume-slider::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: var(--movi-chrome-fg, #fff);
        border-radius: 50%;
        cursor: pointer;
        border: none !important;
        outline: none !important;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      }
      
      .movi-volume-slider::-moz-range-thumb:focus,
      .movi-volume-slider::-moz-range-thumb:active {
        outline: none !important;
        border: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 3px color-mix(in srgb, var(--movi-primary) 0.3);
      }
      
      .movi-volume-slider::-moz-range-track {
        height: 4px;
        /* Same as the webkit track — let the input's gradient show. */
        background: transparent;
        border-radius: 100px;
      }

      .movi-audio-track-container {
        position: relative;
        display: none;
        align-items: center;
        margin-left: 4px;
      }

      .movi-audio-track-btn {
        display: none;
      }

      .movi-audio-track-menu,
      .movi-subtitle-track-menu {
        position: absolute;
        bottom: calc(100% + 12px);
        right: 0;
        background: var(--movi-glass-bg);
        border: 1px solid var(--movi-glass-border);
        border-radius: 14px;
        min-width: 260px;
        max-width: 340px;
        /* Capped against the PLAYER's own height (--movi-player-height
           is set by JS on connect/resize) — minus a controls-bar
           reserve so the menu never extends below the player. Falls
           back to 460px / 70vh if the variable isn't yet set. */
        max-height: min(
          calc(var(--movi-player-height, 70vh) - 100px),
          460px
        );
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: var(--movi-shadow-lg);
        z-index: 1000;
      }

      /* Pop-in animation shared by all bottom-bar dropdowns. The default
         (no .is-open) state is the "closed" rest position; setBottomMenuOpen
         in MoviElement adds .is-open to play the entrance and removes it to
         play the exit. inline display:none stays the truly-hidden terminal
         state — toggled around the transition by the helper.
         Transform is composed from custom props so other layers (e.g.
         the mobile media query, which centres the menu via translateX
         on its own --movi-menu-tx axis) can stack with the animation
         instead of fighting !important against it. */
      .movi-audio-track-menu,
      .movi-subtitle-track-menu,
      .movi-quality-menu,
      .movi-speed-menu {
        --movi-menu-tx: 0px;
        --movi-menu-ty: 8px;
        --movi-menu-scale: 0.97;
        opacity: 0;
        transform: translateX(var(--movi-menu-tx)) translateY(var(--movi-menu-ty)) scale(var(--movi-menu-scale));
        transform-origin: bottom right;
        transition:
          opacity 180ms cubic-bezier(0.16, 1, 0.3, 1),
          transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none !important;
        will-change: opacity, transform;
      }

      .movi-audio-track-menu.is-open,
      .movi-subtitle-track-menu.is-open,
      .movi-quality-menu.is-open,
      .movi-speed-menu.is-open {
        --movi-menu-ty: 0px;
        --movi-menu-scale: 1;
        opacity: 1;
        pointer-events: auto !important;
      }

      /* Fade the customize panel's content swap so toggling the gear
         doesn't snap between the track list and the settings UI. */
      @keyframes movi-sub-list-fade {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: none; }
      }
      .movi-subtitle-track-list.movi-fade-in {
        animation: movi-sub-list-fade 160ms cubic-bezier(0.16, 1, 0.3, 1);
      }

      .movi-track-menu-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px 10px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--movi-text-tertiary);
        border-bottom: 1px solid var(--movi-glass-border);
        flex-shrink: 0;
      }

      .movi-track-menu-header svg {
        width: 14px;
        height: 14px;
        opacity: 0.85;
      }

      /* Gear icon at the top-right of the Subtitles header opens the
         customize panel. Toggling it returns to the track list. */
      .movi-subtitle-track-header {
        position: relative;
      }

      .movi-subtitle-track-header > span {
        flex: 1;
      }

      .movi-subtitle-customize-btn,
      .movi-subtitle-browse-btn {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        color: var(--movi-controls-color);
        opacity: 0.7;
        transition: background var(--movi-transition-fast), opacity var(--movi-transition-fast), color var(--movi-transition-fast);
      }

      .movi-subtitle-customize-btn:hover,
      .movi-subtitle-browse-btn:hover {
        background: color-mix(in srgb, var(--movi-controls-color) 0.1, transparent);
        opacity: 1;
      }

      .movi-subtitle-browse-btn svg {
        width: 16px;
        height: 16px;
      }

      .movi-subtitle-customize-btn.is-active,
      .movi-subtitle-customize-btn[aria-pressed="true"] {
        color: var(--movi-primary);
        opacity: 1;
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
      }

      .movi-subtitle-customize-btn svg {
        width: 16px;
        height: 16px;
        opacity: 1;
      }

      .movi-track-menu-footer {
        padding: 8px 16px 10px;
        font-size: 11px;
        color: var(--movi-text-tertiary);
        border-top: 1px solid var(--movi-glass-border);
        flex-shrink: 0;
        text-align: center;
        opacity: 0.75;
      }

      .movi-track-menu-footer:empty {
        display: none;
      }

      .movi-audio-track-list,
      .movi-subtitle-track-list {
        padding: 6px;
        overflow-y: auto;
        overscroll-behavior: contain;
        /* Bound the list directly off the player's own height (minus
           ~180px of chrome: header + footer + the controls-bar reserve
           the parent menu also subtracts). Capped at 360px on tall
           players. Bypasses flex shrinking quirks: the list ALWAYS has
           a concrete max-height so overflow-y kicks in cleanly.
           Mobile media query below overrides this with max-height:
           none so the outer menu's single scrollbar handles long
           lists on small screens. */
        max-height: min(
          calc(var(--movi-player-height, 70vh) - 180px),
          360px
        );
        flex: 1 1 auto;
        min-height: 0;
        scrollbar-width: thin;
        scrollbar-color: color-mix(in srgb, var(--movi-controls-color) 0.35, transparent) transparent;
      }

      /* Always-visible thin scrollbar so users can see at a glance that
         long track lists (16+ languages) keep going below the fold. */
      .movi-audio-track-list::-webkit-scrollbar,
      .movi-subtitle-track-list::-webkit-scrollbar {
        width: 6px;
      }
      .movi-audio-track-list::-webkit-scrollbar-track,
      .movi-subtitle-track-list::-webkit-scrollbar-track {
        background: transparent;
      }
      .movi-audio-track-list::-webkit-scrollbar-thumb,
      .movi-subtitle-track-list::-webkit-scrollbar-thumb {
        background: color-mix(in srgb, var(--movi-controls-color) 0.28, transparent);
        border-radius: 3px;
      }
      .movi-audio-track-list::-webkit-scrollbar-thumb:hover,
      .movi-subtitle-track-list::-webkit-scrollbar-thumb:hover {
        background: color-mix(in srgb, var(--movi-controls-color) 0.5, transparent);
      }

      .movi-audio-track-item,
      .movi-subtitle-track-item {
        position: relative;
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: var(--movi-controls-color);
        transition: background var(--movi-transition-fast);
        gap: 10px;
        min-width: 0;
        font-size: 14px;
        border-radius: 8px;
        margin: 1px 0;
      }

      .movi-audio-track-item:hover,
      .movi-subtitle-track-item:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.12, transparent);
      }

      .movi-audio-track-item.movi-audio-track-active,
      .movi-subtitle-track-item.movi-subtitle-track-active {
        background: color-mix(in srgb, var(--movi-primary) 0.22, transparent);
        font-weight: 600;
      }

      .movi-track-item-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: var(--movi-text-tertiary);
        opacity: 0.85;
      }

      .movi-audio-track-item.movi-audio-track-active .movi-track-item-icon,
      .movi-subtitle-track-item.movi-subtitle-track-active .movi-track-item-icon {
        color: var(--movi-primary);
        opacity: 1;
      }

      .movi-track-item-check {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        color: var(--movi-primary);
        opacity: 0;
      }

      .movi-audio-track-item.movi-audio-track-active .movi-track-item-check,
      .movi-subtitle-track-item.movi-subtitle-track-active .movi-track-item-check {
        opacity: 1;
      }

      .movi-audio-track-label,
      .movi-subtitle-track-label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .movi-audio-track-info,
      .movi-subtitle-track-info {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--movi-text-tertiary);
        flex-shrink: 0;
        white-space: nowrap;
        padding: 3px 8px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--movi-controls-color) 0.08, transparent);
        border: 1px solid color-mix(in srgb, var(--movi-controls-color) 0.08, transparent);
      }

      .movi-audio-track-item.movi-audio-track-active .movi-audio-track-info,
      .movi-subtitle-track-item.movi-subtitle-track-active .movi-subtitle-track-info {
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
        border-color: color-mix(in srgb, var(--movi-primary) 0.3, transparent);
        color: var(--movi-controls-color);
      }

      .movi-subtitle-track-container {
        position: relative;
        display: none; /* Hidden by default, shown when subtitle tracks available */
        align-items: center;
        margin-left: 4px;
      }

      .movi-subtitle-track-divider {
        height: 1px;
        background: var(--movi-glass-border);
        margin: 6px 4px;
        opacity: 0.7;
      }

      .movi-subtitle-customize-item {
        opacity: 0.92;
      }

      .movi-sub-cust-panel {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 14px 14px 12px;
      }

      /* Back-to-list pill at the top of the customize panel. The negative
         left margin pulls the chevron flush with the section content's
         left edge — without it, the pill's own padding shifts the icon
         ~8px right of every other label below and reads as misaligned. */
      .movi-sub-cust-back {
        all: unset;
        cursor: pointer;
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        margin-left: -10px;
        margin-bottom: -8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--movi-text-secondary);
        background: color-mix(in srgb, var(--movi-controls-color) 0.06, transparent);
        border-radius: 999px;
        transition: background var(--movi-transition-fast), color var(--movi-transition-fast);
      }

      .movi-sub-cust-back:hover {
        color: var(--movi-controls-color);
        background: color-mix(in srgb, var(--movi-primary) 0.16, transparent);
      }

      .movi-sub-cust-back svg {
        flex-shrink: 0;
      }

      /* Live preview — sample text rendered using the EXACT same look
         the in-video subtitle will get. Always a dark-ish "video"
         backdrop (regardless of theme) so user-selected text colors
         and shadows render in a realistic context — subtitles are
         designed to sit on a dark video frame. */
      .movi-sub-cust-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 86px;
        border-radius: 10px;
        overflow: hidden;
        background:
          linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0)),
          repeating-conic-gradient(
            rgba(255,255,255,0.04) 0% 25%,
            rgba(255,255,255,0.02) 0% 50%
          ),
          var(--movi-surface, #1a1a1a);
        background-size: auto, 16px 16px, auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .movi-sub-cust-preview-stage {
        padding: 12px 16px;
      }

      .movi-sub-cust-preview-block {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 4px;
      }

      .movi-sub-cust-preview-line {
        font-family: 'YouTube Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-weight: 500;
        line-height: 1.35;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .movi-sub-cust-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .movi-sub-cust-section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
      }

      .movi-sub-cust-section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--movi-controls-color);
        letter-spacing: 0;
        text-transform: none;
      }

      .movi-sub-cust-section-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--movi-primary);
        font-variant-numeric: tabular-nums;
      }

      /* Range slider — themed thumb in primary color, visible rail.
         color-mix() rendered the rail as effectively transparent in
         some Chromium builds, so the rail uses plain rgba() now. */
      .movi-sub-cust-range {
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        display: block;
        width: 100%;
        height: 22px;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
        outline: none;
      }

      .movi-sub-cust-range::-webkit-slider-runnable-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        /* Rail color via CSS variable so light theme can swap it
           without fighting pseudo-element specificity. */
        background: var(--movi-sub-cust-rail, rgba(255, 255, 255, 0.22));
        border: none;
      }

      .movi-sub-cust-range::-webkit-slider-thumb {
        appearance: none;
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--movi-primary);
        border: 3px solid var(--movi-chrome-fg, #FFFFFF);
        margin-top: -6px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        cursor: pointer;
        transition: transform var(--movi-transition-fast);
      }

      .movi-sub-cust-range::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }

      .movi-sub-cust-range::-moz-range-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: var(--movi-sub-cust-rail, rgba(255, 255, 255, 0.22));
        border: none;
      }

      .movi-sub-cust-range::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--movi-primary);
        border: 3px solid var(--movi-chrome-fg, #FFFFFF);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        cursor: pointer;
      }

      .movi-sub-cust-range::-moz-range-progress {
        height: 6px;
        border-radius: 999px;
        background: var(--movi-primary);
      }

      :host([theme="light"]) {
        /* Slider rail color overridden via the host — :host(...) X::pseudo
           selectors don't reliably target ::-webkit-slider-runnable-track
           across browsers, but a CSS variable on the host cascades into
           the shadow DOM cleanly. */
        --movi-sub-cust-rail: rgba(0, 0, 0, 0.35);
      }

      :host([theme="light"]) .movi-sub-cust-range::-webkit-slider-thumb,
      :host([theme="light"]) .movi-sub-cust-range::-moz-range-thumb {
        border-color: rgba(255, 255, 255, 0.95);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(0, 0, 0, 0.1);
      }

      /* Light-theme readability for the customize panel — without these
         the labels inherit a faded color and disappear against the
         glass-bg. */
      :host([theme="light"]) .movi-sub-cust-section-title {
        color: #11142d;
      }

      /* Gear icon contrast — default opacity 0.7 reads as nearly
         white-on-white in light theme. Force full opacity + dark
         color for proper visibility. */
      :host([theme="light"]) .movi-subtitle-customize-btn {
        color: #11142d;
        opacity: 1;
      }

      :host([theme="light"]) .movi-subtitle-customize-btn:hover {
        background: rgba(0, 0, 0, 0.06);
      }

      :host([theme="light"]) .movi-subtitle-customize-btn.is-active,
      :host([theme="light"]) .movi-subtitle-customize-btn[aria-pressed="true"] {
        color: var(--movi-primary);
        background: color-mix(in srgb, var(--movi-primary) 0.16, transparent);
      }

      :host([theme="light"]) .movi-sub-cust-back {
        color: #11142d;
        background: rgba(0, 0, 0, 0.05);
      }

      :host([theme="light"]) .movi-sub-cust-back:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.16, rgba(0,0,0,0.04));
      }

      :host([theme="light"]) .movi-sub-cust-reset {
        color: #11142d;
        background: rgba(0, 0, 0, 0.06);
      }

      :host([theme="light"]) .movi-sub-cust-reset:hover {
        color: var(--movi-primary);
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
      }

      :host([theme="light"]) .movi-sub-cust-swatch {
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.5),
          0 0 0 0 transparent;
      }

      :host([theme="light"]) .movi-sub-cust-swatch.is-active {
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.5),
          0 0 0 3px var(--movi-primary);
      }

      /* Subtitle-shift buttons inherit color from the controls color
         var which doesn't always cascade reliably across the customize
         panel; force visible dark text + light-bg pill in light theme. */
      :host([theme="light"]) .movi-sub-cust-shift-btn {
        color: #11142d;
        background: rgba(0, 0, 0, 0.06);
        border-color: rgba(0, 0, 0, 0.1);
      }

      :host([theme="light"]) .movi-sub-cust-shift-btn:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.16, rgba(0, 0, 0, 0.04));
        border-color: color-mix(in srgb, var(--movi-primary) 0.4, rgba(0, 0, 0, 0.1));
      }

      :host([theme="light"]) .movi-sub-cust-shift-zero {
        color: rgba(0, 0, 0, 0.5);
      }

      /* Color swatch grid — generously tappable, primary-ring on active. */
      .movi-sub-cust-swatch-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 8px;
      }

      .movi-sub-cust-swatch {
        all: unset;
        cursor: pointer;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        background: var(--swatch);
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.5),
          0 0 0 0 transparent;
        transition: transform var(--movi-transition-fast), box-shadow var(--movi-transition-fast);
      }

      .movi-sub-cust-swatch:hover {
        transform: scale(1.08);
      }

      .movi-sub-cust-swatch.is-active {
        box-shadow:
          inset 0 0 0 1px rgba(0, 0, 0, 0.5),
          0 0 0 3px var(--movi-primary);
      }

      /* Edge style tiles — each tile shows the actual effect on a
         sample "Aa" so the user picks by what they SEE. */
      .movi-sub-cust-edge-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }

      .movi-sub-cust-edge-tile {
        all: unset;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 6px 10px;
        border-radius: 10px;
        /* Always-dark tile background so the white "Aa" sample (which
           shows the actual edge effect) keeps proper contrast in
           light theme too. */
        background: #181a20;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: background var(--movi-transition-fast), border-color var(--movi-transition-fast);
      }

      .movi-sub-cust-edge-tile:hover {
        background: #22252e;
        border-color: color-mix(in srgb, var(--movi-primary) 0.5, rgba(255,255,255,0.08));
      }

      .movi-sub-cust-edge-tile.is-active {
        background: #22252e;
        border-color: var(--movi-primary);
        box-shadow: 0 0 0 1px var(--movi-primary);
      }

      .movi-sub-cust-edge-tile .movi-sub-cust-edge-name {
        color: rgba(255, 255, 255, 0.55);
      }

      .movi-sub-cust-edge-tile.is-active .movi-sub-cust-edge-name {
        color: #FFFFFF;
      }

      .movi-sub-cust-edge-sample {
        font-family: 'YouTube Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        font-size: 22px;
        font-weight: 700;
        color: #FFFFFF;
        line-height: 1;
      }

      .movi-sub-cust-edge-name {
        font-size: 11px;
        font-weight: 500;
        color: var(--movi-text-tertiary);
        letter-spacing: 0.02em;
      }

      /* Editable readout (number input + "s" suffix) sitting in the
         section header. Looks like a flat readout but accepts custom
         values for fine drift correction. */
      .movi-sub-cust-shift-input-wrap {
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        padding: 2px 6px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--movi-controls-color) 0.06, transparent);
        transition: background var(--movi-transition-fast);
      }

      .movi-sub-cust-shift-input-wrap:focus-within {
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
        outline: 1px solid color-mix(in srgb, var(--movi-primary) 0.5, transparent);
      }

      .movi-sub-cust-shift-input {
        all: unset;
        width: 5.5ch;
        text-align: right;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--movi-primary);
        cursor: text;
      }

      /* Hide the spinner buttons on Chromium / Firefox — keyboard or
         the preset pills are how we want users to nudge values. */
      .movi-sub-cust-shift-input::-webkit-outer-spin-button,
      .movi-sub-cust-shift-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .movi-sub-cust-shift-input {
        -moz-appearance: textfield;
      }

      .movi-sub-cust-shift-input-suffix {
        font-size: 12px;
        font-weight: 600;
        color: var(--movi-primary);
      }

      :host([theme="light"]) .movi-sub-cust-shift-input-wrap {
        background: rgba(0, 0, 0, 0.06);
      }

      /* Subtitle-shift controls — five compact buttons in one row.
         The middle "0" is treated as a soft reset for timing only. */
      .movi-sub-cust-shift-controls {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
      }

      .movi-sub-cust-shift-btn {
        all: unset;
        cursor: pointer;
        text-align: center;
        padding: 8px 6px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--movi-controls-color);
        background: color-mix(in srgb, var(--movi-controls-color) 0.08, transparent);
        border: 1px solid color-mix(in srgb, var(--movi-controls-color) 0.1, transparent);
        transition: background var(--movi-transition-fast), border-color var(--movi-transition-fast), transform var(--movi-transition-fast);
      }

      .movi-sub-cust-shift-btn:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.16, transparent);
        border-color: color-mix(in srgb, var(--movi-primary) 0.4, transparent);
      }

      .movi-sub-cust-shift-btn:active {
        transform: scale(0.96);
      }

      .movi-sub-cust-shift-zero {
        color: var(--movi-text-tertiary);
      }

      /* Empty-state when no track is selected. */
      .movi-sub-cust-empty {
        padding: 28px 12px;
        text-align: center;
        font-size: 12px;
        color: var(--movi-text-tertiary);
      }

      /* Footer — single, prominent reset action. */
      .movi-sub-cust-footer {
        display: flex;
        justify-content: center;
        padding-top: 4px;
        border-top: 1px solid color-mix(in srgb, var(--movi-controls-color) 0.06, transparent);
        margin-top: 2px;
        padding-top: 14px;
      }

      .movi-sub-cust-reset {
        all: unset;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: var(--movi-controls-color);
        padding: 8px 16px;
        border-radius: 8px;
        background: color-mix(in srgb, var(--movi-controls-color) 0.06, transparent);
        transition: background var(--movi-transition-fast), color var(--movi-transition-fast);
      }

      .movi-sub-cust-reset:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
        color: var(--movi-primary);
      }

      .movi-subtitle-track-btn {
        display: none; /* Hidden by default, shown when subtitle tracks available */
      }
      
      /* HDR Button Styling */
      .movi-hdr-container {
        display: flex;
        align-items: center;
        position: relative;
      }
      
      .movi-hdr-btn {
        display: none; /* Hidden by default, shown when HDR content is detected */
        align-items: center;
        justify-content: center;
        padding: 0 12px !important; /* Force override of .movi-btn padding */
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0.9;
        width: auto !important;
        height: 28px !important;
        margin: 0;
        box-sizing: border-box;
      }
      
      .movi-hdr-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }
      
      .movi-hdr-active {
        background: #fff !important;
        border-color: #fff;
        opacity: 1;
        box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
      }
      
      .movi-hdr-active .movi-hdr-label {
        color: #000 !important;
      }
      
      .movi-hdr-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: var(--movi-chrome-fg, #fff);
        line-height: 1;
        text-transform: uppercase;
      }
      
      .movi-icon-hdr {
        display: none; /* Hide icon for now as pill text is cleaner */
      }
      
      .movi-hdr-status {
        font-size: 10px;
        background: rgba(255, 255, 255, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: auto;
        font-weight: 600;
      }
      
      .movi-context-menu-active .movi-hdr-status {
        background: rgba(255, 255, 255, 0.2);
      }

      .movi-speed-container {
        position: relative;
        display: flex;
        align-items: center;
        margin-left: 8px;
      }

      .movi-speed-menu {
        position: absolute;
        bottom: calc(100% + 12px);
        right: 0;
        background: var(--movi-glass-bg);
        border: 1px solid var(--movi-glass-border);
        border-radius: 12px;
        min-width: 140px;
        /* Tall enough for all 8 speeds (0.25x…2x) without scrolling on a normal
           player; capped to 70vh so a short player still fits — its top rows no
           longer clip because opening lifts the host clip (movi-menu-overflow). */
        max-height: min(70vh, 380px);
        overflow-y: auto;
        box-shadow: var(--movi-shadow-lg);
        z-index: 1000;
        pointer-events: auto !important;
      }

      .movi-speed-list {
        padding: 8px 0;
      }

      .movi-speed-item {
        padding: 11px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: var(--movi-controls-color);
        transition: background var(--movi-transition-fast);
        font-size: 14px;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        margin: 2px 6px;
        border-radius: 10px;
      }

      .movi-speed-item:hover {
        background: color-mix(in srgb, var(--movi-primary) 0.15);
      }

      .movi-speed-item.movi-speed-active {
        background: color-mix(in srgb, var(--movi-primary) 0.25);
        font-weight: 600;
      }
      
      .movi-speed-item.movi-speed-active::before {
        content: '✓';
        margin-right: 8px;
        color: var(--movi-primary);
      }

      .movi-loop-btn.active .movi-icon-loop-outline {
        display: none;
      }

      .movi-loop-btn.active .movi-icon-loop-filled {
        display: block !important;
      }

      .movi-stable-audio-container {
        position: relative;
      }

      .movi-stable-audio-btn.active .movi-icon-stable-audio-outline {
        display: none;
      }

      .movi-stable-audio-btn.active .movi-icon-stable-audio-filled {
        display: block !important;
      }

      /* ========================================
         NERD STATS OVERLAY
      ======================================== */
      .movi-nerd-stats {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 9;
        background: rgba(0, 0, 0, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 0;
        min-width: 280px;
        max-width: 380px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.9);
        pointer-events: auto;
        user-select: text;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      .movi-nerd-stats::-webkit-scrollbar {
        width: 4px;
      }

      .movi-nerd-stats::-webkit-scrollbar-track {
        background: transparent;
      }

      .movi-nerd-stats::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
      }

      .movi-nerd-stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        position: relative;
        z-index: 5;
      }

      .movi-nerd-stats-title {
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.6);
      }

      .movi-nerd-stats-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 20px;
        cursor: pointer;
        pointer-events: auto;
        padding: 4px 8px;
        line-height: 1;
        padding: 0 2px;
        line-height: 1;
        transition: color 0.15s;
      }

      .movi-nerd-stats-close:hover {
        color: var(--movi-chrome-fg, #fff);
      }

      .movi-nerd-stats-body {
        padding: 6px 12px 10px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .movi-nerd-stats-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        gap: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      .movi-nerd-stats-row:last-child {
        border-bottom: none;
      }

      .movi-nerd-stats-key {
        color: rgba(255, 255, 255, 0.45);
        white-space: nowrap;
        font-size: 10.5px;
      }

      .movi-nerd-stats-value {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 600;
        text-align: right;
        word-break: break-all;
        font-size: 10.5px;
      }

      .movi-nerd-stats-graph-section {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin-top: 6px;
        padding: 8px 0 0;
      }

      .movi-nerd-stats-graph-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .movi-nerd-stats-graph-title {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.45);
      }

      .movi-nerd-stats-graph-speed {
        font-size: 11px;
        font-weight: 700;
        color: #00ff88;
        font-variant-numeric: tabular-nums;
      }

      .movi-nerd-stats-graph {
        width: 100%;
        height: 80px;
        border-radius: 4px;
        display: block;
        position: static;
        z-index: auto;
        object-fit: unset;
      }

      @container movi-host (max-width: 720px) {
        .movi-nerd-stats {
          top: 4px;
          left: 4px;
          right: 4px;
          min-width: unset;
          max-width: unset;
          font-size: 9px;
          border-radius: 6px;
        }

        .movi-nerd-stats-header {
          padding: 8px 10px;
        }

        .movi-nerd-stats-close {
          font-size: 24px;
          padding: 6px 10px;
          pointer-events: auto;
        }

        .movi-nerd-stats-title {
          font-size: 9px;
        }

        .movi-nerd-stats-body {
          padding: 4px 10px 6px;
        }

        .movi-nerd-stats-row {
          padding: 2px 0;
          gap: 8px;
        }

        .movi-nerd-stats-key,
        .movi-nerd-stats-value {
          font-size: 8.5px;
        }

        .movi-nerd-stats-graph-section {
          padding: 6px 10px 8px;
        }

        .movi-nerd-stats-graph {
          height: 50px;
          width: 100%;
          display: block;
          position: static;
          z-index: auto;
          object-fit: unset;
        }

        .movi-nerd-stats-graph-header {
          margin-bottom: 4px;
        }

        .movi-nerd-stats-graph-title {
          font-size: 8px;
        }

        .movi-nerd-stats-graph-speed {
          font-size: 9px;
        }
      }

      /* ========================================
         TIMELINE PANEL
      ======================================== */
      .movi-timeline-panel {
        position: absolute;
        bottom: 125px;
        left: 12px;
        transition: bottom 0.3s ease;
        right: 12px;
        z-index: 11;
        background: rgba(0, 0, 0, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 0;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        font-family: 'Inter', -apple-system, sans-serif;
        max-height: 240px;
        overflow: hidden;
      }

      .movi-timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
      }

      .movi-timeline-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.6);
      }

      .movi-timeline-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .movi-timeline-generate-btn {
        background: var(--movi-primary);
        border: none;
        color: var(--movi-chrome-fg, #fff);
        font-size: 11px;
        font-weight: 600;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: opacity 0.2s;
        font-family: inherit;
      }

      .movi-timeline-generate-btn:hover {
        opacity: 0.85;
      }

      .movi-timeline-generate-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .movi-timeline-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 20px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }

      .movi-timeline-close:hover {
        color: var(--movi-chrome-fg, #fff);
      }

      .movi-timeline-strip {
        display: flex;
        gap: 8px;
        padding: 10px 14px;
        overflow-x: auto;
        overflow-y: hidden;
        flex: 1;
        min-height: 0;
      }

      .movi-timeline-strip::-webkit-scrollbar {
        height: 4px;
      }

      .movi-timeline-strip::-webkit-scrollbar-track {
        background: transparent;
      }

      .movi-timeline-strip::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
      }

      .movi-timeline-item {
        flex-shrink: 0;
        cursor: pointer;
        position: relative;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: border-color 0.2s, transform 0.2s;
      }

      .movi-timeline-item:hover,
      .movi-timeline-item.movi-timeline-selected {
        border-color: var(--movi-primary);
        /* Keep the pop small enough that an active + adjacent-hovered item
           don't grow into each other across the 8px gap (scale doesn't
           reflow neighbours, so an over-large scale visually overlaps). */
        transform: scale(1.03);
      }

      .movi-timeline-item img {
        display: block;
        height: 90px;
        width: auto;
        object-fit: contain;
      }

      .movi-timeline-portrait .movi-timeline-item {
        min-width: auto;
      }

      .movi-timeline-portrait .movi-timeline-item img {
        height: auto;
        width: 55px;
      }

      .movi-timeline-time {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        color: var(--movi-chrome-fg, #fff);
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
        padding: 12px 4px 4px;
        font-variant-numeric: tabular-nums;
      }

      .movi-timeline-chapter {
        min-width: 130px;
      }

      .movi-timeline-chapter-label {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
        padding: 16px 6px 5px;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .movi-timeline-chapter-title {
        font-size: 10px;
        font-weight: 600;
        color: var(--movi-chrome-fg, #fff);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .movi-timeline-chapter .movi-timeline-time {
        position: static;
        background: none;
        padding: 0;
        font-size: 9px;
        color: rgba(255, 255, 255, 0.5);
      }

      .movi-timeline-status {
        padding: 0 14px 8px;
        font-size: 10px;
        color: rgba(255, 255, 255, 0.4);
        text-align: center;
        flex-shrink: 0;
      }

      @container movi-host (max-width: 720px) {
        .movi-timeline-panel {
          left: 8px;
          right: 8px;
          bottom: 70px;
        }

        .movi-timeline-item img {
          height: 65px;
        }
      }

      /* ========================================
         KEYBOARD SHORTCUTS PANEL
      ======================================== */
      .movi-shortcuts-panel {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 100;
        background: rgba(0, 0, 0, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 0;
        flex-direction: column;
        min-width: 420px;
        max-width: 520px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
        font-family: 'Inter', -apple-system, sans-serif;
        color: rgba(255, 255, 255, 0.9);
        pointer-events: auto;
      }

      .movi-shortcuts-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .movi-shortcuts-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .movi-shortcuts-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        font-size: 22px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        transition: color 0.15s;
      }

      .movi-shortcuts-close:hover {
        color: var(--movi-chrome-fg, #fff);
      }

      .movi-shortcuts-body {
        display: flex;
        gap: 24px;
        padding: 14px 18px 18px;
      }

      .movi-shortcuts-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .movi-shortcut-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .movi-shortcut-row kbd {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 5px;
        padding: 3px 8px;
        font-size: 11px;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        font-weight: 600;
        min-width: 28px;
        text-align: center;
        color: rgba(255, 255, 255, 0.85);
        white-space: nowrap;
      }

      .movi-shortcut-row span {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        text-align: right;
        flex: 1;
      }

      .movi-cues-panel {
        position: absolute;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.78);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', -apple-system, sans-serif;
        color: rgba(255, 255, 255, 0.92);
        pointer-events: auto;
      }
      .movi-cues-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
      }
      .movi-cues-title {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .movi-cues-search-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        max-width: 380px;
        margin-left: auto;
        margin-right: auto;
      }
      .movi-cues-search-wrap svg {
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
      }
      .movi-cues-search {
        all: unset;
        flex: 1;
        font-size: 13px;
        color: var(--movi-chrome-fg, #fff);
        font-family: inherit;
      }
      .movi-cues-search::placeholder { color: rgba(255, 255, 255, 0.4); }
      .movi-cues-search::-webkit-search-cancel-button { display: none; }
      .movi-cues-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.55);
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        padding: 0 6px;
        transition: color 0.15s;
      }
      .movi-cues-close:hover { color: var(--movi-chrome-fg, #fff); }
      .movi-cues-meta {
        padding: 6px 18px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.45);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .movi-cues-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px 8px 12px;
        scroll-behavior: smooth;
      }
      .movi-cues-list::-webkit-scrollbar { width: 8px; }
      .movi-cues-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.12);
        border-radius: 4px;
      }
      .movi-cues-row {
        display: flex;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        align-items: flex-start;
        transition: background 0.12s;
      }
      .movi-cues-row:hover { background: rgba(255, 255, 255, 0.06); }
      .movi-cues-row.is-active {
        background: color-mix(in srgb, var(--movi-primary) 0.18, transparent);
      }
      .movi-cues-row.is-active .movi-cues-row-time {
        color: var(--movi-primary);
      }
      .movi-cues-row-time {
        font-variant-numeric: tabular-nums;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
        min-width: 56px;
        padding-top: 1px;
      }
      .movi-cues-row-text {
        font-size: 13px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .movi-cues-row mark {
        background: color-mix(in srgb, var(--movi-primary) 0.4, transparent);
        color: inherit;
        padding: 0 2px;
        border-radius: 3px;
      }
      .movi-cues-empty {
        text-align: center;
        padding: 40px 20px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 13px;
      }

      @container movi-host (max-width: 720px) {
        .movi-shortcuts-panel {
          min-width: unset;
          max-width: unset;
          left: 8px;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: auto;
        }

        .movi-shortcuts-body {
          flex-direction: column;
          gap: 8px;
          padding: 10px 14px 14px;
        }

        .movi-shortcut-row kbd {
          font-size: 10px;
        }

        .movi-shortcut-row span {
          font-size: 11px;
        }
      }

      /* ========================================
         RESUME DIALOG
      ======================================== */
      .movi-resume-dialog {
        position: absolute;
        /* Sits just above the controls bar while it's visible; drops to the
           bottom edge when the bar auto-hides. The :has() rule below swaps
           between the two, transition makes it glide rather than jump. */
        bottom: 90px;
        right: 16px;
        z-index: 50;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 14px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        font-family: 'Inter', -apple-system, sans-serif;
        pointer-events: auto;
        animation: movi-resume-slide-up 0.3s ease;
        transition: bottom 0.2s ease;
      }

      /* Controls hidden (or absent) → drop the dialog to the bottom edge. */
      :host:has(.movi-controls-container.movi-controls-hidden) .movi-resume-dialog,
      :host(:not([controls])) .movi-resume-dialog {
        bottom: 16px;
      }

      @keyframes movi-resume-slide-up {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes movi-resume-fade-out {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(10px); }
      }

      .movi-resume-text {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
        white-space: nowrap;
      }

      .movi-resume-time {
        font-weight: 700;
        color: var(--movi-primary);
      }

      .movi-resume-buttons {
        display: flex;
        gap: 8px;
      }

      .movi-resume-btn {
        border: none;
        border-radius: 6px;
        padding: 7px 16px;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
        white-space: nowrap;
      }

      .movi-resume-btn:hover {
        opacity: 0.85;
      }

      .movi-resume-btn:active {
        transform: scale(0.97);
      }

      /* The selection ring is a KEYBOARD affordance — the arrow keys move it
         between Resume/Cancel. Touch has no arrow-key nav (you just tap), so
         the auto-focused ring is meaningless noise there; only draw it on
         mouse/hover devices. */
      @media (hover: hover) and (pointer: fine) {
        .movi-resume-btn.movi-resume-focused {
          /* This stylesheet globally nukes outline (the universal reset at
             line ~8515 sets outline none with !important) and box-shadow on
             :focus, so the selection ring MUST be a box-shadow WITH !important
             to survive — a plain outline never renders. White ring (NOT
             --movi-primary — that's the Resume button's own fill) + dark halo
             reads on both the primary and grey buttons. The two-class selector
             out-specifies the reset among !important rules. */
          box-shadow: 0 0 0 3px #fff, 0 0 0 6px rgba(0, 0, 0, 0.5) !important;
          transform: scale(1.06);
          transition: transform 0.1s, box-shadow 0.1s;
        }
      }

      .movi-resume-yes {
        background: var(--movi-primary);
        color: var(--movi-chrome-fg, #fff);
      }

      .movi-resume-no {
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.8);
      }

      @container movi-host (max-width: 720px) {
        .movi-resume-dialog {
          bottom: 80px;
          padding: 10px 14px;
          gap: 10px;
        }

        .movi-resume-text {
          font-size: 12px;
        }

        .movi-resume-btn {
          padding: 6px 12px;
          font-size: 11px;
        }
      }

      /* Very small players (≤400px): the horizontal pill (text + two buttons)
         is wider than the player and, being right-anchored + nowrap, clipped
         its left edge ("...ume from"). Span the player instead and stack the
         buttons under the text. left/right (not transform) so the slide-up
         animation's translateY isn't overridden. */
      @container movi-host (max-width: 400px) {
        .movi-resume-dialog {
          left: 16px;
          right: 16px;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
          text-align: center;
        }
        .movi-resume-text {
          white-space: normal;
        }
        .movi-resume-buttons {
          justify-content: center;
        }
        .movi-resume-btn {
          flex: 1;
        }
      }

      /* ========================================
         RESPONSIVE STYLES - Mobile First
      ======================================== */

      /* Mobile devices (up to 640px) */
      @container movi-host (max-width: 720px) {
        :host {
          --movi-controls-height: var(--movi-controls-height-mobile);
          --movi-btn-size: var(--movi-btn-size-mobile);
        }
        
        .movi-loader-container {
          width: 64px !important;
          height: 64px !important;
        }

        /* Keyframe animations off on small/compact layouts for perf, but keep
           CSS transitions so the controls + centre button still move smoothly
           here too (the PiP / mini player is a small container). */
        .movi-controls-overlay,
        .movi-center-play-pause,
        .movi-btn,
        .movi-progress-handle {
          animation: none !important;
          transform: none !important;
        }

        /* Keep a short opacity-only fade on the controls bar — the
           transform/scale animations are dropped for mobile perf, but
           a plain opacity transition is cheap and the snap-on/snap-off
           without it reads as broken. */
        .movi-controls-container {
          transition: opacity 0.18s ease !important;
          animation: none !important;
          transform: none !important;
        }

        /* Explicit state overrides for mobile */
        .movi-controls-container.movi-controls-hidden {
           opacity: 0 !important;
           transform: none !important;
        }
        
        .movi-controls-container.movi-controls-visible {
           opacity: 1 !important;
           transform: none !important;
        }
        
        /* Restore explicit transforms that are structural, not animated.
           Sized to a finger-friendly tap target on phones (was 68×68 +
           32×32 svg, which read as undersized next to the bottom bar);
           96×96 + 50×50 keeps parity with the desktop default. */
        .movi-center-play-pause {
           /* Center button needs transform for centering */
           transform: translate(-50%, -50%) scale(0.7) !important;
           width: 96px !important;
           height: 96px !important;
           border-width: 1.5px !important;
        }
        .movi-center-play-pause.movi-center-visible {
           transform: translate(-50%, -50%) scale(1) !important;
        }
        .movi-center-play-pause svg {
           width: 50px !important;
           height: 50px !important;
           color: var(--movi-controls-color) !important;
           fill: var(--movi-controls-color) !important;
           filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
        }
        .movi-center-icon-play {
           margin-left: 0 !important;
           transform: translateX(4px) scale(1.15) !important;
        }
        .movi-progress-handle {
            /* Handle needs transform for centering and positioning */
            transform: translate(-50%, -50%) !important;
        }
        
        .movi-time {
          font-size: 10px;
        }

        .movi-controls-bar {
          padding: 4px 10px 6px;
          gap: 2px;
          min-height: var(--movi-controls-height-mobile);
        }

        .movi-buttons-row {
          gap: 4px;
        }

        .movi-controls-left,
        .movi-controls-right {
          gap: 2px;
        }

        .movi-btn {
          padding: 8px;
          width: 44px;
          height: 44px;
        }

        .movi-btn svg {
          width: 22px;
          height: 22px;
        }
        
        .movi-volume-slider-container {
          display: none !important;
        }

        /* When user taps the speaker on mobile, surface the slider */
        .movi-volume-container.active .movi-volume-slider-container {
          display: flex !important;
          width: 80px !important;
          padding: 8px 8px !important;
          overflow: visible !important;
          opacity: 1 !important;
        }

        /* Small player on a hover-capable device (e.g. embedded in a
           compare/split layout on desktop) still needs hover-to-open
           with the same width/opacity transition as the full-size
           player. Just overriding display:none → flex on hover would
           snap (display can't transition); instead, keep the slider
           in the layout as display:flex and let the base rule's
           width:0 + opacity:0 collapse it, so the desktop hover rule
           (lines ~7514) animates width and opacity smoothly. The
           wrapping @media keeps touch devices on the tap-to-open
           path above. */
        @media (hover: hover) {
          .movi-volume-slider-container {
            display: flex !important;
          }
        }

        .movi-seek-backward,
        .movi-seek-forward {
          display: none !important;
        }

        .movi-progress-container {
          /* Nudge the seek bar down a little on compact players so it isn't
             hugging the video edge. */
          padding: 14px 0 2px;
        }

        .movi-progress-bar {
          height: 6px;
        }
        
        .movi-progress-bar:hover {
          height: 8px;
        }
        
        .movi-progress-handle {
          width: 12px;
          height: 12px;
        }

        /* Keep the "HDR" pill label on small/mobile players. Hiding it
           on mobile (the previous rule) left the button as an empty
           24×28px pill that turned into a solid white circle whenever
           .movi-hdr-active flipped the bg to white — a desktop user
           would see "HDR" text inside the pill, but mobile got a blank
           blob with no indication of what it was. Showing the label
           keeps both platforms visually consistent at minimal cost
           (11px font, fits easily). */

        /* Horizontal Expansion Style */
        .movi-controls-right {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0;
          transition: gap var(--movi-transition-normal);
        }

        .movi-mobile-expandable {
          display: flex;
          align-items: center;
          width: 0;
          opacity: 0;
          overflow: hidden;
          transition: all var(--movi-transition-normal);
          pointer-events: none;
          gap: 0;
          height: 100%; /* Match bar height */
        }

        .movi-controls-right.expanded .movi-mobile-expandable {
          opacity: 1;
          pointer-events: auto;
          gap: 4px;
          margin-right: 4px;
          /* When expanded on a narrow player the row can hold more buttons than
             fit — let them scroll horizontally instead of clipping or wrapping.
             overflow-y stays hidden (only the in-flow buttons are clipped
             vertically; the pop-up menus are positioned against the controls
             bar, an ancestor, so they're not clipped by this scroll box).
             flex:0 1 auto + justify-content:flex-start is deliberate: when the
             buttons fit, the box is content-sized and the PARENT's flex-end
             packs it right against the more (>) button (no gap); when they
             overflow, min-width:0 lets it shrink and scroll, and flex-start
             keeps the LEADING icons reachable — flex-end would strand the
             overflowed left-side icons off-screen with no way to scroll to them.
             width:auto is REQUIRED: flex-basis:auto reads the width, and the
             collapsed base rule sets width:0 — without this the expandable stays
             0-wide and no icons show when expanded. */
          width: auto;
          flex: 0 1 auto;
          min-width: 0;
          flex-wrap: nowrap;
          justify-content: flex-start;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none; /* Firefox */
          -webkit-overflow-scrolling: touch;
        }
        .movi-controls-right.expanded .movi-mobile-expandable::-webkit-scrollbar {
          display: none; /* WebKit */
        }

        /* Reset margins and restore dimensions; keep buttons from shrinking so
           the icons don't squash — they scroll instead. */
        .movi-controls-right.expanded .movi-mobile-expandable > * {
          margin: 0 !important;
          width: auto;
          height: auto;
          flex: 0 0 auto;
        }

        /* Hide individual buttons by default on mobile */
        .movi-quality-container,
        .movi-speed-container,
        .movi-aspect-ratio-btn,
        .movi-loop-btn {
          width: 0;
          height: 0;
          margin: 0;
          gap: 0;
          overflow: visible;
        }

        .movi-more-container {
          display: flex;
          align-items: center;
          position: relative;
        }

        .movi-more-btn {
          display: flex !important;
          z-index: 12;
        }

        .movi-controls-right.expanded ~ .movi-controls-left,
        .movi-controls-left:has(~ .movi-controls-right.expanded),
        :host([theme]) .movi-controls-right.expanded .movi-controls-left {
          display: none !important;
        }

        /* If right is expanded, hide the left group to make space */
        .movi-buttons-row:has(.movi-controls-right.expanded) .movi-controls-left {
           display: none !important;
        }
        
        /* Alternative for older browsers: shrink left instead of hiding if :has not supported */
        .movi-controls-right.expanded {
           flex: 1;
           /* min-width:0 lets this shrink below its content so the constraint
              reaches the expandable, which then scrolls. Without it the default
              min-width:auto keeps the whole cluster at content width and it
              overflows the player's left edge instead of scrolling. */
           min-width: 0;
           justify-content: flex-end;
        }
        
        /* Allow menus to position relative to the controls bar/player on mobile */
        .movi-controls-right,
        .movi-mobile-expandable,
        .movi-audio-track-container,
        .movi-subtitle-track-container,
        .movi-quality-container,
        .movi-speed-container {
             position: static !important;
        }

        /* Position menus correctly on mobile. Centering goes through
           --movi-menu-tx so it composes with the animation's translateY
           + scale instead of overriding them — without the custom-prop
           split, the .is-open rule's transform reset would knock the
           menu off-centre the moment it opens. */
        .movi-audio-track-menu,
        .movi-subtitle-track-menu,
        .movi-quality-menu,
        .movi-speed-menu {
          --movi-menu-tx: -50%;
          position: absolute !important;
          bottom: 100% !important;
          margin-bottom: 15px !important;
          left: 50% !important;
          transform-origin: bottom center !important;
          width: 90% !important;
          max-width: 300px !important;
          /* Cap to the viewport, not the player. Opening a dropdown now lifts
             the host's paint/overflow clip (movi-menu-overflow), so a tall menu
             on a SHORT player extends past the player's top edge into the page
             instead of being chopped there — which used to hide the first rows
             (e.g. the 0.25x speed option). 70vh keeps it within the screen and
             lets it scroll only when the list itself is genuinely huge. */
          max-height: min(70vh, calc(100vh - 80px)) !important;
          overflow-y: auto !important;
          z-index: 2000 !important;
          -webkit-overflow-scrolling: touch !important;
          /* Ensure scrollbar doesn't take up space/looks clean */
          scrollbar-width: thin;
        }
        
        /* Give more vertical space in fullscreen */
        :host(:fullscreen) .movi-audio-track-menu,
        :host(:fullscreen) .movi-subtitle-track-menu,
        :host(:fullscreen) .movi-quality-menu,
        :host(:fullscreen) .movi-speed-menu {
           max-height: 70vh !important;
        }

        /* On mobile the menu itself scrolls (see overflow-y above) —
           so the inner list shouldn't carry its own bounded scroll
           area; collapsing the desktop max-height lets the menu's
           single scrollbar handle long lists. flex: 0 0 auto stops
           the list from shrinking inside the column — without it the
           desktop's flex 1 1 auto + min-height 0 shrunk the list
           below its content height, and overflow visible then let
           the items spill past the list box, sitting on top of the
           footer ("4 audio tracks available" appearing mid-list). */
        .movi-audio-track-list,
        .movi-subtitle-track-list {
          max-height: none !important;
          overflow-y: visible !important;
          flex: 0 0 auto !important;
        }

        /* Subtitle customize panel — compact layout for narrow players. */
        .movi-sub-cust-panel {
          padding: 2px 4px 6px;
          gap: 6px;
        }
        .movi-sub-cust-back {
          padding: 6px 8px;
          font-size: 12px;
        }
        .movi-sub-cust-row {
          padding: 2px 4px;
        }
        .movi-sub-cust-label {
          font-size: 10px;
          margin-bottom: 4px;
        }
        .movi-sub-cust-options {
          gap: 3px;
        }
        .movi-sub-cust-opt {
          min-width: 36px;
          padding: 5px 7px;
          font-size: 11px;
          flex: 1 1 calc(20% - 3px);
        }
        .movi-sub-cust-swatch {
          width: 22px;
          height: 22px;
          border-width: 2px;
        }
        .movi-sub-cust-reset {
          font-size: 11px;
          padding: 5px 8px;
        }
        /* Header gear stays tappable but trims weight on small players. */
        .movi-subtitle-customize-btn {
          width: 26px;
          height: 26px;
        }
        .movi-subtitle-customize-btn svg {
          width: 14px;
          height: 14px;
        }
      }

      /* Desktop: Hide More button */
      @container movi-host (min-width: 721px) {
        .movi-more-btn {
          display: none !important;
        }
        .movi-mobile-expandable {
          display: contents; /* Effectively removes the wrapper on desktop */
        }
      }


      /* Tablet-sized players (721px to 1024px) */
      @container movi-host (min-width: 721px) and (max-width: 1024px) {
        .movi-controls-bar {
          padding: 14px 18px;
        }

        .movi-time {
          font-size: 12px;
        }

        /* Tighten button + gap sizing so all the right-side icons fit
           within the bar at medium widths — without this, the right
           icons (loop, fullscreen) clip off the edge. */
        .movi-btn {
          width: 40px;
          height: 40px;
          padding: 8px;
        }
        .movi-btn svg {
          width: 20px;
          height: 20px;
        }
        .movi-controls-right {
          gap: 4px;
        }
        .movi-controls-left {
          gap: 4px;
        }
      }

      /* Very small / compact players (≤400px). Tighten every gap, shrink the
         buttons and pull in the bar padding so the always-visible collapsed
         row (play · volume · time · more · fullscreen) fits without clipping —
         the rest of the icons live in the horizontally-scrollable expandable. */
      @container movi-host (max-width: 400px) {
        :host {
          --movi-btn-size: 36px;
        }
        .movi-controls-bar {
          padding: 2px 8px 8px;
        }
        .movi-buttons-row {
          gap: 4px;
        }
        .movi-controls-left,
        .movi-controls-right {
          gap: 2px;
        }
        .movi-btn {
          padding: 7px;
        }
        .movi-btn svg {
          width: 20px;
          height: 20px;
        }
        .movi-time {
          font-size: 11px;
        }
        .movi-progress-container {
          padding: 14px 0 6px;
        }
      }

      /* Below ~290px the dropdown / context menus need a smaller type scale so
         rows aren't cramped or clipped on a tiny player. */
      @container movi-host (max-width: 289px) {
        .movi-speed-item {
          font-size: 10px;
          padding: 6px 10px;
        }
        .movi-audio-track-item,
        .movi-subtitle-track-item {
          font-size: 10px;
          padding: 5px 8px;
          gap: 6px;
        }
        .movi-track-item-icon {
          width: 13px;
          height: 13px;
        }
        .movi-audio-track-info,
        .movi-subtitle-track-info {
          font-size: 8px;
          padding: 1px 5px;
        }
        .movi-track-menu-header {
          font-size: 9px;
          padding: 7px 10px 6px;
        }
        .movi-track-menu-footer {
          font-size: 8px;
        }
        .movi-context-menu-item {
          font-size: 10px;
          padding: 7px 10px;
        }
        .movi-context-menu-icon svg,
        .movi-context-menu-item svg {
          width: 15px;
          height: 15px;
        }
      }

      /* Large players (1025px and above) */
      @container movi-host (min-width: 1025px) {
        .movi-controls-bar {
          padding: 16px 24px;
        }
      }
      
      /* Touch device optimizations */
      @media (hover: none) and (pointer: coarse) {
        /* Aggressively disable animations on touch interactions */
        .movi-controls-overlay,
        .movi-center-play-pause,
        .movi-btn,
        .movi-btn svg,
        .movi-progress-bar,
        .movi-volume-slider,
        .movi-volume-slider-container {
          transition: none !important;
          animation: none !important;
        }
        /* Keep a short opacity-only fade on the controls bar even on
           touch — without it the bar snaps on/off on every show/hide.
           Same reasoning as the small-player container query above:
           transform/scale animations are too expensive on phones but
           a plain opacity transition is cheap. */
        .movi-controls-container {
          transition: opacity 0.18s ease !important;
          animation: none !important;
        }

        /* No mobile-specific bar background override — desktop's
           three-stop fade-to-transparent gradient applies on touch
           too. The old solid-colour fallback was for a backdrop-
           filter-induced white flash on some mobile GPUs that's no
           longer applicable since we don't use backdrop-filter. */

        /* Remove the slide-up/down effect */
        .movi-controls-container,
        .movi-controls-container.movi-controls-hidden,
        .movi-controls-container.movi-controls-visible {
          transform: none !important;
        }

        /* Ensure opacity toggle is instant */
        .movi-controls-container.movi-controls-hidden {
           opacity: 0 !important;
        }
        .movi-controls-container.movi-controls-visible {
           opacity: 1 !important;
        }

        /* Center button focus/hover reset for touch devices */
        .movi-center-play-pause:hover,
        .movi-center-play-pause:focus,
        .movi-center-play-pause:active {
           background: color-mix(in srgb, var(--movi-primary) 40%, transparent) !important;
           border-color: color-mix(in srgb, var(--movi-primary) 60%, transparent) !important;
           box-shadow: 0 8px 32px color-mix(in srgb, var(--movi-primary) 40%, transparent) !important;
        }

        .movi-center-play-pause svg {
           color: var(--movi-controls-color) !important;
           fill: var(--movi-controls-color) !important;
           filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3)) !important;
        }

        .movi-center-play-pause:hover svg,
        .movi-center-play-pause:focus svg {
           color: var(--movi-controls-color) !important;
           fill: var(--movi-controls-color) !important;
           filter: drop-shadow(0 0 8px color-mix(in srgb, var(--movi-primary) 60%, transparent)) !important;
        }

        .movi-btn:hover svg,
        .movi-btn:focus svg {
           filter: none !important;
        }

        /* Center button: Keep structural transform but remove transition */
        .movi-center-play-pause {
           transform: translate(-50%, -50%) !important;
           transition: none !important;
        }

        /* Override button states to prevent white background flash */
        .movi-btn {
          background: transparent !important;
          transition: none !important;
        }

        .movi-btn:hover,
        .movi-btn:focus,
        .movi-btn:active {
          background: transparent !important;
          transform: none !important;
          box-shadow: none !important;
        }

        /* Ensure volume slider container interactions didn't rely on hover */
        .movi-volume-slider-container {
           /* display: none !important; REMOVED */
        }
      }

      /* Loading indicator — must share the same anchor as the centre
         play/pause button so a spinner-to-play transition (or vice
         versa) doesn't jump vertically. Default placement mirrors the
         button's default (centre of the visible band above the
         controls bar); the two override blocks below match the
         button's bar-hidden and both-bars-visible rules exactly. */
      .movi-loading-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        pointer-events: none;
        background: transparent;
        transition: top var(--movi-transition-normal);
      }

      .movi-loader-container {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        display: inline-block;
        border-top: 4px solid var(--movi-controls-color);
        border-right: 4px solid transparent;
        box-sizing: border-box;
        animation: movi-loader-spin 1s linear infinite;
        filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
      }

      /* Mobile loader - smaller size */
      @container movi-host (max-width: 720px) {
        .movi-loader-container {
          width: 48px;
          height: 48px;
          border-top-width: 3px;
          border-right-width: 3px;
        }
      }

      @keyframes movi-loader-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      /* Centre play/pause button. Default placement assumes only the
         bottom controls bar is visible — sit the icon at the centre
         of the available video band (50% of player minus half the
         bar's height) so it reads as "middle" regardless of player
         size. Bar-hidden and both-bars-visible overrides further
         down adjust this for the other two layout states. */
      .movi-center-play-pause {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        z-index: 5;
        width: 96px;
        height: 96px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--movi-primary) 25%, transparent);
        padding: 0;
        border: 2px solid color-mix(in srgb, var(--movi-primary) 40%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity var(--movi-transition-bounce), transform var(--movi-transition-bounce), top var(--movi-transition-normal), visibility 0s linear 0.3s;
        box-shadow: 0 8px 32px color-mix(in srgb, var(--movi-primary) 25%, transparent), inset 0 0 0 1px rgba(255, 255, 255, 0.1);
      }

      .movi-center-play-pause.movi-center-visible {
        opacity: 1;
        visibility: visible;
        transform: translate(-50%, -50%) scale(1);
        pointer-events: auto;
        transition-delay: 0s;
      }

      /* Default (the base rule) is the true geometric centre. When the controls
         bar is visible, lift the centre button AND the loading spinner a little
         so they read as centred in the band above the bar. Keyed off a host
         class toggled in show/hideControls, because :host:has() checks against
         the shadow tree don't apply in every engine (notably Electron). The
         transition on top (in each base rule) animates the move. */
      :host(.movi-bar-visible) .movi-center-play-pause,
      :host(.movi-bar-visible) .movi-loading-indicator {
        top: calc(50% - var(--movi-controls-height) / 4);
      }

      .movi-center-play-pause:hover {
        background: color-mix(in srgb, var(--movi-primary) 40%, transparent);
        border-color: color-mix(in srgb, var(--movi-primary) 60%, transparent);
        box-shadow: 0 8px 40px color-mix(in srgb, var(--movi-primary) 40%, transparent), inset 0 0 0 1px rgba(255, 255, 255, 0.15);
      }

      .movi-center-play-pause.movi-center-visible:hover {
        transform: translate(-50%, -50%) scale(1.08);
      }

      .movi-center-play-pause:active {
        transform: translate(-50%, -50%) scale(0.92);
      }

      .movi-center-play-pause.movi-center-visible:active {
        transform: translate(-50%, -50%) scale(0.92);
      }

      .movi-center-play-pause svg {
        width: 52px;
        height: 52px;
        color: var(--movi-controls-color);
        fill: var(--movi-controls-color);
        transition: all var(--movi-transition-fast);
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }

      .movi-center-play-pause:hover svg {
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--movi-primary) 60%, transparent));
      }

      /* Play icon — bumped up ~15% so the triangle isn't dwarfed by
         the circle's blur halo (the pause SVG stays at the base size
         since it's already visually heavier). The translate is a
         small optical-centre nudge — 5px read as too far right in
         practice, so 2px is enough to take the visual edge off the
         left-leaning mass without making the tip look pushed. */
      .movi-center-icon-play {
        display: block;
        transform: translateX(4px) scale(1.15);
      }

      .movi-center-play-pause:focus {
        outline: none !important;
        border-color: color-mix(in srgb, var(--movi-primary) 50%, transparent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--movi-primary) 30%, transparent), 0 8px 32px rgba(0, 0, 0, 0.4);
      }
      
      /* Mobile center button — previously shrank to 72px here, but the
         <=720px responsive block further down enforces 96px with
         !important, so this rule was dead. Removed to avoid drift; if
         a smaller phone-sized variant is ever wanted, set it in that
         block so it survives the !important cascade. */

      /* Subtitle overlay - HTML element for better performance */
      /* Off-screen live region for screen-reader caption announcements. */
      .movi-caption-live {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .movi-subtitle-overlay {
        position: absolute;
        bottom: 12%;
        left: 0;
        right: 0;
        z-index: 5;
        pointer-events: none;
        display: none;
        text-align: center;
        padding: 0 5%;
        transition: padding-bottom 0.3s ease;
      }

      /* Subtitle shift is handled via JS in showControls/hideControls */

      /* Full-width anchor row; padding-left set inline by the renderer
         pushes the inline-block backdrop to the position where the
         final sentence's centered start would sit. */
      .movi-subtitle-anchor {
        display: block;
        width: 100%;
        text-align: left;
        box-sizing: border-box;
      }

      /* The single rounded backdrop. Inline-block so it hugs its
         widest line; multi-line cues share ONE backdrop instead of
         stacking individual boxes per line. The actual backdrop fill
         is opt-in: only WebVTT tracks get it (see the
         .movi-subtitle-format-vtt rule below). SRT / embedded text
         tracks render plain — backdrop on traditional movie subs
         reads as noise. */
      .movi-subtitle-block {
        display: inline-block;
        max-width: 100%;
        border-radius: 4px;
        padding: 4px 12px;
        text-align: left;
        box-sizing: border-box;
        /* Make the block itself clickable while keeping the overlay
           transparent — clicking the live caption opens the transcript
           browser, scrolled to the current cue. */
        pointer-events: auto;
        cursor: pointer;
      }

      .movi-subtitle-overlay.movi-subtitle-format-vtt .movi-subtitle-block {
        background: rgba(
          var(--movi-sub-bg-rgb, 8, 8, 8),
          var(--movi-sub-bg-alpha, 0.75)
        );
      }

      .movi-subtitle-line {
        display: block;
        color: var(--movi-sub-color, #FFFFFF);
        font-family: 'YouTube Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        /* Base size scales against the player width via --movi-player-width;
           the user's customize-panel choice is applied as a multiplier via
           --movi-sub-size-mult. Defaults to 1 (= 100%). */
        font-size: calc(clamp(20px, calc(var(--movi-player-width, 100vw) * 0.032), 40px) * var(--movi-sub-size-mult, 1));
        font-weight: 500;
        line-height: 1.35;
        letter-spacing: 0.01em;
        /* Edge style is user-selectable: drop shadow, outline, raised,
           or none. Defaults to a single soft shadow. */
        text-shadow: var(--movi-sub-edge, 0 0 4px rgba(0, 0, 0, 0.85));
        /* Centre each line within the block. For dialogue cues like
           "- Long sentence...\n- Short reply." the shorter line otherwise
           sits flush-left of the wider one and reads as visually
           unbalanced. VTT karaoke needs a stable left edge for the
           incremental word reveal — overridden below. */
        text-align: center;
        white-space: pre-wrap;
        word-wrap: break-word;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }

      /* VTT karaoke grows static + new word spans inside a single line;
         centring would wobble the existing words on every reveal. Keep
         left-aligned so the karaoke types in from a stable edge. */
      .movi-subtitle-overlay.movi-subtitle-format-vtt .movi-subtitle-line {
        text-align: left;
      }

      /* Words already on screen from the previous cue — paint instantly. */
      .movi-subtitle-static {
        opacity: 1;
      }

      /* Newly-added word(s) — gentle opacity fade only. No translate;
         lateral slides on every karaoke tick are what was straining the
         eye. */
      .movi-subtitle-new {
        animation: movi-subtitle-word-in 320ms ease-out forwards;
        will-change: opacity;
      }

      @keyframes movi-subtitle-word-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      /* Context Menu */
      .movi-context-menu {
        position: absolute;
        background: rgba(15, 15, 22, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 8px 4px; /* Consistent with submenus */
        min-width: 220px;
        z-index: 10000;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: var(--movi-controls-color);
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
        letter-spacing: 0.01em;
        transition: transform 0.2s ease, opacity 0.2s ease, visibility 0.2s;
        box-sizing: border-box;
      }

      .movi-context-menu::-webkit-scrollbar {
        width: 6px;
      }
      .movi-context-menu::-webkit-scrollbar-track {
        background: transparent;
      }
      .movi-context-menu::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .movi-context-menu::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.35);
      }

      .movi-context-menu-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.4);
        z-index: 19999;
        display: none;
      }

      .movi-context-menu-icon {
        width: 16px;
        height: 16px;
        margin-right: 12px;
        opacity: 0.7;
        transition: all 0.2s ease;
      }

      @media (hover: hover) {
        .movi-context-menu-item:hover .movi-context-menu-icon {
          opacity: 1;
          color: var(--movi-primary-light);
        }
      }

      .movi-context-menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        margin: 2px 6px;
        border-radius: 10px;
        letter-spacing: 0.01em;
      }

      @media (hover: hover) {
        .movi-context-menu-item:hover {
          background-color: rgba(255, 255, 255, 0.08);
          transform: scale(1.02);
        }

        :host([theme="light"]) .movi-context-menu-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .movi-context-menu-item:hover .movi-context-menu-arrow {
          transform: translateX(2px);
          color: var(--movi-primary-light);
        }
      }

      .movi-context-menu-item:active {
        background-color: rgba(255, 255, 255, 0.12);
        transform: scale(0.98);
        transition: transform 0.1s ease;
      }

      .movi-context-menu-item.movi-context-menu-disabled {
        opacity: 0.3;
        pointer-events: none;
      }

      .movi-context-menu-item.movi-context-menu-active {
        background-color: color-mix(in srgb, var(--movi-primary) 0.12);
        color: var(--movi-primary-light);
        font-weight: 600;
      }
      
      .movi-context-menu-item.movi-context-menu-active::before {
        content: '';
        position: absolute;
        left: 6px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 12px;
        background: var(--movi-primary);
        border-radius: 4px;
        box-shadow: 0 0 10px var(--movi-primary);
      }

      /* Adjust label position for active indicator */
      .movi-context-menu-item.movi-context-menu-active .movi-context-menu-label {
        padding-left: 8px;
      }

      .movi-context-menu-label {
        flex: 1;
      }

      .movi-context-menu-shortcut {
        color: var(--movi-text-tertiary);
        font-size: 12px;
        margin-left: 16px;
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        font-weight: 500;
      }

      .movi-context-menu-arrow {
        color: var(--movi-text-tertiary);
        font-size: 10px;
        margin-left: 8px;
        transition: transform var(--movi-transition-fast);
      }

      .movi-context-menu-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 8px 0;
      }

      .movi-context-menu-submenu {
        position: absolute;
        background: rgba(15, 15, 22, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 8px 4px;
        min-width: 230px;
        visibility: hidden;
        opacity: 0;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        z-index: 10001;
        transform: translateX(-8px);
        transition: transform 0.2s ease, opacity 0.2s ease, visibility 0.2s;
        pointer-events: none;
        max-height: 250px;
        overflow-y: auto;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: var(--movi-controls-color);
        letter-spacing: 0.01em;
      }

      .movi-context-menu-submenu.movi-context-menu-submenu-visible {
        visibility: visible !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
        pointer-events: auto !important;
      }

      .movi-context-menu-submenu-audio,
      .movi-context-menu-submenu-subtitle {
        position: absolute;
        background: rgba(15, 15, 22, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 8px 4px;
        min-width: 230px;
        visibility: hidden;
        opacity: 0;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
        z-index: 10001;
        transform: translateX(-8px);
        transition: transform 0.2s ease, opacity 0.2s ease, visibility 0.2s;
        pointer-events: none;
        max-height: 250px;
        overflow-y: auto;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        color: var(--movi-controls-color);
        letter-spacing: 0.01em;
      }
      
      .movi-context-menu-submenu-audio.movi-context-menu-submenu-visible,
      .movi-context-menu-submenu-subtitle.movi-context-menu-submenu-visible {
        visibility: visible !important;
        opacity: 1 !important;
        transform: translateX(0) !important;
        pointer-events: auto !important;
      }

      /* Custom Scrollbar for Submenus & Control Menus */
      .movi-context-menu-submenu::-webkit-scrollbar,
      .movi-context-menu-submenu-audio::-webkit-scrollbar,
      .movi-context-menu-submenu-subtitle::-webkit-scrollbar,
      .movi-audio-track-menu::-webkit-scrollbar,
      .movi-subtitle-track-menu::-webkit-scrollbar,
      .movi-quality-menu::-webkit-scrollbar,
      .movi-speed-menu::-webkit-scrollbar {
        width: 6px;
      }

      /* Quality Menu */
      /* Quality Menu */
      .movi-quality-container {
        position: relative;
        display: flex;
        align-items: center; 
      }

      .movi-quality-menu {
        position: absolute;
        bottom: calc(100% + 12px);
        right: 0; /* Align to right like speed menu */
        left: auto; /* Reset left */
        transform: none; /* Reset transform */
        margin-bottom: 0;
        background: var(--movi-glass-bg);
        border: 1px solid var(--movi-glass-border);
        border-radius: 12px;
        min-width: 200px;
        max-height: 280px;
        overflow-y: auto;
        box-shadow: var(--movi-shadow-lg);
        z-index: 1001;
        pointer-events: auto !important;
        padding: 8px 0;
        white-space: nowrap;
      }
      
      .movi-quality-item {
        padding: 8px 16px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: background 0.2s;
        font-weight: 500;
      }
      
      .movi-quality-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .movi-quality-item.movi-quality-active {
        color: var(--movi-primary);
        font-weight: 600;
        background: color-mix(in srgb, var(--movi-primary) 0.1);
      }

      .movi-quality-check {
         width: 14px;
         height: 14px;
         margin-left: 8px;
      }

      .movi-quality-label-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .movi-quality-badge {
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 3px;
        letter-spacing: 0.4px;
        background: rgba(255, 255, 255, 0.18);
        color: rgba(255, 255, 255, 0.95);
        text-transform: uppercase;
        vertical-align: middle;
        position: relative;
        top: -1px;
      }

      .movi-quality-badge-hd,
      .movi-quality-badge-4k,
      .movi-quality-badge-8k {
        background: rgba(255, 255, 255, 0.18);
        color: rgba(255, 255, 255, 0.95);
      }

      .movi-quality-btn {
        position: relative;
      }

      .movi-quality-btn-badge {
        position: absolute;
        top: 4px;
        right: 0;
        font-size: 8px;
        font-weight: 700;
        line-height: 1;
        padding: 2px 3px;
        border-radius: 3px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        background: var(--movi-primary);
        color: var(--movi-chrome-fg, #fff);
        pointer-events: none;
      }

      /* Hide speed/quality menus on mobile by default and position them centrally */
      @container movi-host (max-width: 720px) {
         .movi-quality-menu {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            max-width: 280px;
            max-height: 50vh;
            overflow-y: auto;
         }
      }
      .movi-speed-menu::-webkit-scrollbar {
        width: 6px;
      }
      
      .movi-context-menu-submenu::-webkit-scrollbar-track,
      .movi-context-menu-submenu-audio::-webkit-scrollbar-track,
      .movi-context-menu-submenu-subtitle::-webkit-scrollbar-track,
      .movi-audio-track-menu::-webkit-scrollbar-track,
      .movi-subtitle-track-menu::-webkit-scrollbar-track,
      .movi-speed-menu::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .movi-context-menu-submenu::-webkit-scrollbar-thumb,
      .movi-context-menu-submenu-audio::-webkit-scrollbar-thumb,
      .movi-context-menu-submenu-subtitle::-webkit-scrollbar-thumb,
      .movi-audio-track-menu::-webkit-scrollbar-thumb,
      .movi-subtitle-track-menu::-webkit-scrollbar-thumb,
      .movi-speed-menu::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.05); /* Stealth by default */
        border-radius: 10px;
        background-clip: padding-box;
        border: 2px solid transparent;
        transition: background 0.3s;
      }

      .movi-context-menu-submenu::-webkit-scrollbar-thumb:hover,
      .movi-context-menu-submenu-audio::-webkit-scrollbar-thumb:hover,
      .movi-context-menu-submenu-subtitle::-webkit-scrollbar-thumb:hover,
      .movi-audio-track-menu::-webkit-scrollbar-thumb:hover,
      .movi-subtitle-track-menu::-webkit-scrollbar-thumb:hover,
      .movi-speed-menu::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.25);
        background-clip: padding-box;
      }

      /* Seek Thumbnail */
      .movi-seek-thumbnail {
        position: absolute;
        bottom: 25px;
        left: 0;
        transform: translateX(-50%);
        background-color: rgba(28, 28, 28, 0.9);
        color: white;
        padding: 6px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        pointer-events: none;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.1s ease;
        box-shadow: 0 4px 8px rgba(0,0,0,0.6);
        overflow: hidden;
        z-index: 20;
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .movi-thumbnail-img {
        display: block;
        width: auto;
        height: auto;
        max-width: 180px;
        max-height: 200px;
        object-fit: contain;
        margin-bottom: 4px;
        border: 1px solid var(--movi-border-color, #333);
        border-radius: 2px;
        pointer-events: none;
      }
      .movi-seek-thumbnail.visible {
        opacity: 1;
      }

      .movi-seek-chapter-title {
        display: none;
        font-size: 11px;
        font-weight: 600;
        color: var(--movi-chrome-fg, #fff);
        text-align: center;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 4px;
        margin-bottom: 2px;
        position: relative;
        z-index: 2;
      }

      .movi-seek-time {
        position: relative;
        z-index: 2;
      }

      .movi-thumbnail-img {
        position: relative;
        z-index: 1;
      }
      
      @keyframes movi-shimmer-anim {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      .movi-thumbnail-placeholder {
        width: auto;
        height: auto;
        min-width: 0;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        animation: none;
      }
      
      
      
      .movi-progress-container {
        position: relative; 
      }

      /* OSD Notification — compact glass capsule. Sits in the upper-
         centre of the player surface, dark translucent surface with
         a hairline accent so it reads as chrome consistent with the
         new bottom bar. Icon stays white; the primary tint only
         shows through a subtle drop-shadow halo (so HDR-on/loop-on/
         speed cues still feel "active" without screaming colour). */
      .movi-osd-container {
        position: absolute;
        top: 32px;
        left: 50%;
        transform: translateX(-50%) translateY(-12px) scale(0.96);
        transform-origin: top center;
        background: rgba(0, 0, 0, 0.55);
        padding: 10px 20px;
        border-radius: 999px;
        display: none; /* Flex when visible */
        align-items: center;
        justify-content: center;
        gap: 10px;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        /* Spring entry; the exit is a quieter ease so dismissing a
           cue doesn't pop. */
        transition:
          opacity 0.22s ease,
          transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow:
          0 12px 36px rgba(0, 0, 0, 0.45),
          0 0 0 1px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 0 rgba(255, 255, 255, 0.06);
        max-width: min(72%, 540px);
      }

      .movi-osd-container.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }

      .movi-osd-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--movi-chrome-fg, #FFFFFF);
        /* Subtle primary halo around the icon — keeps the OSD
           visually anchored to the brand without painting the bg. */
        filter: drop-shadow(0 0 6px color-mix(in srgb, var(--movi-primary) 45%, transparent));
      }

      .movi-osd-icon svg {
        width: 22px;
        height: 22px;
      }

      .movi-osd-text {
        font-size: 14px;
        font-weight: 600;
        color: var(--movi-chrome-fg, #FFFFFF);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        letter-spacing: 0.01em;
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .movi-broken-indicator {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(30, 30, 30, 0.4) 0%, rgba(10, 10, 10, 0.95) 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        font-family: 'Inter', sans-serif;
        text-align: center;
        padding: clamp(16px, 5%, 40px);
        opacity: 0;
        animation: movi-fade-in 0.5s ease forwards;
      }

      @keyframes movi-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .movi-broken-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: min(320px, 90%);
        animation: movi-slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes movi-slide-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .movi-broken-icon-wrapper {
        position: relative;
        width: clamp(48px, 12vw, 80px);
        height: clamp(48px, 12vw, 80px);
        margin-bottom: clamp(12px, 3vw, 24px);
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: clamp(12px, 3vw, 20px);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      }

      .movi-broken-icon-wrapper svg {
        width: clamp(28px, 7vw, 44px);
        height: clamp(28px, 7vw, 44px);
        filter: drop-shadow(0 0 15px rgba(255, 68, 68, 0.4));
      }

      .movi-broken-title {
        font-size: clamp(16px, 4vw, 22px);
        font-weight: 700;
        margin: 0 0 10px 0;
        letter-spacing: -0.02em;
        background: linear-gradient(to bottom, var(--movi-chrome-fg, #fff), #bbb);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
      }
      
      .movi-broken-text {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .movi-broken-message {
        font-size: clamp(11px, 2.5vw, 14px);
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        font-weight: 400;
        text-align: center;
      }
      
      .movi-sw-fallback-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
        padding: 10px 20px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: var(--movi-chrome-fg, #fff);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .movi-sw-fallback-btn:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.02);
      }
      
      .movi-sw-fallback-btn svg {
        flex-shrink: 0;
      }

      /* Empty State Indicator */
      .movi-empty-state {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 5;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        padding: 40px 40px calc(var(--movi-controls-height) + 20px);
        box-sizing: border-box;
        opacity: 0;
        animation: movi-fade-in 0.4s ease forwards;
        /* Animate the re-centering when the controls bar shows/hides, so the
           placeholder glides up/down in sync with the bar instead of jumping. */
        transition: padding-bottom var(--movi-transition-normal);
      }

      /* No controls bar at the bottom (controls disabled, or auto-hidden) —
         drop the reserved bottom space so the placeholder centers truly.
         Driven by the JS-toggled .movi-bar-collapsed host class rather than
         :has()/:host(:not(...)), which are flaky in Safari/Firefox. */
      :host(.movi-bar-collapsed) .movi-empty-state {
        padding-bottom: 40px;
      }

      /* A bare player (no controls attribute) is a headless, chrome-less
         surface — don't show the "No Video / Add a source" placeholder or the
         loading spinner there. !important beats the inline display:flex the JS
         sets on these indicators. */
      :host(.movi-no-controls) .movi-empty-state,
      :host(.movi-no-controls) .movi-loading-indicator {
        display: none !important;
      }

      /* Bare player (no controls attribute): a display-only surface — disable
         ALL mouse interaction (click-to-play, double-click fullscreen, the
         right-click menu, look-around drag). */
      :host(.movi-no-controls) {
        pointer-events: none !important;
      }

      /* An audio strip with no controls is a chrome-less bar with nothing to
         show or operate — hide it entirely. Audio keeps playing (Web Audio is
         independent of the host's display). */
      :host(.movi-audio-strip.movi-no-controls) {
        display: none !important;
      }

      /* Opt-out: the noerrorscreen attribute suppresses the built-in error
         overlays ("Format Unsupported", "Browser not supported", codec/network
         errors) so an embedding app can render its own error UI. The error
         event + state still fire — only the default screen is hidden. */
      :host([noerrorscreen]) .movi-broken-indicator {
        display: none !important;
      }

      /* Short / narrow players: shrink the placeholder so it fits above
         the controls bar without clipping into it. */
      @container movi-host (max-width: 720px) {
        .movi-empty-state {
          padding: 16px 16px calc(var(--movi-controls-height) + 12px);
        }
        :host(.movi-bar-collapsed) .movi-empty-state {
          padding-bottom: 16px;
        }
        .movi-empty-container {
          gap: 8px !important;
        }
        .movi-empty-icon-wrapper {
          width: 56px !important;
          height: 56px !important;
        }
        .movi-empty-title {
          font-size: 14px !important;
        }
        .movi-empty-message {
          font-size: 11px !important;
        }
      }

      .movi-empty-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }

      .movi-empty-icon-wrapper {
        width: 96px;
        height: 96px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.6;
      }

      .movi-empty-icon-wrapper svg {
        width: 100%;
        height: 100%;
      }

      .movi-empty-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        color: rgba(255, 255, 255, 0.9);
        letter-spacing: -0.01em;
      }

      .movi-empty-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .movi-empty-message {
        font-size: 13px;
        line-height: 1.5;
        color: rgba(255, 255, 255, 0.5);
        margin: 0;
        font-weight: 400;
      }

      /* Mobile Responsiveness for Context Menu - Side Panel Mode */
      @media (pointer: coarse) {
        .movi-context-menu.movi-context-menu-mobile {
          position: absolute;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          width: 80% !important;
          max-width: 350px !important;
          height: 100% !important;
          border-radius: 0 !important;
          border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
          padding: 16px 8px !important;
          flex-direction: column;
          box-shadow: -10px 0 50px rgba(0, 0, 0, 0.8) !important;
          transform: translateX(100%) !important;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
          display: flex !important;
          visibility: visible !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          z-index: 20000 !important;
        }

        /* Light theme mobile context menu */
        :host([theme="light"]) .movi-context-menu.movi-context-menu-mobile {
          border-left-color: rgba(0, 0, 0, 0.1) !important;
          box-shadow: -10px 0 50px rgba(0, 0, 0, 0.2) !important;
        }

        .movi-context-menu.movi-context-menu-mobile.visible {
          transform: translateX(0) !important;
        }

        /* STRIP MODE ONLY: the host is a ~78px bar with overflow:visible, so the
           default translateX drawer slides OUT past the player's right edge and
           the closed drawer visibly escapes the boundary. Here we pin it inside
           the player and FADE in place (no horizontal slide) + truly hide when
           closed. Non-strip (full-size) players keep the normal slide drawer. */
        :host(.movi-audio-strip) .movi-context-menu.movi-context-menu-mobile {
          bottom: 0 !important;
          height: auto !important;
          max-width: min(350px, 100%) !important;
          margin: 0 !important;
          transform: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transition: opacity 0.2s ease, visibility 0s linear 0.2s !important;
        }
        :host(.movi-audio-strip) .movi-context-menu.movi-context-menu-mobile.visible {
          transform: none !important;
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transition: opacity 0.2s ease, visibility 0s linear 0s !important;
        }

        .movi-context-menu-item {
          padding: 10px 14px !important;
          margin: 2px 4px !important;
          font-size: 14px !important;
        }

        .movi-context-menu-icon {
          width: 18px !important;
          height: 18px !important;
          margin-right: 12px !important;
        }

        .movi-context-menu-submenu,
        .movi-context-menu-submenu-audio,
        .movi-context-menu-submenu-subtitle {
          /* Match the mobile menu panel: 80% width / 350px max, full height,
             anchored top-right. Sized in :host coords because submenus now
             live as siblings of the menu in shadowRoot. */
          position: absolute !important;
          top: 0 !important;
          right: 0 !important;
          left: auto !important;
          width: 80% !important;
          max-width: 350px !important;
          height: 100% !important;
          margin: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          border-left: 1px solid rgba(255, 255, 255, 0.1) !important;
          z-index: 20001 !important;
          background: rgba(15, 15, 22, 0.98) !important;
          transform: translateX(100%) !important;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          display: block !important;
          visibility: visible !important;
          pointer-events: none !important;
          max-height: none !important;
          overflow-x: hidden !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          padding: 16px 8px !important;
        }

        .movi-context-menu-submenu.movi-context-menu-submenu-visible,
        .movi-context-menu-submenu-audio.movi-context-menu-submenu-visible,
        .movi-context-menu-submenu-subtitle.movi-context-menu-submenu-visible {
          transform: translateX(0) !important;
          pointer-events: auto !important;
          opacity: 1 !important;
        }

        .movi-context-menu-shortcut {
          display: none !important; /* Shortcuts don't make sense on mobile */
        }

        /* Light theme mobile submenus */
        :host([theme="light"]) .movi-context-menu-submenu,
        :host([theme="light"]) .movi-context-menu-submenu-audio,
        :host([theme="light"]) .movi-context-menu-submenu-subtitle {
          background: rgba(255, 255, 255, 0.98) !important;
        }
      }

      /* Narrow viewports (≤ 480px) — keep touch-friendly sizes */
      @media (max-width: 480px) {
        .movi-btn {
          width: 40px !important;
          height: 40px !important;
          padding: 6px !important;
        }
        .movi-btn svg {
          width: 20px !important;
          height: 20px !important;
        }
        .movi-controls-left,
        .movi-controls-right {
          gap: 2px !important;
        }
        .movi-buttons-row {
          gap: 4px !important;
        }
        .movi-controls-bar {
          padding: 4px 8px 6px !important;
        }
        .movi-time {
          font-size: 10px !important;
        }

        /* Center play button on narrow viewports — 72px keeps it a
           comfortable tap target on phones (>44pt iOS HIG floor) while
           leaving more black space around the circle than the 84px
           sizing felt was eating on a 16:9 pane that fills a 430px
           phone. SVG scales accordingly. */
        .movi-center-play-pause {
          width: 72px !important;
          height: 72px !important;
        }
        .movi-center-play-pause svg {
          width: 38px !important;
          height: 38px !important;
        }

        /* Tighter OSD on very narrow viewports — at 480px the 16px base
           font wraps the track label across two lines and the pill grows
           taller than the video. */
        .movi-osd-container {
          padding: 5px 12px;
          gap: 6px;
        }
        .movi-osd-icon svg {
          width: 16px;
          height: 16px;
        }
        .movi-osd-text {
          font-size: 12px;
        }
      }

      /* Mobile Responsiveness for Context Menu */
      @media (max-width: 600px) {
        .movi-context-menu {
          min-width: 160px;
          font-size: 13px;
        }
        .movi-context-menu-item {
          padding: 8px 12px;
        }
        .movi-context-menu-shortcut {
          font-size: 10px;
          margin-left: 8px;
        }
        .movi-context-menu-submenu {
            min-width: 130px;
        }
        .movi-seek-thumbnail {
            transform: translateX(-50%) scale(0.85);
            /* Scale from the bottom edge, not the centre: the box is bottom-
               anchored (bottom:40px) and grows upward when the thumbnail image
               appears above the time. With the default centre origin a taller
               box shrinks toward its middle, lifting its bottom edge — so the
               time text jumps up the moment the thumb arrives. Anchoring the
               scale origin at the bottom keeps the time fixed either way. */
            transform-origin: bottom center;
            bottom: 40px;
        }
        
        .movi-osd-container {
            top: 20px;
            /* Scale the OSD pill so a multi-line label like "HDHub4u.Tv
               [ENG]" doesn't end up taller than a small embed's video
               area. Default sizing assumes a desktop viewport. */
            padding: 6px 14px;
            gap: 8px;
            border-radius: 22px;
            max-width: calc(100% - 32px);
        }
        .movi-osd-icon svg {
            width: 18px;
            height: 18px;
        }
        .movi-osd-text {
            font-size: 13px;
            line-height: 1.25;
        }
      }

      /* ========================================
         AUDIO STRIP MODE
         Activated when the source has audio but no playable video stream
         (and no embedded cover art). Collapses the player to a thin
         control strip — the layout the browser's native <audio controls>
         exposes — so the host element doesn't sit as a black box.
      ======================================== */
      :host(.movi-audio-strip) canvas,
      :host(.movi-audio-strip) video,
      :host(.movi-audio-strip) .movi-poster-overlay,
      :host(.movi-audio-strip) .movi-cover-art-overlay,
      :host(.movi-audio-strip) .movi-subtitle-overlay,
      :host(.movi-audio-strip) .movi-loading-indicator,
      :host(.movi-audio-strip) .movi-loader-container,
      :host(.movi-audio-strip) .movi-center-play-pause,
      :host(.movi-audio-strip) .movi-unmute-overlay,
      :host(.movi-audio-strip) .movi-broken-indicator,
      :host(.movi-audio-strip) .movi-empty-state {
        display: none !important;
      }
      /* Title + OSD in strip mode.
         Floating the title ABOVE the host collided with whatever sits above
         the player (the demo's URL bar, etc.), so when a title is present the
         strip grows into a 2-row layout: a slim title band INSIDE the host on
         top, the control row below it. The .movi-has-title class is toggled by
         updateTitle() so the height only grows when there's actually a title —
         an untitled audio strip stays the thin 56px bar.
         The OSD pill lands in that same top band (centred); since the title
         fades while the OSD is up (sibling combinator — osdContainer precedes
         titleBar in the shadow root) the two share the row without colliding.
         An untitled strip has no band, so its OSD floats just above the bar
         (transient, so a brief overlap with page content above is acceptable). */
      :host(.movi-audio-strip.movi-has-title) {
        min-height: 78px !important;
        height: 78px !important;
        max-height: 78px !important;
      }
      :host(.movi-audio-strip) .movi-title-bar {
        position: absolute;
        top: 9px !important;
        bottom: auto !important;
        left: 14px;
        right: 14px;
        /* !important: a desktop host may inject a ":host(:not(:fullscreen))
           .movi-title-bar { padding-top: 46px }" rule (macOS traffic-light
           clearance for the full-bleed video title) at equal specificity.
           In strip mode the player is a 56–78px bar, not a full window, so
           that clearance is wrong — it pushed the title down past the control
           row. Force the strip's own zero padding to win. */
        padding: 0 !important;
        background: none !important;
        opacity: 1 !important;
        transform: none !important;
        pointer-events: none;
        z-index: 6;
        transition: opacity 0.2s ease;
      }
      :host(.movi-audio-strip) .movi-title-text {
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.92);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
        line-height: 1.2;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-title-text {
        color: #11142d;
        text-shadow: none;
      }
      /* Strip mode zeroes the title bar's padding, but on touch the settings
         gear is shown pinned top-right (38px @ right:14px). Reserve room so the
         title truncates before it instead of running underneath. Only on
         coarse pointers — the gear is hidden on mouse/hover devices. */
      @media (pointer: coarse) {
        :host(.movi-audio-strip) .movi-title-bar {
          padding-right: 48px !important;
        }
      }
      /* The gear button otherwise centres a few px BELOW the small strip title
         text — nudge it up so their icon/text vertical centres line up. */
      :host(.movi-audio-strip) .movi-gear-btn {
        top: 1px !important;
      }
      /* Push the control row below the title band — only when titled. */
      :host(.movi-audio-strip.movi-has-title) .movi-controls-container,
      :host(.movi-audio-strip.movi-has-title) .movi-controls-container.movi-controls-hidden {
        top: 28px !important;
      }
      /* OSD: in the title band when titled; floats just above the bar when
         untitled. Inline display from showOSD() still toggles it on/off. */
      :host(.movi-audio-strip) .movi-osd-container {
        top: auto !important;
        bottom: calc(100% + 5px);
        padding: 7px 14px;
        gap: 8px;
        max-width: calc(100% - 24px);
      }
      :host(.movi-audio-strip.movi-has-title) .movi-osd-container {
        top: 4px !important;
        bottom: auto !important;
      }
      :host(.movi-audio-strip) .movi-osd-icon svg {
        width: 18px;
        height: 18px;
      }
      :host(.movi-audio-strip) .movi-osd-text {
        font-size: 13px;
      }
      /* While the OSD pill is up, fade the title so the two don't overlap.
         Sibling combinator works because osdContainer is appended to the
         shadow root before titleBar. */
      :host(.movi-audio-strip) .movi-osd-container.visible ~ .movi-title-bar {
        opacity: 0 !important;
      }
      /* !important here is unavoidable — the host's height is usually
         driven by the consumer's <movi-player width="..." height="...">
         attributes, which set inline styles with higher specificity than
         a stylesheet rule. Strip mode needs to override that to collapse
         the player to the control row's natural size. */
      :host(.movi-audio-strip) {
        min-height: 56px !important;
        height: 56px !important;
        max-height: 56px !important;
        background: var(--movi-surface, #0f0f0f);
        border-radius: 6px;
        /* "overflow: visible" is intentional — popups (speed menu,
           audio-track menu, right-click context menu) anchor inside the
           shadow root and open upward from the bar. With overflow:hidden
           they'd be clipped to the 56px strip and look invisible. The
           strip background itself is the host's solid colour, so visual
           bleed past the rounded corners is limited to popups when open. */
        overflow: visible !important;
        position: relative;
        /* The default host has "contain: layout style paint" and
           "container-type: inline-size" for perf isolation — both clip
           ANY descendant paint to the host's 56px box and re-anchor
           position:fixed to the host. In strip mode we explicitly want
           popups to escape the host visually (speed menu, audio-track
           menu, context menu open below the bar). Drop the paint and
           layout containment, but keep "style" (still safely scoped)
           and skip container-type so fixed positioning reaches the
           viewport again. */
        contain: style !important;
        container-type: normal !important;
      }
      :host(.movi-audio-strip[theme="light"]) {
        background: #f5f5f5;
        border: 1px solid rgba(0, 0, 0, 0.08);
      }
      /* Light-theme dark-icon overrides — the default video bar keeps
         white icons on a dark gradient regardless of theme, because it
         overlays a video. The strip has no video underneath, so on a
         light page surface the white icons read as invisible. Flip them
         (and the time text) back to the theme's dark text colour, and
         darken the progress-bar groove so the purple fill registers. */
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar,
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar .movi-btn,
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar .movi-time,
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar .movi-current-time,
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar .movi-duration {
        color: #11142d !important;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-controls-bar .movi-time-separator {
        color: rgba(17, 20, 45, 0.5) !important;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-progress-bar {
        background: rgba(0, 0, 0, 0.12) !important;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-progress-handle {
        background: #11142d !important;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-btn:hover {
        background: rgba(0, 0, 0, 0.06) !important;
      }
      /* Volume slider thumb/track also need to flip in light strip. */
      :host(.movi-audio-strip[theme="light"]) .movi-volume-slider::-webkit-slider-thumb {
        background: #11142d !important;
      }
      :host(.movi-audio-strip[theme="light"]) .movi-volume-slider {
        background: rgba(0, 0, 0, 0.18) !important;
      }
      /* The buffering shimmer was tuned for a dark bar — on a light
         groove the white gradient with mix-blend:screen disappears.
         Use a dark stripe and switch the blend mode so the animation
         reads as movement against the lighter background. */
      :host(.movi-audio-strip[theme="light"].is-buffering) .movi-progress-bar::after {
        background: linear-gradient(
          90deg,
          rgba(0, 0, 0, 0) 0%,
          rgba(17, 20, 45, 0.4) 50%,
          rgba(0, 0, 0, 0) 100%
        ) !important;
        background-size: 40% 100% !important;
        background-repeat: no-repeat !important;
        mix-blend-mode: multiply !important;
      }
      /* Controls live in the host's natural flow instead of floating above
         a video canvas — and stay visible regardless of hover state. */
      :host(.movi-audio-strip) .movi-controls-overlay {
        display: none !important;
      }
      /* Force the controls container visible in strip mode — its base rule
         is display:none flipped to .movi-controls-visible on hover. In
         strip mode there's no "hover to reveal" UX; the bar is the entire
         player surface. */
      :host(.movi-audio-strip) .movi-controls-container,
      :host(.movi-audio-strip) .movi-controls-container.movi-controls-hidden {
        display: flex !important;
        position: absolute !important;
        inset: 0 !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: none !important;
        background: transparent !important;
        padding: 0 12px;
        align-items: center;
      }
      /* Single-row layout: small play-pause / volume cluster on the left,
         progress bar takes the remaining width, time on the right. The
         vertical column the bar normally uses (progress on top, buttons
         below) wastes the horizontal real estate the strip has plenty of. */
      :host(.movi-audio-strip) .movi-controls-bar {
        background: transparent !important;
        padding: 0 !important;
        width: 100%;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 12px !important;
        min-height: 0 !important;
        box-shadow: none !important;
      }
      /* "display: contents" removes .movi-buttons-row from layout while
         keeping its children — controls-left and controls-right become
         direct flex items of .movi-controls-bar. Without this, the row's
         baseline width:100% would push the progress bar to zero width.
         The CSS "order" property then arranges the row as
         [left] [progress fills] [right] like native audio. */
      :host(.movi-audio-strip) .movi-buttons-row {
        display: contents !important;
      }
      :host(.movi-audio-strip) .movi-controls-left {
        order: 0 !important;
        flex: 0 0 auto !important;
      }
      :host(.movi-audio-strip) .movi-progress-container {
        order: 1 !important;
        flex: 1 1 auto !important;
        margin: 0 !important;
        min-width: 0 !important;
        width: auto !important;
      }
      :host(.movi-audio-strip) .movi-controls-right {
        order: 2 !important;
        flex: 0 0 auto !important;
      }
      /* Linear playback (no Range support, over-cap file): the scrubber and
         skip buttons stay — seeking is allowed but clamped in JS to the
         buffered RAM window. Only the timeline *strip* (thumbnail grid across
         the whole file) is dropped, since it needs full random access. */
      :host(.movi-linear) .movi-context-menu-item[data-action="timeline"] {
        display: none !important;
      }
      /* Keep the right-side cluster visible but trim it to controls that
         actually apply to audio playback. Subtitles, HDR, quality, PiP,
         fullscreen, and rotation are video-only — hiding the buttons
         instead of the whole container preserves audio-track switching
         (multi-lang files), speed, and the stable-audio compressor. */
      :host(.movi-audio-strip) .movi-controls-right {
        display: flex !important;
        align-items: center !important;
        flex: 0 0 auto !important;
        gap: 2px !important;
      }
      /* The desktop @media (hover) block initialises .movi-mobile-expandable
         with width:0 + overflow:hidden, expecting a hover-to-reveal flow.
         Strip mode has no hover affordance — the buttons live in the
         visible bar permanently — so unwind those defaults completely.
         Without overflow:visible here, downward-opening pop-ups (the new
         strip-mode position) get clipped to the 56px row even with the
         host's overflow:visible. */
      :host(.movi-audio-strip) .movi-mobile-expandable {
        display: flex !important;
        align-items: center !important;
        gap: 2px !important;
        width: auto !important;
        opacity: 1 !important;
        overflow: visible !important;
        pointer-events: auto !important;
      }
      /* The base CSS collapses .movi-speed-container, .movi-loop-btn,
         (and the now-strip-hidden quality + aspect-ratio) to width:0
         height:0 — they're meant to expand only when .movi-controls-right
         picks up .expanded via the more-button. In strip mode the more-
         button is hidden on desktop, so the buttons would be permanently
         zero-sized despite the cluster being "open". Force-restore the
         dimensions only for the audio-relevant ones (speed, loop) — the
         video-only collapsed buttons stay hidden via their own display:
         none strip rules. */
      :host(.movi-audio-strip) .movi-speed-container {
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
      }
      /* Loop is force-shown for ANY audio source (strip + cover-art view),
         not just the strip — it's relocated next to the more (<) button and
         must override the base mobile collapse (width/height:0) in both. */
      :host(.movi-audio-mode) .movi-loop-btn {
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
      }
      /* Video-only buttons. The right cluster mixes container divs (for
         buttons that have flyout menus) with bare <button>s — match both
         patterns. */
      :host(.movi-audio-mode) .movi-subtitle-track-container,
      :host(.movi-audio-mode) .movi-quality-container,
      :host(.movi-audio-mode) .movi-hdr-container,
      :host(.movi-audio-mode) .movi-aspect-ratio-btn,
      :host(.movi-audio-mode) .movi-pip-btn,
      :host(.movi-audio-mode) .movi-snapshot-btn,
      :host(.movi-audio-mode) .movi-rotate-btn,
      :host(.movi-audio-mode) .movi-fullscreen-btn {
        display: none !important;
      }
      /* In audio mode the album art is painted by the cover-art canvas (which
         persists through playback, unlike the pre-play poster overlay) — hide
         the raw poster <img> so it doesn't double up over the canvas. The
         poster URL still feeds the canvas via ensurePosterCoverArt(). */
      :host(.movi-audio-mode) .movi-poster-overlay {
        display: none !important;
      }
      /* Cover-art blurred backdrop. CSS filter:blur() is a real Gaussian in
         every browser (Chrome/Firefox/Safari, including old Safari) — unlike
         canvas ctx.filter, which Safari < 17 ignores. Oversized + scaled so the
         blur's soft edges stay outside the (overflow:hidden) overlay. */
      .movi-cover-art-bg {
        position: absolute;
        inset: -12%;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        filter: blur(40px) brightness(0.5);
        transform: scale(1.18);
        will-change: filter;
      }
      /* Strip-mode keyboard-shortcuts panel: the base CSS centres it
         inside the host via position:absolute + top:50%/left:50%, but
         the host is only 56px tall in strip mode so the panel lands
         half-off-screen above the bar. Switch to viewport-fixed
         centring so the panel sits cleanly in the page area below the
         strip. Also drop the video-only rows — fullscreen, PiP,
         frame-step, subtitle keys, aspect, rotate, HDR, snapshot,
         timeline don't apply to audio playback. */
      :host(.movi-audio-strip) .movi-shortcuts-panel {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
      }
      :host(.movi-audio-mode) .movi-shortcut-row[data-video-only] {
        display: none !important;
      }
      /* Same treatment for the Stats-for-Nerds panel — its default
         "position: absolute; top: 12px; left: 12px" anchors it inside
         the host, which is only 56px tall in strip mode so the panel
         body extends well past the bar and reads as broken. Switch to
         viewport-fixed in the top-left and trim min-width since there's
         no video metadata column (codec/res/fps/bitrate are mostly N/A
         for an audio file). */
      :host(.movi-audio-strip) .movi-nerd-stats {
        position: fixed !important;
        /* top/left are intentionally non-!important — JS in toggleNerdStats
           sets them as inline styles based on the strip's bounding rect,
           so the panel anchors just below the bar instead of overlapping
           its play/seek controls. */
        right: auto !important;
        bottom: auto !important;
        max-height: calc(100vh - 32px) !important;
        overflow-y: auto !important;
      }

      /* Mirror the same gate inside the right-click context menu —
         aspect ratio / PiP / fullscreen / rotate / ambient / snapshot
         / timeline make no sense for an audio-only source. Keep
         play-pause, speed, loop, stable-audio, nerd-stats and
         keyboard-shortcuts; everything else is video-frame work. */
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="fit"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="pip"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="fullscreen"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="rotate-video"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="ambient-toggle"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="snapshot"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="timeline"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="hdr-toggle"],
      :host(.movi-audio-mode) .movi-context-menu-item[data-action="subtitle-track"] {
        display: none !important;
      }
      /* The more-button reveals the mobile-expandable cluster. On a wide
         viewport everything's visible already, so the button is noise —
         hide. Below 600px the expandable collapses (rule further down)
         and the more-btn becomes the only way in. */
      :host(.movi-audio-strip) .movi-more-btn {
        display: none !important;
      }
      /* The seek bar is the strip's most-used affordance — make sure it
         renders at a usable height (the default ~4px hairline disappears
         inside a 32px button row). */
      :host(.movi-audio-strip) .movi-progress-bar {
        height: 6px !important;
        position: relative;
      }
      :host(.movi-audio-strip) .movi-progress-handle {
        width: 14px !important;
        height: 14px !important;
      }
      /* Strip-mode loading indicator. The centre spinner is hidden in
         strip mode, so when the player is buffering / seeking / doing the
         initial open, animate the progress bar instead. A moving stripe
         layered above the progress fill reads as "working on it" without
         disrupting the bar's normal time-line semantics. */
      /* Popup positioning in strip mode is JS-driven (setBottomMenuOpen
         switches the menu to position:fixed with viewport-relative top/
         left computed from the anchor button's getBoundingClientRect).
         An !important CSS top/bottom here would override those inline
         values and pin the menu under the 56px host instead. Only the
         transform-origin needs tweaking so the entrance scale still
         feels like it grows from where the button visually sits. */
      :host(.movi-audio-strip) .movi-audio-track-menu,
      :host(.movi-audio-strip) .movi-subtitle-track-menu,
      :host(.movi-audio-strip) .movi-quality-menu,
      :host(.movi-audio-strip) .movi-speed-menu,
      :host(.movi-audio-strip) .movi-stable-audio-menu {
        transform-origin: top right !important;
      }

      /* The ::after gradient stripe rides on top of the progress fill,
         buffer, and chapter markers — chapter-marker has z-index:3, so
         bump this above it. Also brighter colour stops since the gentle
         opacity on a thin bar against a dark background was almost
         imperceptible. */
      :host(.movi-audio-strip.is-buffering) .movi-progress-bar::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.55) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        background-size: 40% 100%;
        background-repeat: no-repeat;
        animation: movi-strip-buffer 1.05s linear infinite;
        pointer-events: none;
        z-index: 5;
        mix-blend-mode: screen;
      }
      @keyframes movi-strip-buffer {
        from { background-position: -40% 0; }
        to   { background-position: 140% 0; }
      }

      /* ─── Strip mode: responsive breakpoints ─────────────────────
         The strip has a fixed 56px host height regardless of width, so
         we trim buttons (not bar height) when the viewport gets narrow.
         Priority order, kept from widest to narrowest:
           always  → play/pause, progress, time, mute
           ≥ 480px → + seek±10s, volume slider
           ≥ 600px → + audio-track, speed, stable-audio, loop (inline)
           < 600px → those same buttons fold into the .movi-more-btn
                     popover (tap "…" to expand) — same UX as native
                     video mode on narrow viewports, no functionality
                     dropped, just gated behind one tap.
         Hidden buttons cascade so we don't have to repeat them at each
         lower step. */
      @media (max-width: 600px) {
        /* Surface the more-button on narrow strip widths and collapse
           the mobile-expandable cluster (audio-track / speed / stable
           / loop) back to its default closed state, matching the
           hover-to-expand UX video mode uses. */
        :host(.movi-audio-strip) .movi-more-btn {
          display: inline-flex !important;
        }
        :host(.movi-audio-strip) .movi-mobile-expandable {
          width: 0 !important;
          opacity: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }
        :host(.movi-audio-strip) .movi-controls-right.expanded .movi-mobile-expandable {
          width: auto !important;
          opacity: 1 !important;
          overflow: visible !important;
          pointer-events: auto !important;
        }
      }
      @media (max-width: 480px) {
        :host(.movi-audio-strip) .movi-seek-backward,
        :host(.movi-audio-strip) .movi-seek-forward,
        :host(.movi-audio-strip) .movi-volume-slider-container {
          display: none !important;
        }
        :host(.movi-audio-strip) .movi-controls-container {
          padding: 0 8px !important;
        }
        :host(.movi-audio-strip) .movi-time {
          font-size: 11px !important;
        }
        :host(.movi-audio-strip) .movi-btn {
          padding: 4px !important;
          height: 28px !important;
          width: 28px !important;
        }
        :host(.movi-audio-strip) .movi-btn svg {
          width: 16px !important;
          height: 16px !important;
        }
        :host(.movi-audio-strip) .movi-controls-bar {
          gap: 8px !important;
        }
      }
      /* Sub-360 ultranarrow (older phones in portrait): drop everything
         non-essential — even the time gets a compact mm:ss form via the
         time-separator hide. The seek bar is what users actually use. */
      @media (max-width: 360px) {
        :host(.movi-audio-strip) .movi-volume-container,
        :host(.movi-audio-strip) .movi-time-separator,
        :host(.movi-audio-strip) .movi-duration {
          display: none !important;
        }
      }
      /* Trim the per-button paddings the default bar uses for hover
         affordance — at 56px host height those add up to ~80px total. */
      :host(.movi-audio-strip) .movi-controls-left {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      :host(.movi-audio-strip) .movi-btn {
        padding: 6px !important;
        height: 32px !important;
        width: 32px !important;
      }
      :host(.movi-audio-strip) .movi-btn svg {
        width: 18px !important;
        height: 18px !important;
      }
      :host(.movi-audio-strip) .movi-time {
        font-size: 12px !important;
        white-space: nowrap;
      }
      /* The seek thumbnail tooltip is tied to a non-existent video frame
         in strip mode — suppress so the hover preview doesn't pop up. */
      :host(.movi-audio-strip) .movi-seek-thumbnail {
        display: none !important;
      }
    `;
    shadowRoot.appendChild(style);
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    Logger.warn(TAG, "WebGL context lost - suspending playback");

    if (this.player) {
      try {
        this._contextLostTime = this.player.getCurrentTime();
        this._contextLostPlaying = this.player.getState() === "playing";
        this.player.destroy();
      } catch (err) {
        // Ignore error during destroy context loss
      }
      this.player = null;
    }

    // Hide the canvas while the GL context is gone — otherwise the user sees
    // the last (now-corrupt) GPU framebuffer flash through as garbled pixels
    // before the loading spinner takes over. visibility:hidden keeps layout.
    this.canvas.style.visibility = "hidden";

    // Show the captured snapshot as a poster overlay (no-op if visibility
    // change already activated it). Covers cases where the context is lost
    // without a preceding visibility-hidden event.
    this._showSnapshotPoster();

    this.isLoading = true;
    this.updateControlsState();
    this.updateLoadingIndicator("loading");
  };

  private handleContextRestored = () => {
    Logger.info(TAG, "WebGL context restored - recovering playback");
    // handleContextLost set isLoading=true to show the spinner; clear it so
    // initializePlayer's early-return guard doesn't bail before re-creating
    // the player (otherwise the spinner stays forever after a long minimize).
    this.isLoading = false;
    this.initializePlayer().then(() => {
      if (this.player) {
        if (this._contextLostTime > 0) {
          this.player.seek(this._contextLostTime).catch(() => {});
        }
        if (this._contextLostPlaying) {
          this.player.play().catch(() => {
            // Mobile browsers block autoplay after long backgrounding because
            // the prior user gesture has expired. Force paused state so the UI
            // shows the play button and the user can tap to resume.
            if (this.player) this.player.pause();
          });
        }
      }
      // Reveal the canvas again — a fresh frame has been rendered (poster
      // seek inside initializePlayer or the seek above), so no garbled
      // framebuffer left behind.
      this.canvas.style.visibility = "";
      // Restore the poster overlay to whatever it was before context loss
      // (user-supplied poster, or hidden if there wasn't one).
      this._hideSnapshotPoster();
      // Clear recovery markers so the next initializePlayer (e.g. user picks
      // a new file) doesn't suppress the resume dialog or skip the seek.
      this._contextLostTime = 0;
      this._contextLostPlaying = false;
    });
  };

  connectedCallback() {
    // Enable keyboard focus. Set here (not in the constructor) because
    // assigning tabIndex reflects to a `tabindex` attribute, which a custom
    // element constructor is not allowed to do. (issue #9)
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;

    // Read initial attributes
    const srcAttr = this.getAttribute("src");
    this._src = srcAttr || null;
    this._autoplay = this.hasAttribute("autoplay");
    this._controls = this.hasAttribute("controls");
    // Mirror the controls attr as a host class so CSS can suppress chrome (e.g.
    // the "No Video" placeholder) on a bare, controls-less player — done with a
    // class rather than :host(:not([controls])), which is flaky in Safari/FF.
    this.classList.toggle("movi-no-controls", !this._controls);
    this._loop = this.hasAttribute("loop");
    this._muted = this.hasAttribute("muted");
    this._playsinline = this.hasAttribute("playsinline");
    this._preload =
      (this.getAttribute("preload") as "none" | "metadata" | "auto") || "auto";
    this._poster = this.getAttribute("poster") || "";
    const volumeAttr = this.getAttribute("volume");
    if (volumeAttr) this._volume = parseFloat(volumeAttr);
    const playbackRateAttr = this.getAttribute("playbackrate");
    if (playbackRateAttr) this._playbackRate = parseFloat(playbackRateAttr);
    const subtitleDelayAttr = this.getAttribute("subtitledelay");
    if (subtitleDelayAttr) {
      const parsed = parseFloat(subtitleDelayAttr);
      if (Number.isFinite(parsed)) this._subtitleDelay = parsed;
    }
    this._castFallbackSrc = this.getAttribute("castfallbacksrc") || "";
    this._ambientMode = this.hasAttribute("ambientmode");
    this._ambientWrapper = this.getAttribute("ambientwrapper");
    const objectFitAttr = this.getAttribute("objectfit");
    if (objectFitAttr) {
      const validFitModes: (
        | "contain"
        | "cover"
        | "fill"
        | "zoom"
        | "control"
      )[] = ["contain", "cover", "fill", "zoom", "control"];
      this._objectFit = validFitModes.includes(
        objectFitAttr.toLowerCase() as any,
      )
        ? (objectFitAttr.toLowerCase() as
            | "contain"
            | "cover"
            | "fill"
            | "zoom"
            | "control")
        : "contain";
    }

    // Update fit mode based on attributes
    this.updateFitMode();

    this._thumb = this.hasAttribute("thumb");
    this._hdr = this.hasAttribute("hdr") || this.getAttribute("hdr") === null; // Default to true if attribute is missing
    const themeAttr = this.getAttribute("theme");
    if (themeAttr === "light" || themeAttr === "dark") {
      this._theme = themeAttr;
    }

    this._gesturefs = this.hasAttribute("gesturefs");
    this._noHotkeys = this.hasAttribute("nohotkeys");
    this._fastSeek = this.hasAttribute("fastseek");
    this._doubleTap =
      !this.hasAttribute("doubletap") ||
      this.getAttribute("doubletap") !== "false"; // Default true unless explicitly false

    const startAtAttr = this.getAttribute("startat");
    if (startAtAttr) {
      this._startAt = parseFloat(startAtAttr);
    }

    const bufferSizeAttr = this.getAttribute("buffersize");
    if (bufferSizeAttr) {
      this._bufferSize = parseFloat(bufferSizeAttr);
    }

    this._themeColor = this.getAttribute("themecolor");
    if (this._themeColor) {
      this.style.setProperty("--movi-primary", this._themeColor);
    }

    // Update controls visibility based on initial attributes
    this.updateControlsVisibility();
    // Surface the unmute pill if this player will autoplay muted with
    // controls — checked here once initial attributes have been read.
    this.updateUnmuteOverlay();

    // Get external ambient wrapper element by ID
    this.updateAmbientWrapperElement();

    // Initialize ambient mode if enabled
    this.updateAmbientMode();

    // Update HDR UI to match default state
    this.updateHDRUI();

    // Update canvas size when element is connected
    this.updateCanvasSize();

    // Listen for WebGL context loss (e.g. minimizing on mobile)
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );

    // Capture the last visible frame just before the tab is hidden — by the
    // time webglcontextlost fires the GPU buffer is already gone, so snapshot
    // proactively. Used as a poster during context-loss recovery.
    document.addEventListener("visibilitychange", this._onVisibilityChange);

    // Initial state: disable controls except volume
    this.updateControlsState();
    this.updatePlayPauseIcon();
    this.updateFastSeek();
    this.updatePoster();

    // Publish the player's own width as a CSS custom property so
    // descendant CSS (subtitle font sizing in particular) can scale
    // against the player rather than the viewport.
    const publishPlayerWidth = () => {
      const w = this.clientWidth;
      const h = this.clientHeight;
      if (w > 0) this.style.setProperty("--movi-player-width", `${w}px`);
      // Track menus (subtitle / audio / quality) cap themselves at this
      // height so the panel never grows taller than the player itself.
      if (h > 0) this.style.setProperty("--movi-player-height", `${h}px`);
    };
    publishPlayerWidth();

    // Hydrate persisted subtitle appearance settings, then let any
    // explicit attributes override (precedence: attribute >
    // localStorage > built-in defaults). Finally push the resulting
    // values onto the host element as CSS variables so the shadow-DOM
    // subtitle styles pick them up immediately.
    this.loadSubtitleSettings();
    for (const attr of [
      "subtitlesize",
      "subtitlecolor",
      "subtitlebg",
      "subtitleedge",
    ]) {
      const val = this.getAttribute(attr);
      if (val !== null) this.applySubtitleAttribute(attr, val);
    }
    this.applySubtitleSettings();

    // Listen for resize events
    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(() => {
        publishPlayerWidth();
        this.syncTinyLayout();
        this.updateCanvasSize();
      });
      resizeObserver.observe(this);
    } else {
      // Fallback for browsers without ResizeObserver
      window.addEventListener("resize", () => {
        publishPlayerWidth();
        this.syncTinyLayout();
        this.updateCanvasSize();
      });
    }
    // Run once now so an already-tiny player folds fullscreen away on load.
    this.syncTinyLayout();

    // Initial visibility check
    this.updateControlsVisibility();

    // Check for required security headers
    this.checkSecurityHeaders();

    // Read encrypted attributes
    this._encrypted = this.hasAttribute("encrypted");
    this._tokenUrl = this.getAttribute("tokenurl") || "";
    this._videoUrl = this.getAttribute("videourl") || "";
    this._videoId = this.getAttribute("videoid") || "";
    this._resume = this.hasAttribute("resume");
    this._stableVolume = this.hasAttribute("stablevolume");
    this._audioOnly = this.hasAttribute("audioonly");

    // If no src attribute, check for <source> child elements (Video.js-style)
    if (!this._src && !this._encrypted) {
      const sourceEls = this.querySelectorAll("source");
      if (sourceEls.length > 0) {
        const allSources = Array.from(sourceEls).map((el) => ({
          src: el.getAttribute("src") || "",
          type: el.getAttribute("type") || undefined,
          kind: el.getAttribute("kind") || undefined,
          height: parseInt(el.getAttribute("data-height") || "", 10) || 0,
          label: el.getAttribute("data-label") || el.getAttribute("label") || "",
          fps: parseInt(el.getAttribute("data-fps") || "", 10) || 0,
          badge: el.getAttribute("data-badge") || "",
          srclang: el.getAttribute("srclang") || el.getAttribute("lang") || "",
          isDefault: el.hasAttribute("data-default") || el.hasAttribute("default"),
        })).filter((s) => s.src);

        // Separate audio sources (kind="audio") from video sources
        const audioSources = allSources.filter((s) => s.kind === "audio");
        const videoSources = allSources.filter((s) => s.kind !== "audio");

        if (videoSources.length > 0) {
          // Capture quality metadata for non-HLS quality menu
          this._videoQualities = videoSources
            .filter((s) => s.height > 0 || s.label)
            .map((s) => ({
              src: s.src,
              type: s.type,
              height: s.height,
              label: s.label || (s.height ? `${s.height}p` : ""),
              fps: s.fps || undefined,
              badge: s.badge || undefined,
            }))
            .sort((a, b) => b.height - a.height);

          // Prefer explicit data-default, otherwise pickSource heuristic
          const defaultSource = videoSources.find((s) => s.isDefault);
          if (defaultSource) {
            this._src = defaultSource.src;
          } else {
            const picked = this.pickSource(videoSources);
            this._src = picked ? picked.src : videoSources[0].src;
          }
        }

        // Multi-language audio: when more than one <source kind="audio"> is
        // declared with `srclang`/`label`, treat them as parallel language
        // tracks so the player surfaces the audio-language menu. Otherwise
        // fall back to the legacy single split-audio source path.
        if (audioSources.length > 0) {
          const langed = audioSources.filter((s) => s.srclang || s.label);
          if (audioSources.length > 1 && langed.length >= 2) {
            this._audioTracks = audioSources.map((s, i) => ({
              src: s.src,
              type: s.type,
              lang: s.srclang || `track-${i}`,
              label: s.label || s.srclang || `Track ${i + 1}`,
            }));
            // Pick a default for initial playback. Honour `default` /
            // `data-default` attributes; otherwise prefer the first track
            // matching the page locale, else the first one.
            const explicitDefault = audioSources.findIndex((s) => s.isDefault);
            const localePrefix = (navigator.language || "en").slice(0, 2).toLowerCase();
            const localeMatch = audioSources.findIndex(
              (s) => s.srclang && s.srclang.toLowerCase().startsWith(localePrefix),
            );
            const idx =
              explicitDefault >= 0
                ? explicitDefault
                : localeMatch >= 0
                  ? localeMatch
                  : 0;
            this._audioSrc = audioSources[idx].src;
          } else {
            this._audioSrc = audioSources[0].src;
          }
        }
      }
    }

    // Parse <track> child elements (Video.js / standard <video>-style) into
    // external subtitle tracks. Lets integrators declare captions
    // declaratively without having to wire up the JS source setter.
    const trackEls = this.querySelectorAll(
      'track[kind="subtitles"], track[kind="captions"], track:not([kind])',
    );
    if (trackEls.length > 0 && this._subtitleTracks.length === 0) {
      this._subtitleTracks = Array.from(trackEls)
        .map((el) => ({
          src: el.getAttribute("src") || "",
          lang: el.getAttribute("srclang") || el.getAttribute("lang") || "",
          label:
            el.getAttribute("label") ||
            el.getAttribute("srclang") ||
            "Subtitle",
          format: (el.getAttribute("data-format") as
            | "vtt"
            | "srt"
            | undefined) || "vtt",
        }))
        .filter((t) => t.src);
    }

    // Re-evaluate the poster overlay now that _src may have been populated
    // from <source> children. updatePoster() ran earlier in connectedCallback
    // (when _src was still null) and short-circuited because hasSource was
    // false; without this second pass the explicit poster="…" attribute
    // never paints when the player is loaded via <source> tags.
    this.updatePoster();

    // Automatically initialize player if src is set or encrypted mode
    if (this._src || (this._encrypted && this._tokenUrl && this._videoUrl)) {
      this.initializePlayer();
    }

    // Load saved settings (OPFS)
    SettingsStorage.getInstance()
      .load()
      .then((settings) => {
        let changed = false;

        // Apply volume if not explicitly set by attribute
        if (!this.hasAttribute("volume") && settings.volume !== undefined) {
          this._volume = settings.volume;
          this.updateVolume();
          changed = true;
        }

        // Apply muted if not explicitly set
        if (!this.hasAttribute("muted") && settings.muted !== undefined) {
          this._muted = settings.muted;
          this.updateMuted();
          changed = true;
        }

        // Apply playbackRate if not explicitly set
        if (
          !this.hasAttribute("playbackrate") &&
          settings.playbackRate !== undefined
        ) {
          this._playbackRate = settings.playbackRate;
          this.updatePlaybackRate();
          changed = true;
        }

        // User-toggled opt-in preferences ALWAYS win over the HTML default.
        // Rationale: the attribute is an integrator-set default; once the user
        // has toggled something via the UI their choice should stick across
        // reloads, even if the page still declares the attribute.

        // Apply stable volume preference
        if (settings.stableVolume !== undefined) {
          this._stableVolume = settings.stableVolume;
          if (settings.stableVolume) {
            this.setAttribute("stablevolume", "");
          } else {
            this.removeAttribute("stablevolume");
          }
          if (this.player) {
            this.player.setStableAudio(this._stableVolume);
            this.updateStableAudioUI();
          }
        }

        // Apply ambient mode preference
        if (settings.ambientMode !== undefined) {
          this._ambientMode = settings.ambientMode;
          if (settings.ambientMode) {
            this.setAttribute("ambientmode", "");
          } else {
            this.removeAttribute("ambientmode");
          }
          this.updateAmbientMode();
        }

        // Apply HDR preference (defaults to true)
        if (settings.hdr !== undefined) {
          this._hdr = settings.hdr;
          if (settings.hdr) {
            this.setAttribute("hdr", "");
          } else {
            this.removeAttribute("hdr");
          }
          this.updateHDRUI();
          if (this.player) this.player.setHDREnabled(this._hdr);
        }

        if (changed) {
          this.updateVolumeIcon();
          // Update external attributes to reflect loaded state
          if (settings.volume !== undefined)
            this.setAttribute("volume", settings.volume.toString());
          if (settings.muted) this.setAttribute("muted", "");
          if (settings.playbackRate !== undefined)
            this.setAttribute("playbackrate", settings.playbackRate.toString());
        }
      });
  }

  disconnectedCallback() {
    // If removed while in the iOS pseudo-fullscreen fallback, restore the page
    // scroll we locked and drop the resize listeners (setPseudoFullscreen(false)
    // won't run otherwise).
    if (this._pseudoFullscreen) {
      document.body.style.overflow = this._prevBodyOverflow;
      window.removeEventListener("resize", this._onPseudoFsResize);
      window.removeEventListener("orientationchange", this._onPseudoFsResize);
      this._pseudoFullscreen = false;
    }
    // Remove WebGL context listeners
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    // Cleanup nerd stats interval
    if (this.nerdStatsInterval) {
      clearInterval(this.nerdStatsInterval);
      this.nerdStatsInterval = null;
    }

    // Save position and stop resume saving
    if (this._resume) this.saveResumePosition();
    this.stopResumeSaving();

    // Cleanup event handlers
    this.eventHandlers.forEach((unsubscribe) => unsubscribe());
    this.eventHandlers.clear();

    // Remove document-level context menu handler
    if ((this as any)._documentContextMenuHandler) {
      document.removeEventListener(
        "contextmenu",
        (this as any)._documentContextMenuHandler,
        { capture: true },
      );
      delete (this as any)._documentContextMenuHandler;
    }

    // Stop ambient mode color sampling
    this.stopAmbientColorSampling();

    // Cleanup player when element is removed
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null,
  ) {
    switch (name) {
      case "thumb":
        this._thumb = newValue !== null;
        // Sync an already-created player so toggling `thumb` at runtime — or
        // declaring it after `src` (whose callback builds the player first) —
        // enables/disables scrub previews live instead of silently no-opping.
        this.player?.setPreviewsEnabled(this._thumb && !this._audioOnly);
        break;
      case "hdr":
        this.hdr = newValue !== null;
        break;
      case "theme":
        this.theme = (newValue as "light" | "dark") || "dark";
        break;
      case "gesturefs":
        this._gesturefs = newValue !== null;
        break;
      case "nohotkeys":
        this._noHotkeys = newValue !== null;
        break;
      case "startat":
        this._startAt = newValue ? parseFloat(newValue) : 0;
        break;
      case "fastseek":
        this._fastSeek = newValue !== null;
        this.updateFastSeek();
        break;
      case "doubletap":
        // usage: doubletap="false" to disable. Check existence? Or value?
        // Standard boolean attribute: presence = true.
        // But user might want to disable it.
        // Let's assume standard boolean: present = enabled? No, default is enabled.
        // Let's say attribute 'nodoubletap' or 'doubletap="false"'.
        // Re-reading user request: "doubletap (Boolean)"
        // Usually boolean attributes are false if missing, true if present.
        // If default is true, we should probably use 'disable-doubletap' or check for string "false".
        // Let's stick to: if attribute is present and not "false", it's true.
        // Wait, the request says property doubletap.
        // Let's assume if the attribute is present it sets the boolean value.
        // Since I made default true, logic is:
        this._doubleTap = newValue !== "false";
        break;
      case "themecolor":
        this._themeColor = newValue;
        if (newValue) {
          this.style.setProperty("--movi-primary", newValue);
        } else {
          this.style.removeProperty("--movi-primary");
        }
        break;
      case "buffersize":
        this._bufferSize = newValue ? parseFloat(newValue) : 0;
        if (this._bufferSize > 0) {
          this.player?.setMaxBufferSize(this._bufferSize);
        }
        break;
      case "title":
        if (this._stripTitleAttr) {
          this._stripTitleAttr = false;
          break;
        }
        this._title = newValue;
        this.updateTitle();
        // Strip attribute from host so the browser's native tooltip
        // doesn't appear on hover — title is shown via the overlay instead.
        if (newValue !== null) {
          this._stripTitleAttr = true;
          this.removeAttribute("title");
        }
        break;
      case "showtitle":
        this._showTitle = newValue !== null;
        this.updateTitle();
        break;
      case "resume":
        this._resume = newValue !== null;
        break;
      case "vr": {
        // Tokens: (bare)/360 → 360°, 180 → VR180, sbs/3d → stereo SBS,
        // fisheye → fisheye, littleplanet/planet → stereographic. resolveVRMode
        // reads the attribute live.
        const m = this.resolveVRMode();
        this.setVR360(m.enable, m.half, m.fisheye, m.sbs, m.stereographic);
        break;
      }
      case "stablevolume":
        this._stableVolume = newValue !== null;
        if (this.player) {
          this.player.setStableAudio(this._stableVolume);
          this.updateStableAudioUI();
        }
        break;
      case "audiooutput":
        // Accepts a concrete deviceId OR a label substring (resolved live).
        this._audioOutputDeviceId = newValue || "";
        this.applyAudioOutput();
        break;
      case "encrypted":
        this._encrypted = newValue !== null;
        break;
      case "tokenurl":
        this._tokenUrl = newValue || "";
        break;
      case "videourl":
        this._videoUrl = newValue || "";
        break;
      case "videoid":
        this._videoId = newValue || "";
        break;
      case "src": {
        // When switching from a File source to a URL, clear the File reference
        // so the URL path can proceed. Without this, the File instanceof check
        // blocks the URL from loading.
        if (this._src instanceof File && newValue) {
          if (this.player) {
            this.player.destroy();
            this.player = null;
          }
          this._src = null;
        }

        if (!(this._src instanceof File)) {
          const oldSrc = this._src;
          this._src = newValue || null;
          // New source → reset the "has been played" flag so the
          // next source's initial poster-seek "paused" transition
          // doesn't trigger a premature bar surface.
          if (newValue !== oldSrc) this._hasEverPlayed = false;

          // Show/hide empty state indicator based on src
          if (this.emptyStateIndicator) {
            if (!this._src && !this.player && !this._isUnsupported) {
              this.emptyStateIndicator.style.display = "flex";
            } else {
              this.emptyStateIndicator.style.display = "none";
            }
          }

          // Source changed — re-evaluate poster visibility (it's gated on
          // having an actual source so it doesn't paint in the empty state).
          this.updatePoster();

          // If src changed and element is connected, reload
          if (this.isConnected && this._src && this._src !== oldSrc) {
            this.load();
          }
        }
        break;
      }
      case "headers": {
        // Declarative form of the `headers` property — a JSON object string,
        // e.g. headers='{"Authorization":"Bearer <token>"}'. Applied to all
        // media network requests (manifest + segments + progressive). The
        // property setter (object form) is preferred for non-trivial maps.
        if (!newValue) {
          this._headers = null;
        } else {
          try {
            const parsed = JSON.parse(newValue);
            this._headers =
              parsed && typeof parsed === "object" ? parsed : null;
          } catch {
            Logger.warn(TAG, "Invalid headers JSON attribute; ignoring");
            this._headers = null;
          }
        }
        if (this.isConnected && (this._src || this._sourceAdapter)) {
          this.load();
        }
        break;
      }
      case "audioonly": {
        // Data-saver toggle: skip video decode (CPU) and, for adaptive streams,
        // fetch only audio (bandwidth). Demuxer flips live; streams reload.
        const enabled = newValue !== null;
        if (enabled === this._audioOnly) break;
        this._audioOnly = enabled;
        if (this.isConnected) this.applyAudioOnly();
        break;
      }
      case "autoplay":
        this._autoplay = newValue !== null;
        this.updateUnmuteOverlay();
        break;
      case "controls":
        this._controls = newValue !== null;
        this.classList.toggle("movi-no-controls", !this._controls);
        this.updateControlsVisibility();
        this.updateUnmuteOverlay();
        break;
      case "loop":
        this._loop = newValue !== null;
        this.updateLoopUI();
        // Update loop handler if player exists
        if (this.player) {
          this.setupEventHandlers();
          // Turning loop on while already at the end won't fire a fresh
          // "ended" event, so the just-bound loop handler never runs and
          // playback sits stuck. Kick off the replay here instead.
          if (this._loop && this.player.getState() === "ended") {
            this._loopRestartInFlight = true;
            this.play();
          }
        }
        break;
      case "muted":
        this._muted = newValue !== null;
        if (this.video) {
          this.video.muted = this._muted;
        }
        // Just propagate the muted state. Triggering play()/seek() here makes
        // every M-key toggle resume from pause, and was only ever meant for
        // the autoplay-muted → unmute startup flow (handled in
        // initializePlayer / restoreState instead).
        if (this.player) {
          this.updateMuted();
        } else {
          // No player yet — still keep the UI in sync. updateMuted() also
          // talks to the player, so when it's absent fall back to just
          // refreshing the icon and the unmute pill so the integrator
          // setting `muted` before src is wired up doesn't leave the
          // overlay/icon stale.
          this.updateVolumeIcon();
          this.updateUnmuteOverlay();
        }
        break;
      case "playsinline":
        this._playsinline = newValue !== null;
        if (this.video) {
          this.video.playsInline = this._playsinline;
        }
        break;
      case "preload":
        this._preload = (newValue as "none" | "metadata" | "auto") || "auto";
        break;
      case "poster":
        this._poster = newValue || "";
        this.updatePoster();
        break;
      case "subtitlesize":
      case "subtitlecolor":
      case "subtitlebg":
      case "subtitleedge":
        // Mutate _subtitleSettings via the shared parser, then push the
        // resulting CSS variables onto the host. Attributes win over
        // localStorage values for the lifetime of this element.
        this.applySubtitleAttribute(name, newValue);
        this.applySubtitleSettings();
        break;
      case "postertime":
        this._posterTime = newValue;
        // Don't auto-regenerate here. If the attribute change is followed by
        // a src change (common playlist flow), a stale generator would race
        // the new load and occasionally paint the old source's frame. The
        // poster is (re)generated from initializePlayer() instead, which
        // runs once per load on the correct source.
        break;
      case "width":
      case "height":
        this.updateCanvasSize();
        break;
      case "crossorigin":
        // Store but not used yet - would need MoviPlayer to support CORS
        break;
      case "volume":
        if (newValue !== null) {
          this._volume = parseFloat(newValue);
          if (this.player) {
            this.updateVolume();
          }
        }
        break;
      case "playbackrate":
        if (newValue !== null) {
          this._playbackRate = parseFloat(newValue);
          if (this.player) {
            this.updatePlaybackRate();
          }
        }
        break;
      case "subtitledelay":
        if (newValue !== null) {
          const parsed = parseFloat(newValue);
          if (Number.isFinite(parsed)) {
            this._subtitleDelay = parsed;
            if (this.player) {
              this.updateSubtitleDelay();
            }
          }
        } else {
          this._subtitleDelay = 0;
          if (this.player) {
            this.updateSubtitleDelay();
          }
        }
        break;
      case "castfallbacksrc":
        this._castFallbackSrc = newValue || "";
        if (this._remotePlayback) {
          const canCast =
            (this._remotePlayback.canCast && !!this.player?.canCast()) ||
            !!this._castFallbackSrc;
          this.updateRemotePlaybackUi(canCast, this._remotePlayback.canAirPlay);
        }
        break;
      case "ambientmode":
        this._ambientMode = newValue !== null;
        this.updateAmbientMode();
        break;
      case "ambientwrapper":
        this._ambientWrapper = newValue;
        this.updateAmbientWrapperElement();
        this.updateAmbientMode();
        break;
      case "renderer":
        // Default to canvas if invalid or null
        const validRenderers: RendererType[] = ["canvas"];
        const newRenderer: RendererType = validRenderers.includes(
          newValue as RendererType,
        )
          ? (newValue as RendererType)
          : "canvas";
        if (this._renderer !== newRenderer) {
          this._renderer = newRenderer;
          // Reload if source exists to apply renderer change
          if (this.isConnected && this._src) {
            this.load();
          }
        }
        break;
      case "objectfit":
        const validFitModes: (
          | "contain"
          | "cover"
          | "fill"
          | "zoom"
          | "control"
        )[] = ["contain", "cover", "fill", "zoom", "control"];
        const newFitMode =
          newValue && validFitModes.includes(newValue.toLowerCase() as any)
            ? (newValue.toLowerCase() as
                | "contain"
                | "cover"
                | "fill"
                | "zoom"
                | "control")
            : "contain";
        if (this._objectFit !== newFitMode) {
          this._objectFit = newFitMode;
          this.updateFitMode();
        }
        break;
      case "sw":
        if (newValue === "auto") {
          this._sw = "auto";
        } else if (newValue === "false") {
          this._sw = "auto";
        } else {
          this._sw = newValue !== null ? "software" : "auto";
        }
        // If sw attribute changes and element is connected with src, reload.
        // Suppressed during dispose() so clearing a per-source software
        // fallback doesn't trigger a reload of the about-to-be-replaced src.
        if (this.isConnected && this._src && !this._suppressSwReload) {
          this.load();
        }
        break;
      case "fps":
        this._fps = newValue ? parseFloat(newValue) : 0;
        // If fps changes and element is connected with src, reload
        if (this.isConnected && this._src) {
          this.load();
        }
        break;
    }
  }

  private _lastCanvasW: number = 0;
  private _lastCanvasH: number = 0;

  private updateCanvasSize() {
    const widthAttr = this.getAttribute("width");
    const heightAttr = this.getAttribute("height");

    let width: number;
    let height: number;

    // In fullscreen, use viewport dimensions
    if (document.fullscreenElement === this) {
      width = window.innerWidth;
      height = window.innerHeight;
    } else if (this._pseudoFullscreen) {
      // The host is CSS-sized (and, when forced-landscape, rotated) to fill the
      // viewport. Use its LAYOUT box (clientWidth/Height) — unlike
      // getBoundingClientRect it isn't affected by the rotate transform, so the
      // canvas buffer matches the un-rotated element the transform then turns.
      width = this.clientWidth;
      height = this.clientHeight;
    } else {
      const rect = this.getBoundingClientRect();
      width = widthAttr ? parseInt(widthAttr, 10) : rect.width;
      height = heightAttr ? parseInt(heightAttr, 10) : rect.height;
    }

    if (width > 0 && height > 0) {
      // Coalesce burst resizes (e.g. ResizeObserver during fullscreen
      // animation). Setting canvas.width clears the WebGL framebuffer
      // and CanvasRenderer.resize does heavy CSS/style writes — running
      // it many times per transition stalls the presentation loop.
      if (width === this._lastCanvasW && height === this._lastCanvasH) {
        return;
      }
      this._lastCanvasW = width;
      this._lastCanvasH = height;

      if (this.player) {
        // CanvasRenderer.resize() owns canvas.width/height (it accounts
        // for rotation). Setting them here too clears the framebuffer a
        // second time on every resize.
        this.player.resizeCanvas(width, height);
      } else {
        // Pre-init: keep buffer dims in sync so toDataURL etc. work.
        this.canvas.width = width;
        this.canvas.height = height;
      }
      // Repaint the cover-art overlay against the new host size. No-op
      // when the overlay is hidden (no bitmap / has video track) since
      // it bails before any drawImage work.
      this.updateCoverArtOverlay();
    }
  }

  /**
   * Toggle the LIVE indicator for live (dynamic) adaptive streams. Adds the
   * `.movi-live` host class (CSS shows the badge + hides the meaningless
   * wall-clock duration), and marks the badge `.behind` when the viewer has
   * scrubbed back into the DVR window so it reads grey instead of pulsing red.
   * Cheap + idempotent — safe to call on every timeupdate.
   */
  private updateLiveState(): void {
    const isLive = !!this.player?.isLiveStream?.();
    this.classList.toggle("movi-live", isLive);
    if (!isLive) return;
    const badge = this.shadowRoot?.querySelector(
      ".movi-live-badge",
    ) as HTMLElement | null;
    if (!badge) return;
    const edge = this.player?.getLiveEdge?.() ?? 0;
    const cur = this.player?.getCurrentTime?.() ?? 0;
    // >12s behind the edge → "behind" (not live). Matches YouTube's threshold.
    const behind = isFinite(edge) && edge - cur > 12;
    badge.classList.toggle("behind", behind);
  }

  /**
   * Paint embedded cover art (audio-only sources). Shows when:
   *   - the player has emitted a coverart bitmap, AND
   *   - there is no active video track (a real video would mask this anyway,
   *     but hiding upfront keeps unnecessary canvas work off the critical
   *     path for plain video files that happen to ship a thumbnail track).
   *
   * Layout: blurred fill of the artwork stretched over the full surface,
   * with the sharp artwork centred and sized to ~60% of the smaller host
   * dimension. Matches the YouTube Music / Apple Music aesthetic.
   */
  /**
   * For an audio-only source with a `poster` URL and no embedded album art,
   * lazily load the poster into an ImageBitmap so updateCoverArtOverlay can
   * paint it as album art (via the same blurred-backdrop cover-art canvas).
   * Idempotent: loads once per URL, clears when no longer applicable (source
   * became video, poster cleared, or embedded art arrived). Re-runs
   * updateCoverArtOverlay once the bitmap is ready.
   */
  private ensurePosterCoverArt(audioMode: boolean): void {
    const url =
      audioMode && !this.coverArtBitmap
        ? this._poster || this._generatedPosterUrl || ""
        : "";

    if (!url) {
      // No longer applicable — drop any loaded poster-cover bitmap.
      if (this._posterCoverBitmap) {
        try { this._posterCoverBitmap.close(); } catch {}
        this._posterCoverBitmap = null;
      }
      this._posterCoverUrl = "";
      this._posterCoverLoading = false;
      return;
    }

    // Already have it (or already loading it) for this exact URL — no-op.
    if (this._posterCoverUrl === url) return;

    this._posterCoverUrl = url;
    this._posterCoverLoading = true;
    const img = new Image();
    img.crossOrigin = "anonymous"; // album art must be CORS-clean to bitmap
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => {
      if (this._posterCoverUrl !== url) return; // superseded mid-load
      createImageBitmap(img)
        .then((bmp) => {
          if (this._posterCoverUrl !== url) { try { bmp.close(); } catch {}; return; }
          if (this._posterCoverBitmap) { try { this._posterCoverBitmap.close(); } catch {} }
          this._posterCoverBitmap = bmp;
          this._posterCoverLoading = false;
          this.updateCoverArtOverlay();
        })
        .catch(() => {
          this._posterCoverLoading = false;
          this.updateCoverArtOverlay(); // fall back to the strip
        });
    };
    img.onerror = () => {
      if (this._posterCoverUrl !== url) return;
      this._posterCoverLoading = false;
      this._posterCoverUrl = ""; // allow a retry if the URL is set again
      this.updateCoverArtOverlay();
    };
    img.src = url;
  }

  /** Downscale an album-art bitmap to a tiny JPEG data URL for the blurred
   *  backdrop. The backdrop is blurred to 40px, so ~96px is indistinguishable
   *  from full-res while keeping the URL small and the draw cheap. */
  private makeCoverArtBgUrl(bitmap: ImageBitmap): string {
    try {
      const max = 96;
      const ar = bitmap.width / bitmap.height;
      const w = Math.max(1, ar >= 1 ? max : Math.round(max * ar));
      const h = Math.max(1, ar >= 1 ? Math.round(max / ar) : max);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const cx = c.getContext("2d");
      if (!cx) return "";
      cx.drawImage(bitmap, 0, 0, w, h);
      return c.toDataURL("image/jpeg", 0.7);
    } catch {
      return "";
    }
  }

  private updateCoverArtOverlay(): void {
    const overlay = this.coverArtOverlay;
    const canvas = this.coverArtCanvas;
    if (!overlay || !canvas) return;

    const hasVideoTrack =
      !!this.player?.trackManager?.getActiveVideoTrack?.() ||
      (this._presentation === "native" && (this.video?.videoWidth ?? 0) > 0);
    const hasAudio = !!this.player?.hasAudibleSource?.();

    // Two related-but-distinct host states for an audio source (audio
    // track, no real video stream):
    //   .movi-audio-mode  — ANY audio source (with or without cover art).
    //     Drives hiding of video-only controls (PiP, fullscreen, rotate,
    //     aspect, snapshot, ambient, timeline, …) which make no sense for
    //     audio. Applies in cover-art mode too, so the artwork view isn't
    //     littered with inapplicable buttons.
    //   .movi-audio-strip — audio source WITHOUT artwork. Collapses the
    //     player to a native-<audio>-style 56px control strip. Cover art
    //     needs the full surface to paint, so strip layout is suppressed
    //     when a bitmap is present (audio-mode still hides the controls).
    // A failed load has NO tracks, so hasVideoTrack is always false and the
    // audio renderer (built at construction) makes hasAudibleSource() read true
    // — which wrongly flags a failed VIDEO/manifest as audio and, on the next
    // resize, collapses it to the 56px strip. In the error state there are no
    // tracks to trust, so decide from the src's own media type instead: a real
    // audio file stays a strip, a failed video/manifest shows full-size.
    // The SAME trap exists DURING load (idle/loading): tracks aren't resolved
    // yet, hasVideoTrack is still false, yet hasAudibleSource() already reads
    // true — so a resize mid-load (e.g. responsive layout settling, sidebar
    // toggling) collapses a still-loading VIDEO into the strip. Treat that
    // window like the error state and decide from the src's media type until
    // the real tracks arrive.
    const state = this.player?.getState?.();
    const errored = state === "error" || this._isUnsupported;
    const tracksUnresolved =
      !hasVideoTrack && (errored || state === "idle" || state === "loading");
    const srcIsAudio =
      typeof this._src === "string" &&
      this.guessMediaType(this._src).startsWith("audio/");
    // Audio-only (data-saver) forces the audio surface even on a video source —
    // we're deliberately not decoding the video, so show album art / strip.
    const audioMode =
      this._audioOnly ||
      (tracksUnresolved ? srcIsAudio : !hasVideoTrack && hasAudio);

    // Audio-only with a `poster` URL but no embedded album art: load the poster
    // into a bitmap and paint it through the cover-art canvas so it reads as
    // album art. Embedded art always wins. The effective bitmap below feeds the
    // strip decision + rendering just like real cover art.
    this.ensurePosterCoverArt(audioMode);
    const bitmap = this.coverArtBitmap ?? this._posterCoverBitmap;

    // VLC-like: if the source HAS an attached-picture track and previews are
    // on, cover art is on its way — hold the strip layout off until extraction
    // settles (_coverArtResolved) so we don't flash the 56px strip and then
    // reflow to the full cover-art surface. If extraction fails, the null
    // "coverart" event flips _coverArtResolved and we fall back to the strip.
    const hasArtTrack =
      (this.player?.trackManager?.getAttachedPicTracks?.()?.length ?? 0) > 0;
    const coverArtPending =
      audioMode && !bitmap && this._thumb && hasArtTrack && !this._coverArtResolved;
    // Same idea for a poster acting as album art: while its bitmap is still
    // loading, hold the strip off so we don't flash strip → album-art.
    const posterCoverPending =
      audioMode && !bitmap && this._posterCoverLoading;
    const stripMode =
      audioMode && !bitmap && !coverArtPending && !posterCoverPending;
    this.classList.toggle("movi-audio-mode", audioMode);
    this.classList.toggle("movi-audio-strip", stripMode);
    // In strip mode the gear is part of the always-visible bar, so reveal it the
    // moment the layout is applied (on load) rather than waiting for the first
    // touch/showControls. hideControls already keeps it visible in strip mode.
    if (stripMode && this.hasMediaSource()) {
      this.shadowRoot
        ?.querySelector(".movi-gear-btn")
        ?.classList.add("movi-gear-visible");
    }
    // Notify the embedding page when the strip state changes vs what we LAST
    // TOLD it — not vs the current class. load() clears movi-audio-strip on
    // every source change, so comparing to the class made a strip→non-strip
    // switch (e.g. a no-cover track followed by an album-art track) look
    // unchanged: the event never fired and the page's wrapper stayed collapsed
    // at 56/78px, squashing the album art into a black bar. _lastStripDispatched
    // survives load(), so the transition is detected and the wrapper reflows.
    if (stripMode !== this._lastStripDispatched) {
      this._lastStripDispatched = stripMode;
      // Tell the embedding page so it can collapse/restore its own wrapper. The
      // host shrinks to 56px via :host CSS, but a parent .player-stage with
      // aspect-ratio: 16/9 (or any fixed height) would still reserve its old
      // box and leave a black gap. Consumers listen on this — see index.html.
      this.dispatchEvent(
        new CustomEvent("audiostripchange", {
          detail: { strip: stripMode },
          bubbles: true,
          composed: true,
        }),
      );
    }

    // Audio mode (bare strip AND cover-art view): lift the loop button out of
    // the collapsed mobile-expandable so it stays visible to the RIGHT of the
    // "more" (<) button instead of hiding behind it on narrow widths. Restore
    // it into the cluster for video mode. Done deterministically (not just on
    // a mode transition) and only when out of place, so it survives audio↔video
    // src swaps and doesn't thrash the DOM on resize.
    const loopBtn = this.shadowRoot?.querySelector(".movi-loop-btn");
    const moreBtn = this.shadowRoot?.querySelector(".movi-more-btn");
    const expandable = this.shadowRoot?.querySelector(".movi-mobile-expandable");
    if (loopBtn && moreBtn && expandable) {
      if (audioMode && loopBtn.previousElementSibling !== moreBtn) {
        moreBtn.after(loopBtn);
      } else if (!audioMode && loopBtn.parentElement !== expandable) {
        expandable.appendChild(loopBtn);
      }
    }

    // Show the album-art overlay only when there's art AND we're in audio mode.
    // Keying off !audioMode (not hasVideoTrack) is what makes audio-only work on
    // a VIDEO source: the video track still exists (we just don't decode it), so
    // the old hasVideoTrack guard hid the art and left a black screen.
    if (!bitmap || !audioMode) {
      overlay.style.display = "none";
      if (this._coverArtBgEl) this._coverArtBgEl.style.backgroundImage = "none";
      return;
    }

    const rect = this.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    // Cap the backbuffer DPR — at 4K host sizes a 2x backbuffer + blur
    // filter chews ~50ms per resize on integrated GPUs.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelW = Math.floor(cssW * dpr);
    const pixelH = Math.floor(cssH * dpr);
    if (canvas.width !== pixelW) canvas.width = pixelW;
    if (canvas.height !== pixelH) canvas.height = pixelH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    // Blurred backdrop is now a CSS-blurred DOM element BEHIND this canvas — a
    // real Gaussian in every browser (canvas ctx.filter "blur()" is unsupported
    // in Safari < 17 and looked bad faked). Point it at the poster URL, or at a
    // baked-down data URL of the embedded album art (an ImageBitmap has no URL
    // of its own), so both cover-art sources get the same blurred surround. The
    // canvas paints only the sharp art.
    if (this._coverArtBgEl) {
      const bgUrl = this.coverArtBitmap ? this._coverArtBgUrl : this._posterCoverUrl;
      this._coverArtBgEl.style.backgroundImage = bgUrl
        ? `url("${bgUrl.replace(/"/g, '\\"')}")`
        : "none";
    }
    ctx.clearRect(0, 0, cssW, cssH); // transparent — let the blurred bg show

    const bitmapAR = bitmap.width / bitmap.height;

    // Centred sharp artwork — square, 60% of the smaller dimension. The
    // bitmap itself is rarely a perfect square, so contain it inside the
    // square frame (no crop) and let the blur backdrop fill the surround.
    const frameSize = Math.min(cssW, cssH) * 0.6;
    const artW = bitmapAR >= 1 ? frameSize : frameSize * bitmapAR;
    const artH = bitmapAR >= 1 ? frameSize / bitmapAR : frameSize;
    const artX = (cssW - artW) / 2;
    const artY = (cssH - artH) / 2;
    // Subtle shadow so the art doesn't bleed into its own blur.
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(bitmap, artX, artY, artW, artH);
    ctx.restore();

    overlay.style.display = "block";
  }

  /**
   * After an autoplay attempt, detect the browser blocking audio-with-sound
   * (AudioContext stuck suspended) and fall back to muted playback so the
   * video keeps rolling, then surface the "Tap to unmute" pill. No-op when
   * the user already asked for muted, has deliberately unmuted this session,
   * there's no audible source, or audio actually started. The AudioContext
   * resume() kicked off inside play() is async, so we give it a couple of
   * animation frames to settle before reading the state.
   */
  /**
   * Kick off autoplay: suppress the centre play overlay through the startup
   * window, call play(), and run the muted-autoplay fallback. Shared by the
   * initial load and the deferred (tab-was-hidden) path in _onVisibilityChange.
   */
  private async _startAutoplay(): Promise<void> {
    if (!this.player || !this._autoplay || this._isUnsupported) return;
    this._autoplayInvoked = true;
    // Suppress the center play overlay through the startup window so the big
    // play icon doesn't flash before playback begins on its own.
    this._autoplayStarting = true;
    this.updatePlayPauseIcon();
    await this.player.play().catch(() => {
      // Hard play() rejection (rare for canvas mode — video keeps going even
      // when audio can't). Surface the overlay so there's something to click;
      // the suspended-audio check below still runs.
      this._autoplayStarting = false;
      this.updatePlayPauseIcon();
    });
    // Browser autoplay policy blocks audio-with-sound silently: play() resolves
    // and video rolls, but the AudioContext stays suspended. Poll the audio
    // state and fall back to muted playback + a "Tap to unmute" pill.
    this.maybeFallbackToMutedAutoplay();
  }

  private maybeFallbackToMutedAutoplay(attempt: number = 0): void {
    if (!this.player || this._muted || this._userHasUnmuted) return;
    if (!this.player.hasAudibleSource()) return;

    // Give the async resume() a moment; re-check across a few frames before
    // concluding the context is genuinely blocked rather than mid-wakeup.
    if (!this.player.isAudioBlockedSuspended()) {
      if (attempt < 5) {
        requestAnimationFrame(() => this.maybeFallbackToMutedAutoplay(attempt + 1));
      }
      return;
    }

    // Confirmed blocked — mute and show the pill. Video continues; once the
    // user taps unmute (pill / volume / M-key), the gesture resumes the
    // context and audio plays. Mutate _muted directly (not the setter) so we
    // don't latch _userHasUnmuted — this mute is ours, not the user's.
    Logger.info(
      TAG,
      "Autoplay-with-sound blocked — falling back to muted playback (tap to unmute)",
    );
    this._autoMutedForAutoplay = true;
    this._muted = true;
    this.updateMuted(); // pushes mute to player + surfaces the pill
  }

  private updateMuted() {
    if (this.player) {
      // When muted, disable audio track processing (saves CPU)
      this.player.setMuted(this._muted);
    }
    // Update icon regardless of player presence so UI reflects state even
    // before src is set / player is initialized.
    this.updateVolumeIcon();
    this.updateUnmuteOverlay();
  }

  /**
   * Show a "Tap to unmute" pill when the player is set up to autoplay
   * muted (browsers block autoplay-with-sound) and the user has asked
   * for controls. Hides as soon as the player isn't muted, one of the
   * prerequisite attributes drops, or audio-track discovery proves
   * there's no audio to surface — reusing the same hasAudibleSource()
   * check that gates the volume button (see updateAudioTrackMenu).
   * Before the player is initialized hasAudibleSource() can't be
   * answered, so we optimistically show the pill on attrs alone and
   * let updateAudioTrackMenu re-call this once tracks are known.
   */
  private updateUnmuteOverlay() {
    const overlay = this.unmuteOverlay;
    if (!overlay) return;
    // The user unmuting clears the runtime auto-mute fallback latch too —
    // both the pill click and the setter set _userHasUnmuted, so this keeps
    // _autoMutedForAutoplay from re-showing the pill on a later re-mute.
    if (this._userHasUnmuted) this._autoMutedForAutoplay = false;
    const hasAudio = this.player ? this.player.hasAudibleSource() : true;
    // Two cases surface the pill:
    //  (a) integrator asked for `autoplay muted controls` — the classic
    //      autoplay-muted setup, pill gated on controls being present.
    //  (b) autoplay-with-sound was blocked and we muted as a fallback — the
    //      user never asked to mute, so the pill is their only route back to
    //      audio and must show even without a `controls` attribute.
    const shouldShow =
      this._muted && hasAudio && !this._userHasUnmuted &&
      ((this._controls && this._autoplay) || this._autoMutedForAutoplay);
    overlay.style.display = shouldShow ? "flex" : "none";
  }

  private updateVolume() {
    if (this.player) {
      // Only update volume if not muted (muted state overrides volume)
      if (!this._muted) {
        this.player.setVolume(this._volume);
      }
    }
    // Always update icon immediately to ensure UI reflects state even if not playing
    this.updateVolumeIcon();

    // Show OSD for volume (volume is 0-1, show as 0-100%)
    if (this.isConnected && !this.isLoading) {
      const volumePercent = Math.round(this._volume * 100);
      let icon = "";
      if (this._muted || this._volume === 0) {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;
      } else if (this._volume < 0.5) {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      } else {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      }

      // Only show if user interacting or specifically requested (simple logic: just check if player exists to avoid startup spam)
      // We add a check for timestamp to avoid showing on initial page load if we had a persistent volume setter
      // For now, simpler is better: if connected and player is ready
      // AND checks if audio tracks exist before showing OSD
      if (this.player && this.player.hasAudibleSource()) {
        this.showOSD(icon, `${volumePercent}%`);
      }
    }
  }

  private updateSubtitleDelay() {
    if (this.player) {
      this.player.setSubtitleDelay(this._subtitleDelay);
    }
    this.updateNativeSubtitleDelayRendering();
  }

  private updatePlaybackRate() {
    // Mark the rate-change time so the ambient sampler can stand down briefly
    // — its GPU readback otherwise blocks the main thread right when the
    // audio decoder is refilling, causing audible silence gaps.
    this._lastRateChangeTime = performance.now();
    if (this.player) {
      this.player.setPlaybackRate(this._playbackRate);
    }

    // Update menu UI to match current rate
    const speedItems = this.shadowRoot?.querySelectorAll(".movi-speed-item");
    speedItems?.forEach((item) => {
      const speed = parseFloat((item as HTMLElement).dataset.speed || "1");
      if (Math.abs(speed - this._playbackRate) < 0.01) {
        // Float comparison
        item.classList.add("movi-speed-active");
      } else {
        item.classList.remove("movi-speed-active");
      }
    });

    // Show OSD for speed
    if (this.isConnected && !this.isLoading && this.player) {
      this.showOSD(
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.64 18.36a9 9 0 1 1 12.72 0"></path><path d="m12 12 4-4"></path></svg>`,
        `${this._playbackRate}x`,
      );
    }
  }

  private updateFitMode() {
    if (this.player) {
      // Sync canvas/renderer dims to the player's CURRENT visual size
      // BEFORE we flip the fit mode. setFitMode kicks off an animated
      // re-fit that interpolates against containerWidth/containerHeight
      // — if those are stale (e.g. the player CSS-resized but no
      // ResizeObserver tick fired since), the animation aims at the
      // wrong target and the visible result snaps to the right size
      // only on the next window resize. By resizing first, the
      // animation runs against fresh dims AND the eventual settle
      // lands at the correct fit.
      const rect = this.getBoundingClientRect();
      const w =
        document.fullscreenElement === this ? window.innerWidth : rect.width;
      const h =
        document.fullscreenElement === this ? window.innerHeight : rect.height;
      if (w > 0 && h > 0) {
        // Bypass the dedup guard so resize fires even when the box
        // size is unchanged (the cached containerWidth on the
        // renderer might still be wrong).
        this._lastCanvasW = -1;
        this._lastCanvasH = -1;
        this.player.resizeCanvas(w, h);
        this._lastCanvasW = w;
        this._lastCanvasH = h;
      }

      if (this._objectFit === "control") {
        this.player.setFitMode(this._currentFit);
      } else {
        this.player.setFitMode(this._objectFit as any);
      }
    }

    if (this.posterElement) {
      this.posterElement.style.objectFit = this.posterObjectFit();
    }

    // Ensure icon matches the state immediately
    this.updateAspectRatioIcon();
  }

  // CSS object-fit only supports contain/cover/fill/none/scale-down. Map our
  // custom modes (zoom, control) to the closest visual match for the poster
  // overlay, since the canvas-side custom math doesn't apply to a plain <img>.
  private posterObjectFit(): string {
    const fit = this._objectFit === "control" ? this._currentFit : this._objectFit;
    if (fit === "zoom") return "cover";
    if (fit === "fill") return "fill";
    if (fit === "cover") return "cover";
    return "contain";
  }

  /**
   * Automatically create and initialize MoviPlayer
   */
  private async initializePlayer(): Promise<void> {
    // QoE: begin a new analytics session and start the startup timer.
    this._qoe.sessionStart(typeof this._src === "string" ? this._src : "");
    // Re-run the security-header check before any FFmpeg init. load() resets
    // _isUnsupported on every source change, which would otherwise let a
    // non-isolated context (e.g. embed iframe inside a third-party page that
    // doesn't set COOP+COEP) reach FFmpeg and surface a cryptic
    // "Failed to open media: Timeout at 0" instead of the proper
    // "Security Headers Missing" diagnostic.
    this.checkSecurityHeaders();
    if (this._isUnsupported) return;

    // If encrypted mode, use loadEncrypted instead
    if (this._encrypted && this._tokenUrl && this._videoUrl && !this.isLoading && !this.player) {
      try {
        const { generateFingerprint } = await import("../utils/Fingerprint");
        const fingerprint = await generateFingerprint();
        await this.loadEncrypted({
          videoUrl: this._videoUrl,
          tokenUrl: this._tokenUrl,
          videoId: this._videoId || "default",
          fingerprint,
          sessionToken: "session-" + Date.now(),
        });
      } catch (e) {
        Logger.error("MoviElement", "Failed to initialize encrypted source", e);
      }
      return;
    }

    if ((!this._src && !this._sourceAdapter) || this.isLoading || this.player || this._isUnsupported) {
      return;
    }

    this.isLoading = true;

    // Hide empty state indicator when loading begins
    if (this.emptyStateIndicator) {
      this.emptyStateIndicator.style.display = "none";
    }

    try {
      // Determine source type (URL or File) — skipped entirely when the
      // caller plugged in their own SourceAdapter.
      let source: SourceConfig | undefined;
      if (this._sourceAdapter) {
        source = undefined;
      } else if (this._src instanceof File) {
        // File object - use FileSource
        source = { type: "file", file: this._src };
      } else if (typeof this._src === "string") {
        // String - check if it's a URL
        if (
          this._src.startsWith("http://") ||
          this._src.startsWith("https://")
        ) {
          source = { type: "url", url: this._src };
        } else if (
          this._src.startsWith("blob:") ||
          this._src.startsWith("data:")
        ) {
          source = { type: "url", url: this._src };
        } else {
          // Assume it's a file path - treat as URL
          source = { type: "url", url: this._src };
        }
      } else {
        throw new Error("Invalid source type");
      }

      // Custom media headers: ride along on the SourceConfig (demuxer/HttpSource
      // path) AND as a top-level config field the stream wrappers read for
      // adaptive manifest + segment requests. One object, both code paths.
      if (this._headers && source && source.type === "url") {
        source.headers = this._headers;
      }

      // Read `thumb` straight from the DOM here rather than trusting the
      // cached `_thumb` field. The `src` attribute's own attributeChangedCallback
      // fires load() during element upgrade *before* the `thumb` callback (and
      // before connectedCallback) has populated `_thumb` — so with the usual
      // `<movi-player src=… thumb>` ordering, `_thumb` is still false at this
      // point and previews would silently never enable. hasAttribute reads the
      // live parsed attribute, which is already present, so order stops mattering.
      this._thumb = this.hasAttribute("thumb");

      // Create MoviPlayer instance
      // Configure MoviPlayer options
      const playerConfig: any = {
        source,
        decoder: this._sw,
        cache: { type: "lru", maxSizeMB: 520 },
        // Audio-only disables scrub-preview thumbnails too — they'd decode video
        // frames and defeat the CPU saving.
        enablePreviews: this._thumb && !this._audioOnly,
        ...(this._fps > 0 && { frameRate: this._fps }),
        ...(this._headers && { headers: this._headers }),
        ...(this._audioOnly && { audioOnly: true }),
        ...(this._sourceAdapter && { sourceAdapter: this._sourceAdapter }),
      };

      // Native vs canvas presentation. Adaptive streams, progressive MP4/WebM,
      // and DRM use the light-DOM <video> path unless presentation="canvas".
      const licenseUrl = this.getAttribute("licenseurl") || "";
      const isDrm = this.hasAttribute("drm") || licenseUrl.length > 0;
      const presentationAttr = this.getAttribute("presentation");
      const presentationOverride =
        presentationAttr === "canvas" || presentationAttr === "native"
          ? presentationAttr
          : undefined;
      const sourceForPresentation: SourceConfig | undefined =
        source?.type === "url" || source?.type === "file" || source?.type === "encrypted"
          ? source
          : undefined;
      const presentation = resolvePresentationMode({
        source: sourceForPresentation,
        presentation: presentationOverride,
        drm: isDrm,
        lcevc: this.hasAttribute("lcevc"),
        sourceAdapter: this._sourceAdapter ?? undefined,
      });
      this._presentation = presentation;
      playerConfig.presentation = presentation;

      // Separate audio source — multi-language or single
      if (this._audioTracks.length > 0) {
        playerConfig.audioTracks = this._audioTracks.map((t) => ({
          url: t.src,
          type: t.type,
          lang: t.lang,
          label: t.label,
        }));
      } else if (this._audioSrc) {
        playerConfig.audioSource = { type: "url", url: this._audioSrc } as SourceConfig;
      }

      // External subtitle tracks
      if (this._subtitleTracks.length > 0) {
        playerConfig.subtitleTracks = this._subtitleTracks.map((t) => ({
          url: t.src,
          lang: t.lang,
          label: t.label,
          format: (t.format as "vtt" | "srt" | undefined),
          id: t.id ?? t.src,
        }));
      }

      if (isDrm) {
        playerConfig.drm = true;
        if (licenseUrl) playerConfig.licenseUrl = licenseUrl;
        const rawHeaders = this.getAttribute("licenseheaders");
        if (rawHeaders) {
          try {
            playerConfig.licenseHeaders = JSON.parse(rawHeaders);
          } catch {
            Logger.warn(TAG, "Invalid licenseheaders JSON attribute; ignoring");
          }
        }
      }

      if (presentation === "native") {
        playerConfig.renderer = "video";
        this.canvas.style.display = "none";
        this.video.style.display = "block";
        this.video.setAttribute("playsinline", "");
        this.video.setAttribute("webkit-playsinline", "");
        this.video.disableRemotePlayback = false;
      } else {
        playerConfig.renderer = "canvas";
        playerConfig.canvas = this.canvas;
        this.canvas.style.display = "block";
        this.video.style.display = "none";
      }

      if (!playerConfig.drm && this.hasAttribute("lcevc")) {
        playerConfig.lcevc = true;
        const lcevcUrl = this.getAttribute("lcevcurl");
        if (lcevcUrl) playerConfig.lcevcUrl = lcevcUrl;
      }

      const mode =
        presentation === "native" ? "Native Video" : playerConfig.drm ? "DRM/Native Video" : "Canvas Renderer";
      Logger.info(TAG, `Initializing MoviPlayer (${mode} Mode)`);
      this.player = new MoviPlayer(playerConfig);

      // Bind device enumeration + apply any pending `audiooutput` selection
      // now that the audio engine exists.
      this.setupAudioOutputs();

      // Hand off any audio element preserved across a quality switch BEFORE
      // init() so setupNativeAudio reuses it instead of allocating a fresh
      // (and autoplay-blocked) Audio element.
      if (this._carryAudioEl) {
        try {
          (this.player as any).adoptNativeAudio?.(this._carryAudioEl);
        } catch {}
        this._carryAudioEl = null;
      }

      // Reset unsupported state
      this._isUnsupported = false;
      if (this.brokenIndicator) this.brokenIndicator.style.display = "none";

      this.updateControlsState();

      // Set up event handlers
      this.setupEventHandlers();

      // Show loading indicator
      this.updateLoadingIndicator("loading");

      // Set subtitle overlay for HTML-based rendering
      if (this.player) {
        this.player.setSubtitleOverlay(this.subtitleOverlay);
      }

      // Load the video
      if (this.player) {
        await this.player.load();
        // Apply any `buffersize` attribute set on the element before
        // load() — the source only exists after load() resolves, so
        // the attributeChangedCallback path couldn't have reached it.
        if (this._bufferSize > 0) {
          this.player.setMaxBufferSize(this._bufferSize);
        }
      }

      if (presentation === "native") {
        this.mountNativeStreamVideo();
        this._videoPresenter = new NativeVideoPresenter(this.video);
        this.setupRemotePlaybackControls();
        this.applyNativeCueStyles();
        this.syncNativeSubtitleTracks();
        this.updateSubtitleTrackMenu();
      } else {
        this._videoPresenter = new CanvasVideoPresenter(
          this.canvas,
          this.player,
          this,
        );
        if (this._castFallbackSrc) {
          this.setupRemotePlaybackControls();
        } else {
          this.updateRemotePlaybackUi(false);
          this.dispatchEvent(
            new CustomEvent("cancastchange", { detail: { canCast: false } }),
          );
        }
      }

      // Check for software decoding fallback (only for MoviPlayer/Canvas mode)
      // Don't show broken icon if sw attribute is set (user explicitly wants software decoding)
      if (
        this.player instanceof MoviPlayer &&
        this.player.isSoftwareDecoding() &&
        this._sw !== "software" &&
        this.getAttribute("sw") !== "auto" // Silent fallback for explicit "auto"
      ) {
        Logger.warn(
          TAG,
          "Hardware decoding not supported, falling back to software. Showing broken icon as per user request.",
        );
        this.handleUnsupportedVideo(
          "Format Unsupported",
          "This video codec is not supported by your browser's hardware acceleration.",
        );
        return;
      }

      // Apply properties
      this.updateVolume();
      this.updateMuted(); // Apply muted state before autoplay
      this.updatePlaybackRate();
      this.updateSubtitleDelay();
      this.updateCanvasSize(); // Ensure canvas size is synced after load overwrites
      this.updateFitMode();
      if (this.player) {
        this.player.setHDREnabled(this._hdr);
        this.player.setStableAudio(this._stableVolume);
        this.updateStableAudioUI();
        this.detectAndApplyVR360();
      }
      this.updateHDRVisibility();
      this.updateControlsVisibility();
      this.updateControlsState();

      // Update loading indicator after load
      this.updateLoadingIndicator();

      // Mobile 4K+ FileSource: hold the spinner and defer play() until the
      // initial preload settles. Reads height from the active video track.
      if (this.player) {
        const activeVideoTrack = (this.player as any)?.trackManager?.getActiveVideoTrack?.();
        const videoHeight = activeVideoTrack?.height ?? 0;
        if (
          MoviPlayer.isMobileDevice() &&
          videoHeight >= 2160 &&
          this.player.isFileSource() &&
          !this.player.isFileSourcePreloadComplete()
        ) {
          this._preloadGateActive = true;
          this.updateLoadingIndicator();
        }
      }

      // Auto-play if requested
      // Seek to initial position if set
      if (this._startAt > 0 && this.player) {
        await this.player.seek(this._startAt).catch((e: unknown) => {
          Logger.warn(TAG, "Failed to seek to start time", e);
        });
      } else if (
        this.player &&
        this.player.isFileSource() &&
        !this.player.isFileSourcePreloadComplete()
      ) {
        // Any FileSource: defer the resume dialog until preload settles so
        // the prompt doesn't compete with disk-I/O-heavy initial load.
        this._resumeDialogPending = true;
      } else {
        // Defer to the load finally-block: showing it here would surface the
        // prompt while isLoading is still true and the controls are disabled,
        // so the dialog appears before the chrome is interactive.
        this._resumeDialogPending = true;
      }

      // Start saving position periodically if resume enabled
      if (this._resume) {
        this.startResumeSaving();
      }

      // Auto-play if requested — but never while the tab is hidden. A
      // backgrounded autoplay kicks off a first-play seek the browser then
      // throttles (rAF paused, WakeLock denied); it times out into a buffering
      // state that doesn't cleanly resume on return (the user had to pause→play
      // to unstick it). Defer to the first time the tab is visible — which is
      // also how browsers gate background autoplay. _onVisibilityChange starts
      // it via _startAutoplay() once shown. The center play button stays visible
      // meanwhile (autoplayStarting unset), so a manual start works too.
      if (this._autoplay && this.player) {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          this._autoplayPendingVisible = true;
          Logger.info(TAG, "Autoplay deferred — tab hidden; will start when visible");
        } else {
          await this._startAutoplay();
        }
      } else if (this._startAt === 0 && this.player && !this._poster) {
        // Render the poster frame on canvas via a seek on the main decoder
        // (never the thumbnail pipeline). With a `postertime`, seek to that
        // timestamp to paint the poster frame, then — once it lands — reset
        // only the clock/playhead back to 0 (resetClockToStartForPoster keeps
        // the poster frame on the canvas; it does NOT re-seek). With no
        // postertime, just seek(0). An explicit poster URL (`_poster`) owns
        // the overlay, so we skip the seek entirely.
        const duration = this.player.getDuration() || 0;
        const posterTime =
          this._posterTime && this.parsePosterTime(this._posterTime, duration);
        // suppressSpinner keeps the loading UI hidden through the seek's
        // "seeking" window; the player auto-clears it on seek completion.
        if (posterTime) {
          // seek()'s promise resolves on demuxer.seek, BEFORE the frame is
          // decoded/painted — resetting the clock there races the poster frame
          // and loses it. Instead wait for the "seeked" event (fired from
          // notifySeekCompletion once the frame has actually landed), THEN
          // reset the clock to 0 with the poster frame already on the canvas.
          // _posterSeekActive blocks resume-saves through this window so the
          // poster timestamp isn't persisted as the resume position.
          this._posterSeekActive = true;
          this.player.once("seeked", () => {
            this.player?.resetClockToStartForPoster();
            this._posterSeekActive = false;
            // Poster frame is now on the canvas — snapshot it for lock-screen art.
            this.captureMediaSessionArtwork();
          });
          this.player
            .seek(posterTime, { suppressSpinner: true })
            .catch(() => {
              this._posterSeekActive = false;
            });
        } else {
          // Frame 0 lands on the canvas when "seeked" fires (the seek promise
          // resolves earlier, before paint) — snapshot it there for artwork.
          this.player.once("seeked", () => this.captureMediaSessionArtwork());
          this.player.seek(0, { suppressSpinner: true }).catch(() => {});
        }
      }

      // Start UI updates
      this.startUIUpdates();

      // Initialize ambient mode if enabled
      this.updateAmbientMode();
      this.updateAmbientUI();

      // Dispatch load event
      this.dispatchEvent(new Event("loadeddata"));
    } catch (error) {
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
      Logger.error(TAG, "Failed to initialize MoviPlayer", error);

      let message = "An unexpected error occurred while loading the video.";
      let title = "Initialization Failed";

      if (error instanceof Error) {
        message = error.message;

        // Check for CORS errors - these typically show as "Load failed" TypeError
        if (
          message.includes("Load failed") ||
          message.toLowerCase().includes("cors") ||
          message.toLowerCase().includes("access-control-allow-origin")
        ) {
          title = "Network Error";
          message =
            "Failed to fetch video resource. Check your connection or CORS settings.";
        } else if (message.includes("fetch")) {
          title = "Network Error";
          message =
            "Failed to fetch video resource. Check your connection or try again.";
        } else if (
          /out of bounds memory access|memory access out of bounds|RuntimeError|Aborted\(\)/i.test(message)
        ) {
          // Emscripten WASM crash (FFmpeg ran out of memory or hit an
          // OOB in a codec path). The "Try Software Decoding" button on
          // the broken-source overlay drives the fallback for this.
          title = "Playback Error";
          message =
            "The decoder ran out of memory while parsing this file. Try software decoding — it uses a different path that handles this case.";
        } else if (message.includes("decode")) {
          title = "Playback Error";
        } else if (/\(HTTP \d|was denied|could not be found|video server/i.test(message)) {
          // The stream wrapper already produced a precise HTTP reason (403/404/
          // 5xx/…); "Initialization Failed" reads like a player bug, so use a
          // neutral title and let the specific message carry the detail.
          title = "Can't Play Video";
        }
      }

      this.handleUnsupportedVideo(title, message);
    } finally {
      this.isLoading = false;
      // Flush deferred host play() calls, but not when autoplay already started
      // the internal player — that duplicates play() and races pause/buffer.
      if (this._pendingPlay && this.player && !this._isUnsupported) {
        this._pendingPlay = false;
        if (!this._autoplayInvoked) {
          this.player.play().catch(() => {});
        }
      } else {
        this._pendingPlay = false;
      }
      this.updateControlsState();
      this.updatePlayPauseIcon();
      // The resume dialog is held in _resumeDialogPending and surfaced on the
      // first transition to "playing" (see stateChangeHandler), so the prompt
      // only appears once playback has actually started and the bottom-bar
      // play icon has flipped to pause — not over disabled/paused chrome.
    }
  }

  /**
   * Set up event handlers for the player
   */
  get presenter(): VideoPresenter | null {
    return this._videoPresenter;
  }

  private mountNativeStreamVideo(): void {
    if (!this.player) return;
    const streamVideo = this.player.getNativeVideoElement();
    if (!streamVideo || streamVideo === this.video) return;

    streamVideo.style.width = "100%";
    streamVideo.style.height = "100%";
    streamVideo.style.display = "block";
    streamVideo.style.objectFit = this.video.style.objectFit || "contain";
    streamVideo.className = this.video.className;
    this.video.replaceWith(streamVideo);
    this.video = streamVideo;
    Logger.info(TAG, "Mounted native stream video element in light DOM");
  }

  private setupRemotePlaybackControls(): void {
    const castBtn = this.shadowRoot?.querySelector(
      ".movi-cast-btn",
    ) as HTMLButtonElement | null;
    const airplayBtn = this.shadowRoot?.querySelector(
      ".movi-airplay-btn",
    ) as HTMLButtonElement | null;

    this._remotePlayback = new RemotePlaybackController({
      video: this.video,
      getSourceUrl: () =>
        typeof this._src === "string" ? this._src : this.video.currentSrc || null,
      getContentType: () => {
        const src = typeof this._src === "string" ? this._src.toLowerCase() : "";
        if (src.includes(".m3u8")) return "application/vnd.apple.mpegurl";
        if (src.includes(".mpd")) return "application/dash+xml";
        if (src.includes(".webm")) return "video/webm";
        return "video/mp4";
      },
      onCanCastChange: (canCast) => {
        this.updateRemotePlaybackUi(canCast);
        this.dispatchEvent(
          new CustomEvent("cancastchange", { detail: { canCast } }),
        );
      },
    });

    const canCast =
      (this._remotePlayback.canCast && !!this.player?.canCast()) ||
      !!this._castFallbackSrc;
    const canAirPlay = this._remotePlayback.canAirPlay;
    this.updateRemotePlaybackUi(canCast, canAirPlay);
    this.dispatchEvent(
      new CustomEvent("cancastchange", {
        detail: { canCast: !!this.player?.canCast() },
      }),
    );

    castBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!this._remotePlayback) return;
      if (!this.player?.canCast() && this._castFallbackSrc) {
        this.dispatchEvent(
          new CustomEvent("castfallback", {
            detail: { src: this._castFallbackSrc },
            bubbles: true,
          }),
        );
        return;
      }
      try {
        await this._remotePlayback.requestCast();
      } catch (err) {
        Logger.warn(TAG, "Cast request failed", err);
        this.dispatchEvent(
          new CustomEvent("casterror", {
            detail: {
              message: err instanceof Error ? err.message : String(err),
            },
          }),
        );
      }
    });

    airplayBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._remotePlayback?.showAirPlayPicker();
    });
  }

  private updateRemotePlaybackUi(canCast: boolean, canAirPlay?: boolean): void {
    const castBtn = this.shadowRoot?.querySelector(
      ".movi-cast-btn",
    ) as HTMLElement | null;
    const airplayBtn = this.shadowRoot?.querySelector(
      ".movi-airplay-btn",
    ) as HTMLElement | null;
    const showCast =
      canCast ||
      (!!this._castFallbackSrc && (this._remotePlayback?.canCast ?? false));
    if (castBtn) castBtn.style.display = showCast ? "" : "none";
    if (airplayBtn) {
      airplayBtn.style.display =
        canAirPlay ?? this._remotePlayback?.canAirPlay ?? false ? "" : "none";
    }
  }

  private applyNativeCueStyles(): void {
    if (!this.shadowRoot) return;
    if (!this._nativeCueStyle) {
      const style = document.createElement("style");
      style.textContent =
        "video::cue{" +
        "font-size:calc(clamp(20px,calc(var(--movi-player-width,100vw)*0.032),40px)*var(--movi-sub-size-mult,1));" +
        "color:var(--movi-sub-color,#fff);" +
        "background-color:rgba(var(--movi-sub-bg-rgb,0,0,0),var(--movi-sub-bg-alpha,0.75));" +
        "text-shadow:var(--movi-sub-edge,none);" +
        "line-height:1.3;}";
      this.shadowRoot.appendChild(style);
      this._nativeCueStyle = style;
    }
    this.applySubtitleSettings();
  }

  private resolveNativeSubtitleSrc(src: string): string | null {
    if (!src) return null;
    if (src.startsWith("/")) return src;
    try {
      const parsed = new URL(src, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.href;
      }
    } catch {
      return null;
    }
    Logger.warn(
      TAG,
      `Skipping subtitle track with non-proxied URL (native <track> cannot send auth headers): ${src}`,
    );
    return null;
  }

  private syncNativeSubtitleTracks(): void {
    if (this._presentation !== "native") return;
    const video = this.video;
    for (const track of [...video.querySelectorAll("track")]) {
      track.remove();
    }
    for (const sub of this._subtitleTracks) {
      const src = this.resolveNativeSubtitleSrc(sub.src);
      if (!src) continue;
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = sub.label;
      track.srclang = sub.lang;
      track.src = src;
      if (sub.default) {
        track.default = true;
      }
      video.appendChild(track);
    }
    const textTracks = video.textTracks;
    let defaultShown = false;
    for (let i = 0; i < textTracks.length; i++) {
      if (textTracks[i].mode === "showing") {
        defaultShown = true;
        const matchingSub = this._subtitleTracks.find(
          (sub) => sub.label === textTracks[i].label,
        );
        if (matchingSub && this.player) {
          void this.player.selectExternalSubtitle(
            this.resolveExternalSubtitleId(matchingSub),
          );
        }
        continue;
      }
      textTracks[i].mode = "hidden";
    }
    if (!defaultShown && this.player) {
      const preferredSub =
        this._subtitleTracks.find((sub) => sub.default) ??
        (this._subtitleTracks.length === 1
          ? this._subtitleTracks[0]
          : undefined);
      if (preferredSub) {
        void this.player.selectExternalSubtitle(
          this.resolveExternalSubtitleId(preferredSub),
        );
      }
    }
    this.updateNativeSubtitleDelayRendering();
  }

  private stopNativeSubtitleDelayRendering(): void {
    if (this._nativeSubDelayFrameId !== null) {
      this.video.cancelVideoFrameCallback(this._nativeSubDelayFrameId);
      this._nativeSubDelayFrameId = null;
    }
    if (this.subtitleOverlay) {
      this.subtitleOverlay.innerHTML = "";
    }
  }

  private updateNativeSubtitleDelayRendering(): void {
    this.stopNativeSubtitleDelayRendering();
    if (this._presentation !== "native" || this._subtitleDelay === 0) {
      return;
    }

    const renderDelayedNativeSubtitles = () => {
      if (this._presentation !== "native" || this._subtitleDelay === 0) {
        return;
      }

      const adjustedTime = this.video.currentTime - this._subtitleDelay;
      let activeText = "";

      for (let i = 0; i < this.video.textTracks.length; i++) {
        const textTrack = this.video.textTracks[i];
        if (textTrack.kind !== "subtitles" && textTrack.kind !== "captions") {
          continue;
        }
        if (textTrack.mode === "showing") {
          textTrack.mode = "hidden";
        }
        const cues = textTrack.cues;
        if (!cues) continue;
        for (let j = 0; j < cues.length; j++) {
          const cue = cues[j];
          if (
            cue &&
            adjustedTime >= cue.startTime &&
            adjustedTime <= cue.endTime
          ) {
            activeText = (cue as VTTCue).text;
            break;
          }
        }
        if (activeText) break;
      }

      if (this.subtitleOverlay) {
        this.subtitleOverlay.innerHTML = "";
        if (activeText) {
          const block = document.createElement("div");
          block.className = "movi-subtitle-block";
          const line = document.createElement("div");
          line.className = "movi-subtitle-line";
          line.textContent = activeText;
          block.appendChild(line);
          this.subtitleOverlay.appendChild(block);
        }
      }

      this._nativeSubDelayFrameId = this.video.requestVideoFrameCallback(() => {
        this._nativeSubDelayFrameId = null;
        renderDelayedNativeSubtitles();
      });
    };

    renderDelayedNativeSubtitles();
  }

  private setupEventHandlers(): void {
    if (!this.player) return;

    // Remove existing listeners
    this.eventHandlers.forEach((unsubscribe) => unsubscribe());
    this.eventHandlers.clear();

    // Handle loop
    if (this._loop) {
      const loopHandler = () => {
        this._loopRestartInFlight = true;
        this.play();
      };
      this.player.on("ended", loopHandler);
      this.eventHandlers.set("ended", () =>
        this.player?.off("ended", loopHandler),
      );
    }

    // Handle audio track changes
    const audioTrackChangeHandler = () => {
      this.updateAudioTrackMenu();
      this.updateSubtitleTrackMenu();
      // Switching between muxed (AudioContext, boostable) and native audio
      // changes the volume ceiling — re-cap the slider.
      this.updateVolumeCap();
      this.dispatchEvent(new Event("audiotrackchange"));
    };
    this.player.trackManager.on("audioTrackChange", audioTrackChangeHandler);
    this.eventHandlers.set("audioTrackChange", () =>
      this.player?.trackManager.off(
        "audioTrackChange",
        audioTrackChangeHandler,
      ),
    );

    // Handle subtitle track changes
    const subtitleTrackChangeHandler = () => {
      this.updateSubtitleTrackMenu();
      this.dispatchEvent(new Event("subtitletrackchange"));
    };
    this.player.trackManager.on(
      "subtitleTrackChange",
      subtitleTrackChangeHandler,
    );
    this.eventHandlers.set("subtitleTrackChange", () =>
      this.player?.trackManager.off(
        "subtitleTrackChange",
        subtitleTrackChangeHandler,
      ),
    );

    // Handle tracks change (when media loads)
    const tracksChangeHandler = () => {
      this.updateCoverArtOverlay();
      this.updateAudioTrackMenu();
      this.updateSubtitleTrackMenu();
      this.updateQualityMenu();
      this.renderChapterMarkers();
      this.dispatchEvent(new CustomEvent("trackschange", {
        detail: {
          audio: this.player?.getAudioTracks() || [],
          video: this.player?.getVideoTracks() || [],
          subtitle: this.player?.getSubtitleTracks() || [],
          chapters: this.player?.getChapters() || [],
        },
      }));
    };
    this.player.trackManager.on("tracksChange", tracksChangeHandler);
    this.eventHandlers.set("tracksChange", () =>
      this.player?.trackManager.off("tracksChange", tracksChangeHandler),
    );

    const forwardDom = <K extends "waiting" | "playing" | "seeked">(
      event: K,
      mapper?: (value: unknown) => CustomEventInit,
    ) => {
      const handler = (detail: unknown) => {
        const init = mapper ? mapper(detail) : { detail };
        this.dispatchEvent(new CustomEvent(event, init));
      };
      this.player!.on(event, handler as never);
      this.eventHandlers.set(event, () =>
        this.player?.off(event, handler as never),
      );
    };
    forwardDom("waiting", () => ({}));
    forwardDom("playing", () => ({}));
    forwardDom("seeked", (time) => ({ detail: time }));

    const playerErrorHandler = (info: {
      message: string;
      category: string;
      severity: string;
    }) => {
      this.dispatchEvent(new CustomEvent("playererror", { detail: info }));
    };
    this.player.on("playerError", playerErrorHandler);
    this.eventHandlers.set("playerError", () =>
      this.player?.off("playerError", playerErrorHandler),
    );

    // Forward player events to element
    const stateChangeHandler = (state: PlayerState) => {
      Logger.info(TAG, `stateChange: ${state}`);
      // QoE: track stalls. Entering "buffering" starts a rebuffer timer; any
      // other state ends it (the first stall, before first frame, is startup).
      if (state === "buffering") this._qoe.bufferingStartNow();
      else this._qoe.bufferingEndNow();
      // A seek requested before the player was ready was held — apply it now
      // that we've reached a seekable state (fixes e.g. a PiP/handoff seek that
      // arrives while the source is still loading).
      if (
        this._pendingSeek !== null &&
        (state === "ready" || state === "paused" || state === "playing")
      ) {
        const target = this._pendingSeek;
        this._pendingSeek = null;
        this.currentTime = target;
      }
      // Hide poster on state change to playing
      if (state === "playing" && this.posterElement) {
        // Drop the frozen-frame snapshot overlay used during quality switch
        // so the live canvas underneath is visible again.
        if (this._qualitySwitchInProgress) {
          this._hideSnapshotPoster();
          this._qualitySwitchInProgress = false;
          this._switchResumeTime = 0;
          this._switchResumeDuration = 0;
        }
        this.posterElement.style.display = "none";
      }

      this.dispatchEvent(new CustomEvent("statechange", { detail: state }));
      this.updateLoadingIndicator(state);
      this.updateControlsState();
      this.updatePlayPauseIcon();

      // Autoplay suppression also ends when startup stops SHORT of playback —
      // e.g. the browser blocked autoplay pending a user gesture (common with a
      // separate native-audio track), leaving the player paused. play() doesn't
      // reject in that case and no "playing" event fires, so without this the
      // flag would stay set and keep the centre play button hidden. Clear it and
      // repaint so the big play affordance surfaces for a manual start.
      if (
        this._autoplayStarting &&
        (state === "paused" || state === "ended" || state === "error")
      ) {
        this._autoplayStarting = false;
        this.updatePlayPauseIcon();
      }

      if (state === "playing") {
        // Autoplay reached playback — startup window is over. Capture it
        // first so we can skip the click-confirmation UI below.
        const wasAutoplayStart = this._autoplayStarting;
        this._autoplayStarting = false;
        // Surface the resume prompt the moment playback first starts — i.e.
        // the first time the bottom-bar play icon flips to pause. Checked
        // before _hasEverPlayed flips below so it only fires on the very
        // first play. FileSource preload-gated paths still defer it via
        // preloadCompleteHandler; the flag guards against a double-show.
        if (this._resumeDialogPending && !this._hasEverPlayed) {
          this._resumeDialogPending = false;
          this.maybeShowResumeDialog();
        }
        this._hasEverPlayed = true;
        // Loop boundary fully settled (updatePlayPauseIcon above
        // already ran with the flag set, so the pause-confirmation
        // flash got suppressed). Clear here so a subsequent *user*
        // click still flashes the icon as confirmation.
        this._loopRestartInFlight = false;
        this.dispatchEvent(new Event("play"));
        // Autoplay had no user gesture, so there's no click to confirm —
        // hide the controls immediately rather than running the 200ms
        // pause-confirmation flash below.
        if (wasAutoplayStart) {
          this.hideControls();
          this.updatePlayPauseIcon();
          if (this._ambientMode) this._ambientSampleInterval = 200;
          this.updateMediaSession();
          this.updateMediaSessionPosition();
          this.captureMediaSessionArtwork();
          this.startStutterMonitor();
          this._qoe.firstFrame();
          this._qoe.playing();
          this.startQoeHeartbeat();
          return;
        }

        // Native-like: when playback starts, hide the controls unless the
        // user is actively interacting. Delayed ~200ms so the play→pause
        // icon swap above (updatePlayPauseIcon) has time to render and
        // be perceived by the user — instant hide felt like the click
        // never registered, since the bottom bar started fading before
        // the eye could catch the icon flip. 200ms is long enough to
        // see "I just pressed play and now it's a pause icon", short
        // enough that the bar isn't lingering after the fact.
        window.setTimeout(() => {
          if (
            this.player?.getState() === "playing" &&
            !this.isOverControls &&
            !this.isDragging &&
            !this.isTouchDragging &&
            !this.isAnyMenuOpen() &&
            // Timeline open: clicking a storyboard thumbnail seeks, which
            // flips state back to "playing" and would otherwise hide the
            // bar right under the user while they're still picking frames.
            !this.isTimelineOpen() &&
            // Skip the auto-hide if the user just touched the player —
            // covers the scrub-then-release path where the seek flips
            // state back to "playing" and would otherwise yank the bar
            // away under the user's finger. 1500ms is wide enough to
            // span the controls-container touchend's 1s re-show window
            // so the two timers don't fight.
            Date.now() - this.lastTouchTime > 1500
          ) {
            this.hideControls();
          }
        }, 200);
        // Reset ambient sampling cadence on resume — the adaptive backoff
        // can ratchet up to ~2s during seek/decode-recovery and would take
        // tens of seconds to shrink back via the per-sample 0.8x recovery.
        if (this._ambientMode) {
          this._ambientSampleInterval = 200;
        }
        // Update Media Session metadata + playing state + scrubber
        this.updateMediaSession();
        this.updateMediaSessionPosition();
        this.captureMediaSessionArtwork();
        // Watch for decode-can't-keep-up stutter to hint "play at 1x".
        this.startStutterMonitor();
        // QoE: first "playing" marks the first frame (startup time).
        this._qoe.firstFrame();
        this._qoe.playing();
        this.startQoeHeartbeat();
      } else if (state === "paused") {
        this.dispatchEvent(new Event("pause"));
        this.updateMediaSession();
        this.stopStutterMonitor();
        this._qoe.paused();
        this.stopQoeHeartbeat();
        // Don't auto-surface the bar on pause anymore — the centre
        // play button already comes back (via updatePlayPauseIcon's
        // paused branch) and tells the user playback is paused. The
        // old showControls() here re-popped the entire chrome on
        // every space-press or remote pause, which felt noisy after
        // the auto-hide cleanly faded it away. Hover / tap still
        // surfaces the bar manually.
        if (this._resume) this.saveResumePosition();
      } else if (state === "ended") {
        this.dispatchEvent(new Event("ended"));
        // Only surface the chrome when the player is actually
        // stopping. With `loop` on, the player immediately restarts
        // playback, so popping the bar for the brief end→play
        // transition was just a noisy flash on every loop boundary.
        if (!this._loop) this.showControls();
        // Clear resume position when video ends (start fresh next time)
        if (this._resume) this.clearResumePosition();
        this.updateMediaSession();
        this.stopStutterMonitor();
        this._qoe.ended();
        this.stopQoeHeartbeat();
      }
    };
    this.player.on("stateChange", stateChangeHandler);
    this.eventHandlers.set("stateChange", () =>
      this.player?.off("stateChange", stateChangeHandler),
    );

    // Handle loadEnd event to hide loading indicator
    const loadEndHandler = () => {
      this.updateLoadingIndicator(this.player?.getState() || "idle");
      this.updateControlsState();
      this.updatePlayPauseIcon();
      // Cap the volume slider at 100% for native-audio sources (streams /
      // native split-source), 200% otherwise, now that the audio path is known.
      this.updateVolumeCap();
      // Tracks are now finalised; pick the right visual mode (video
      // surface / cover-art overlay / audio strip). Cover-art extraction
      // is async, so the strip may flip OFF later when the coverart
      // event lands — updateCoverArtOverlay handles both transitions.
      this.updateCoverArtOverlay();
      // Live (dynamic) streams: show the LIVE indicator + hide the meaningless
      // wall-clock duration.
      this.updateLiveState();
      // Backstop for the "linearmode" event in case it fired before this
      // listener was wired (detection happens during the demux open).
      if (this.player?.isLinearPlayback?.()) this.enterLinearMode();
      // Wire OS lock-screen / hardware-key controls and seed metadata now that
      // tracks (and thus title/duration) are finalised.
      this.updateMediaSession();
      this.updateMediaSessionPosition();
      this.dispatchEvent(new Event("loadeddata"));
    };
    this.player.on("loadEnd", loadEndHandler);
    this.eventHandlers.set("loadEnd", () =>
      this.player?.off("loadEnd", loadEndHandler),
    );

    // Release the mobile 4K+ preload gate when FileSource finishes its
    // initial chunk preload. Always fires (success, error, or abort) so the
    // gate can never get stuck. After release, flush any deferred play().
    const preloadCompleteHandler = () => {
      // The deferred resume dialog is no longer surfaced here — it now waits
      // for the first "playing" transition (see stateChangeHandler) so the
      // prompt only appears once playback has actually started. The pending
      // flag is left intact for that handler to consume.
      if (!this._preloadGateActive) return;
      this._preloadGateActive = false;
      this.updateLoadingIndicator(this.player?.getState() || "idle");
      if (this._pendingPlay && this.player && !this._isUnsupported) {
        this._pendingPlay = false;
        this.player.play().catch(() => {});
      }
      this.updateControlsState();
      this.updatePlayPauseIcon();
    };
    this.player.on("preloadcomplete", preloadCompleteHandler);
    this.eventHandlers.set("preloadcomplete", () =>
      this.player?.off("preloadcomplete", preloadCompleteHandler),
    );

    // Source fell back to linear (non-seekable) playback — drop the timeline,
    // seeking and thumbnails.
    const linearModeHandler = () => this.enterLinearMode();
    this.player.on("linearmode", linearModeHandler);
    this.eventHandlers.set("linearmode", () =>
      this.player?.off("linearmode", linearModeHandler),
    );

    const timeUpdateHandler = (time: number) => {
      this.dispatchEvent(new CustomEvent("timeupdate", { detail: time }));
      this.updateLiveState();
      // Keep the seek slider's screen-reader ARIA current even while the visual
      // chrome is auto-hidden (updateTimeDisplay is gated on visible controls).
      this.updateSeekAria();
      // Refresh the OS scrubber at ~1s granularity, or immediately on a jump
      // (seek) so the lock-screen position doesn't lag.
      if (Math.abs(time - this._mediaSessionLastPos) >= 1) {
        this._mediaSessionLastPos = time;
        this.updateMediaSessionPosition();
      }
    };
    this.player.on("timeUpdate", timeUpdateHandler);
    this.eventHandlers.set("timeUpdate", () =>
      this.player?.off("timeUpdate", timeUpdateHandler),
    );

    const fileRevokedHandler = (info: { offset: number; length: number; reason: string }) => {
      this.dispatchEvent(new CustomEvent("filerevoked", { detail: info, bubbles: true, composed: true }));
    };
    this.player.on("filerevoked", fileRevokedHandler);
    this.eventHandlers.set("filerevoked", () =>
      this.player?.off("filerevoked", fileRevokedHandler),
    );

    const errorHandler = (error: unknown) => {
      this._qoe.error(
        error instanceof Error ? error.message : String(error),
        true,
      );
      this.dispatchEvent(new CustomEvent("error", { detail: error }));
      // Always log the raw error before the message gets prettified for
      // the overlay — without this, "State: ... -> error" appears in
      // the log without any "what crashed" line and debugging requires
      // the user to take a screenshot of the overlay.
      Logger.error(TAG, "Player error event", error);

      let message = "An error occurred during playback.";
      let title = "Playback Error";

      if (error instanceof Error) {
        message = error.message;
      } else if (typeof error === "string") {
        message = error;
      }

      // Prettify the raw HttpSource messages — surfaced verbatim they read
      // like "HTTP 503" or "Stream failed after maximum retries" which means
      // nothing to a user staring at a buffering UI that just gave up.
      const httpMatch = message.match(/^HTTP (\d{3})/);
      if (httpMatch) {
        const code = httpMatch[1];
        title = "Network Error";
        if (code === "404") message = "Video not found (HTTP 404).";
        else if (code === "403") message = "Access denied (HTTP 403). Check video permissions.";
        else if (code === "401") message = "Authentication required (HTTP 401).";
        else if (code.startsWith("5")) message = `Server error (HTTP ${code}). Try again later.`;
        else message = `Network error (HTTP ${code}).`;
      } else if (message.includes("Stream failed after")) {
        title = "Network Error";
        message = "Connection lost. The server stopped responding.";
      } else if (
        message.toLowerCase().includes("cors") ||
        message.includes("Failed to fetch video resource")
      ) {
        title = "Network Error";
      } else if (message.includes("does not support range requests")) {
        title = "Server Not Supported";
      } else if (
        // WebAssembly OOM / OOB from the FFmpeg WASM runtime — surfaces
        // verbatim as "Out of bounds memory access (evaluating 'qe(...$e)')"
        // (minified) or "memory access out of bounds". Replace the
        // emscripten/JS-engine text with something useful and steer the
        // user to the software-decode fallback that already handles the
        // codec variants where the hardware path explodes.
        /out of bounds memory access|memory access out of bounds|RuntimeError|Aborted\(\)/i.test(message)
      ) {
        title = "Playback Error";
        message =
          "The decoder ran out of memory while parsing this file. Try software decoding — it uses a different path that handles this case.";
      }

      this.handleUnsupportedVideo(title, message);
    };
    this.player.on("error", errorHandler);
    this.eventHandlers.set("error", () =>
      this.player?.off("error", errorHandler),
    );

    const coverArtHandler = (bitmap: ImageBitmap | null) => {
      // Don't close the previous bitmap here — MoviPlayer owns its instance
      // and reuses one on subsequent loads. Our reference can be dropped
      // safely; the player will close() when it stomps its own slot.
      this.coverArtBitmap = bitmap;
      // Bake a tiny data URL from the art so the CSS-blurred backdrop can use
      // it (the poster path already had a URL; embedded art didn't). Generated
      // once here, not on every resize.
      this._coverArtBgUrl = bitmap ? this.makeCoverArtBgUrl(bitmap) : "";
      // Extraction has settled (success or failure) — release the strip-layout
      // hold so a failed extraction falls back to the strip cleanly.
      this._coverArtResolved = true;
      this.updateCoverArtOverlay();
      // Re-dispatch to the embedding page (background art, MediaSession
      // artwork, etc.). The bitmap is owned by the player — listeners must
      // not close() it. bubbles/composed so it escapes the shadow root.
      // Only forward real bitmaps; the null signal is internal.
      if (bitmap) {
        // Refresh the OS lock-screen artwork with the real album art now that
        // it's decoded (metadata was seeded earlier with no / a fallback image).
        this.setMediaSessionArtworkFromBitmap(bitmap);
        this.dispatchEvent(
          new CustomEvent("coverart", {
            detail: { bitmap, width: bitmap.width, height: bitmap.height },
            bubbles: true,
            composed: true,
          }),
        );
      }
    };
    this.player.on("coverart", coverArtHandler);
    this.eventHandlers.set("coverart", () =>
      this.player?.off("coverart", coverArtHandler),
    );
  }

  /**
   * Load the video source (automatic when src is set)
   */
  async load(): Promise<void> {
    // Reset auto-loaded title flag and duration tracker for new video
    this._titleAutoLoaded = false;
    this._lastDuration = 0;

    // Drop any stale cover art from the previous source. The reference is
    // owned by MoviPlayer; we just clear our own pointer and hide the
    // overlay so the new load doesn't briefly show last track's art.
    this.coverArtBitmap = null;
    this._coverArtBgUrl = "";
    this._coverArtResolved = false;
    // Drop the poster-as-album-art bitmap too — we own it, so close to free it.
    if (this._posterCoverBitmap) { try { this._posterCoverBitmap.close(); } catch {} }
    this._posterCoverBitmap = null;
    this._posterCoverUrl = "";
    this._posterCoverLoading = false;
    if (this.coverArtOverlay) this.coverArtOverlay.style.display = "none";
    // Also drop the audio-mode/strip layout — re-decided once the new
    // source's tracks land via loadEnd → updateCoverArtOverlay.
    this.classList.remove("movi-audio-strip", "movi-audio-mode");

    this.resetTimeline();

    // Clear chapter markers
    if (this.shadowRoot) {
      const markers = this.shadowRoot.querySelector(".movi-chapter-markers") as HTMLElement;
      if (markers) markers.innerHTML = "";
    }

    if (this.player) {
      // If player exists, destroy and recreate
      this.player.destroy();
      this.player = null;
    }

    // Reset unsupported and loading state on source change so new source can load
    this._isUnsupported = false;
    this.isLoading = false;
    // Drop any autoplay deferred for the previous source — initializePlayer
    // re-arms it for the new one if still hidden.
    this._autoplayPendingVisible = false;
    if (this.brokenIndicator) this.brokenIndicator.style.display = "none";
    // A fresh source may well support Range — clear any linear-mode lock.
    this._linearMode = false;
    this.classList.remove("movi-linear");

    // Show empty state if no src after player cleanup
    if (!this._src && this.emptyStateIndicator) {
      this.emptyStateIndicator.style.display = "flex";
    }

    await this.initializePlayer();
  }

  /**
   * Play the video
   */
  async play(): Promise<void> {
    if (this._isUnsupported) return;
    if (this._elementPlayPromise) {
      return this._elementPlayPromise;
    }
    this._elementPlayPromise = this.playInternal().finally(() => {
      this._elementPlayPromise = null;
    });
    return this._elementPlayPromise;
  }

  private async playInternal(): Promise<void> {
    // If a load is in flight, defer the play. initializePlayer() flushes
    // this once loading settles, matching HTMLMediaElement.play() semantics.
    if (this.isLoading) {
      this._pendingPlay = true;
      return;
    }
    // Mobile 4K+ FileSource: defer until the preloadcomplete event fires,
    // which flushes _pendingPlay through the same path.
    if (this._preloadGateActive) {
      this._pendingPlay = true;
      return;
    }
    if (this.player) {
      // Replay-from-ended and first-play both re-seek through the seek
      // pipeline; the player suppresses the spinner for those internal seeks
      // itself (suppressSeekSpinner), so no element-side handling is needed.
      await this.player.play();
    }
  }

  /**
   * Pause the video
   */
  pause(): void {
    // Cancel any queued play() intent so a late load doesn't start playback
    // after the caller explicitly paused.
    this._pendingPlay = false;
    this._elementPlayPromise = null;
    if (this.player && !this.isLoading && !this._isUnsupported) {
      this.player.pause();
    }
  }

  /**
   * Register OS Media Session action handlers once. These surface play/pause,
   * skip-back/forward and scrub controls on the lock screen, notification
   * shade, media-key hardware (headset / keyboard) and Bluetooth remotes, and
   * route them back into the player. Registered once (guarded); the handlers
   * close over `this` and read `this.player` lazily, so they keep working
   * across source swaps that recreate the internal player.
   */
  private setupMediaSession(): void {
    if (this._mediaSessionReady) return;
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Chromium throws for actions it doesn't support (e.g. older builds);
        // ignore so the supported handlers still register.
      }
    };
    set("play", () => {
      this.play().catch(() => {});
    });
    set("pause", () => {
      this.pause();
    });
    set("stop", () => {
      this.pause();
    });
    set("seekbackward", (details) => {
      this.performRelativeSeek("left", details?.seekOffset || 10);
    });
    set("seekforward", (details) => {
      this.performRelativeSeek("right", details?.seekOffset || 10);
    });
    set("seekto", (details) => {
      if (!this.player || typeof details?.seekTime !== "number") return;
      this.player.seek(details.seekTime).catch(() => {});
    });
    this._mediaSessionReady = true;
  }

  /**
   * Refresh the lock-screen metadata (title + poster artwork) and the
   * playing/paused indicator. Cheap to call on every state/load change.
   */
  private updateMediaSession(): void {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    this.setupMediaSession();
    if (this._title) {
      const art =
        this._poster ||
        this._posterCoverUrl ||
        this._generatedPosterUrl ||
        this._mediaSessionArtworkUrl;
      const artwork = art
        ? [{ src: art, sizes: "512x512", type: this.artworkMime(art) }]
        : undefined;
      try {
        ms.metadata = new MediaMetadata({ title: this._title, artwork });
      } catch {
        // Some engines reject artwork with an unfetchable src; fall back to
        // a title-only metadata so the OS chrome still shows something.
        ms.metadata = new MediaMetadata({ title: this._title });
      }
    }
    const state = this.player?.getState();
    ms.playbackState =
      state === "playing" ? "playing" : state === "paused" ? "paused" : "none";
  }

  /**
   * Capture the current decoded frame off the WebGL canvas as a data: URL for
   * use as OS lock-screen artwork. A source with no explicit `poster` paints
   * its poster/first frame straight onto the canvas (via the postertime /
   * frame-0 seek) and never turns it into a URL — this is how that same still
   * becomes the lock-screen thumbnail. Skipped when an explicit poster/cover
   * URL already wins the artwork chain, or once a snapshot is already stored.
   * The canvas uses preserveDrawingBuffer, so toDataURL returns the real frame.
   * Cheap one-shot (mirrors the proven _lastFrameSnapshot capture) and only
   * runs at moments a real frame is guaranteed on-canvas (poster seek / play).
   */
  private captureMediaSessionArtwork(attempt = 0): void {
    if (!("mediaSession" in navigator)) return;
    if (this._poster || this._posterCoverUrl) return; // explicit art wins
    if (this._mediaSessionArtworkUrl) return; // already captured
    // The poster/first frame is decoded by the time "seeked" fires, but the
    // renderer paints it on a later rAF — capturing synchronously grabs the
    // still-blank GL buffer (a black thumbnail). Wait, on rAF, until a real
    // (non-uniform) frame has actually landed, then snapshot it. Bounded so a
    // genuinely dark/audio-only canvas can't spin forever; "playing" re-arms it.
    if (this.isCanvasBlank()) {
      if (attempt < 30) {
        requestAnimationFrame(() => this.captureMediaSessionArtwork(attempt + 1));
      }
      return;
    }
    try {
      const dataUrl = this.canvas?.toDataURL("image/jpeg", 0.85);
      if (dataUrl && dataUrl.length > 512) {
        this._mediaSessionArtworkUrl = dataUrl;
        this.updateMediaSession();
      }
    } catch {
      // Tainted / lost GL context — leave artwork empty rather than throw.
    }
  }

  /**
   * Cheap synchronous test for whether the display canvas is still blank/black
   * (renderer hasn't painted a real frame yet). Downscales the WebGL canvas to
   * 16×16 on a throwaway 2D context and checks luminance spread — a near-flat
   * result means no frame content. Used to defer artwork capture until a real
   * frame lands. Returns true (treat as blank) on any failure, so capture just
   * retries rather than storing garbage.
   */
  private isCanvasBlank(): boolean {
    const c = this.canvas;
    if (!c || !c.width || !c.height) return true;
    try {
      const small = document.createElement("canvas");
      small.width = 16;
      small.height = 16;
      const ctx = small.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false; // can't test — assume drawable, let capture proceed
      ctx.drawImage(c, 0, 0, 16, 16);
      const { data } = ctx.getImageData(0, 0, 16, 16);
      let min = 255;
      let max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum < min) min = lum;
        if (lum > max) max = lum;
      }
      return max - min < 6; // near-uniform => blank / not yet painted
    } catch {
      return true; // treat failures as blank → capture retries, never throws
    }
  }

  /**
   * Use an extracted cover-art / thumbnail bitmap as the OS lock-screen artwork.
   * The player surfaces embedded album art (and other thumbnails) asynchronously
   * — after the initial metadata is seeded — so this refreshes the Media Session
   * once it lands, instead of the lock screen being stuck with no image. The
   * bitmap is rasterised to a bounded (≤512px) data: URL. Real art is
   * authoritative, so it overwrites any earlier canvas-snapshot fallback; an
   * explicit `poster`/cover URL still wins the chain in updateMediaSession().
   */
  private setMediaSessionArtworkFromBitmap(bitmap: ImageBitmap): void {
    if (!("mediaSession" in navigator)) return;
    if (!bitmap || !bitmap.width || !bitmap.height) return;
    try {
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (dataUrl && dataUrl.length > 512) {
        this._mediaSessionArtworkUrl = dataUrl;
        this.updateMediaSession();
      }
    } catch {
      // Tainted / decode failure — leave any existing artwork untouched.
    }
  }

  /** Best-effort MIME guess for poster artwork from its URL/extension. */
  private artworkMime(url: string): string {
    if (url.startsWith("data:")) {
      const m = url.slice(5, url.indexOf(";"));
      return m || "image/png";
    }
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    if (ext === "gif") return "image/gif";
    return "image/png";
  }

  /**
   * Push the current playhead / duration / rate into the OS scrubber. Guarded
   * against live streams (Infinity), un-loaded state (NaN/0) and out-of-range
   * positions, which would otherwise make setPositionState throw.
   */
  private updateMediaSessionPosition(): void {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (typeof ms.setPositionState !== "function") return;
    const duration = this.duration;
    const rate = this.player?.getPlaybackRate?.() || 1;
    try {
      if (Number.isFinite(duration) && duration > 0) {
        const position = Math.min(Math.max(this.currentTime || 0, 0), duration);
        ms.setPositionState({
          duration,
          playbackRate: rate > 0 ? rate : 1,
          position,
        });
      } else {
        // Live / not-yet-loaded: clear any stale scrubber state.
        ms.setPositionState();
      }
    } catch {
      // Ignore — a transient position > duration during a seek shouldn't spam.
    }
  }

  /**
   * Tear down the internal player and reset transient UI (time, title,
   * subtitles, timeline) back to the initial, no-source state. Called
   * internally on every src change so the next source starts clean. Safe to
   * call when nothing is loaded.
   *
   * Note: we deliberately do NOT touch the canvas or the native video
   * element — the canvas owns a WebGL2 context that the next renderer reuses,
   * and resetting the <video> can interfere with the DRM/HLS path.
   */
  dispose(): void {
    // Cancel any queued play intent
    this._pendingPlay = false;
    this._elementPlayPromise = null;
    this._autoplayInvoked = false;
    this._preloadGateActive = false;
    this._resumeDialogPending = false;
    this._autoplayPendingVisible = false;

    // Reset OS lock-screen chrome to a no-source state. Keep the action
    // handlers registered (setupMediaSession is guarded) — they read
    // this.player lazily and will drive the next source once it loads.
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
      navigator.mediaSession.metadata = null;
      try {
        navigator.mediaSession.setPositionState?.();
      } catch {
        /* noop */
      }
    }
    this._mediaSessionLastPos = -1;
    this._mediaSessionArtworkUrl = null;
    this.stopStutterMonitor();
    this.resetStutterHint();
    if (this._captionLive) this._captionLive.textContent = "";
    this._lastCaptionText = "";
    this.stopQoeHeartbeat();

    // Tear down internal player
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        /* noop */
      }
      this.player = null;
    }

    // Clear subtitle overlay
    if (this.subtitleOverlay) {
      this.subtitleOverlay.innerHTML = "";
    }

    // Invalidate any in-flight postertime generator — a late-arriving frame
    // from the old source would otherwise paint over the new one's poster.
    this._posterGenId++;

    // If the previous source forced a software-decoder fallback, release
    // that preference before the next source loads — hardware should be
    // attempted fresh. We suppress the attr-change reload so removing the
    // `sw` attribute doesn't kick off an unwanted reload of the old src
    // (which is still assigned to this._src at this point).
    if (this._swForcedForCurrentSource) {
      this._swForcedForCurrentSource = false;
      this._sw = "auto";
      if (this.hasAttribute("sw")) {
        this._suppressSwReload = true;
        this.removeAttribute("sw");
        this._suppressSwReload = false;
      }
    }

    // Revoke any postertime-generated poster URL and hide the overlay so
    // the next source doesn't briefly flash the old frame.
    if (this._generatedPosterUrl) {
      URL.revokeObjectURL(this._generatedPosterUrl);
      this._generatedPosterUrl = null;
    }
    if (!this._poster && this.posterElement) {
      this.posterElement.src = "";
      this.posterElement.style.display = "none";
    }

    // Drop cover art from the previous source. The File-source path
    // (set src) routes through dispose() → initializePlayer() and never
    // touches load(), so without clearing here the old artwork + the
    // audio-mode/strip layout leak into the next track. The classes are
    // re-decided once the new source's tracks land (updateCoverArtOverlay).
    this.coverArtBitmap = null;
    if (this._posterCoverBitmap) { try { this._posterCoverBitmap.close(); } catch {} }
    this._posterCoverBitmap = null;
    this._posterCoverUrl = "";
    this._posterCoverLoading = false;
    if (this.coverArtOverlay) this.coverArtOverlay.style.display = "none";
    this.classList.remove("movi-audio-strip", "movi-audio-mode");

    // Reset transient state
    this.isLoading = false;
    this._isUnsupported = false;
    this._lastDuration = 0;
    if (this._titleAutoLoaded) {
      this._title = null;
      this._titleAutoLoaded = false;
    }

    // Reset timeline strip and thumbnail rotation
    this.resetTimeline();
    this.syncThumbnailRotation(0);

    // Reset time display and title text in shadow DOM
    const sr = this.shadowRoot;
    if (sr) {
      const cur = sr.querySelector(".movi-current-time") as HTMLElement | null;
      const dur = sr.querySelector(".movi-duration") as HTMLElement | null;
      if (cur) cur.textContent = "0:00";
      if (dur) dur.textContent = "0:00";
      // Hide any resume dialog left over from the previous source — the next
      // source re-shows it only if it has its own saved position, otherwise
      // the stale "Resume from X?" prompt would linger.
      const resumeDialog = sr.querySelector(".movi-resume-dialog") as HTMLElement | null;
      if (resumeDialog) {
        resumeDialog.style.display = "none";
        resumeDialog.style.animation = "";
      }
      if (!this._title) {
        const titleText = sr.querySelector(".movi-title-text") as HTMLElement | null;
        if (titleText) titleText.textContent = "";
      }
      const rotateStatus = sr.querySelector(".movi-rotate-status") as HTMLElement | null;
      if (rotateStatus) rotateStatus.textContent = "0°";
    }

    // Refresh controls to reflect "no player" state
    this.updateControlsState();
    this.updatePlayPauseIcon();

    // Hide error/broken indicator
    if (this.brokenIndicator) this.brokenIndicator.style.display = "none";
  }

  get theme(): "dark" | "light" {
    return this._theme;
  }

  set theme(value: "dark" | "light") {
    if (this._theme !== value) {
      this._theme = value;
      if (value) {
        this.setAttribute("theme", value);
      } else {
        this.removeAttribute("theme");
      }
    }
  }

  /**
   * Get the internal canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  // Property getters/setters (native video element API)
  private updatePlayPauseIcon(): void {
    const playIcon = this.shadowRoot?.querySelector(
      ".movi-icon-play",
    ) as HTMLElement;
    const pauseIcon = this.shadowRoot?.querySelector(
      ".movi-icon-pause",
    ) as HTMLElement;
    const centerPlayPauseBtn = this.shadowRoot?.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement;

    // Show play button if not playing (ready, paused, ended, idle states)
    // Show pause button only when playing
    const isPlaying = this.player?.getState() === "playing";
    // Bottom-bar + context-menu play/pause icon should reflect the user's
    // INTENDED state, not the raw one. A network stall / internal seek flips
    // the raw state to buffering/seeking mid-playback, which would otherwise
    // bounce the icon to "play" even though the user never paused. Intent
    // stays true through those interruptions. (The centre icon keeps using
    // the raw isPlaying above — that's the resume affordance, not a state
    // indicator, and has its own flicker handling.)
    const isPlayingIntended = this.player?.isPlaybackIntended() ?? isPlaying;
    const loadingIndicator = this.shadowRoot?.querySelector(
      ".movi-loading-indicator",
    ) as HTMLElement;
    const isLoading = loadingIndicator?.style.display === "flex";

    // A suppressed seek (rate-change correction, first play, replay,
    // poster seek) briefly drops state to "seeking" with the spinner
    // hidden. Treat it like loading here so the centre play/pause icon
    // doesn't flash play→pause during that invisible seek — without this
    // it momentarily flips to the play icon and back, which reads as a
    // glitchy blink even though nothing is actually loading.
    const playerState = this.player?.getState();
    const isSuppressedSeek =
      (playerState === "seeking" || playerState === "buffering") &&
      !!this.player?.suppressSeekSpinner;

    const contextMenuPlayIcon = this.shadowRoot?.querySelector(
      ".movi-context-menu-play-icon",
    ) as HTMLElement;
    const contextMenuPauseIcon = this.shadowRoot?.querySelector(
      ".movi-context-menu-pause-icon",
    ) as HTMLElement;
    const contextMenuLabel = this.shadowRoot?.querySelector(
      '.movi-context-menu-item[data-action="play-pause"] .movi-context-menu-label',
    ) as HTMLElement;

    const centerPlayIcon = centerPlayPauseBtn?.querySelector(
      ".movi-center-icon-play",
    ) as HTMLElement;
    const centerPauseIcon = centerPlayPauseBtn?.querySelector(
      ".movi-center-icon-pause",
    ) as HTMLElement;

    // Bottom-bar + context-menu icon: driven by intended state so a
    // mid-playback buffer/seek stall doesn't bounce it to "play". Set once
    // here, outside the centre-icon branch (which still keys off isPlaying).
    if (isPlayingIntended) {
      playIcon?.style.setProperty("display", "none");
      pauseIcon?.style.setProperty("display", "block");
      contextMenuPlayIcon?.style.setProperty("display", "none");
      contextMenuPauseIcon?.style.setProperty("display", "block");
      if (contextMenuLabel) contextMenuLabel.textContent = "Pause";
    } else {
      playIcon?.style.setProperty("display", "block");
      pauseIcon?.style.setProperty("display", "none");
      contextMenuPlayIcon?.style.setProperty("display", "block");
      contextMenuPauseIcon?.style.setProperty("display", "none");
      if (contextMenuLabel) contextMenuLabel.textContent = "Play";
    }

    if (isPlayingIntended) {
      // Use intended state (not raw isPlaying) so the centre icon stays
      // on "pause" through the play startup window — the first play has to
      // seek/buffer before the state actually reaches "playing", and keying
      // off raw isPlaying left it showing the play triangle (and the 250ms
      // tick would revert the click handler's optimistic flip). With intent,
      // it reconciles to pause and rides the same fade-out logic below.
      //
      // While playing, the center button briefly surfaces as a pause
      // icon for visual confirmation of the user's click, then fades
      // out with the controls bar (the stateChange handler's 200ms
      // setTimeout strips both together). The controlsHidden gate
      // below ensures the periodic UI refresh (250ms tick) doesn't
      // re-add the button after that fade-out — otherwise the icon
      // kept flickering back on every tick while controls were still
      // hidden but state was still "playing".
      if (centerPlayPauseBtn) {
        centerPlayIcon?.style.setProperty("display", "none");
        centerPauseIcon?.style.setProperty("display", "block");
        const controlsHidden =
          !this._controls ||
          this.controlsContainer?.classList.contains("movi-controls-hidden");
        // Skip the brief pause-confirmation flash on an autoplay start
        // OR on a loop boundary — there was no user click to confirm
        // in either case, so the centre button shouldn't flash. The
        // loop flag is cleared by the stateChange handler once the
        // player has settled back into "playing".
        if (
          isLoading ||
          isSuppressedSeek ||
          this._isUnsupported ||
          controlsHidden ||
          this._autoplayStarting ||
          this._loopRestartInFlight
        ) {
          centerPlayPauseBtn.classList.remove("movi-center-visible");
        } else {
          centerPlayPauseBtn.classList.add("movi-center-visible");
        }
      }
    } else {
      // Centre icon only — bottom-bar + context-menu icons already set above.
      // Show center play icon when paused/ready, but hide if loading or
      // unsupported state is shown, or while an autoplay attempt is still
      // starting up (the play icon would flash over the first frame).
      // Also hide during the brief end→play transition when loop is on
      // — the player is about to restart, so popping the centre play
      // icon there reads as a glitchy flash on every loop boundary.
      //
      // Deliberately NOT gating on isSuppressedSeek here. A suppressed seek
      // is a spinner-less internal buffering blip — and on a huge streaming
      // file the player dips paused→buffering→paused constantly while data
      // loads in the background. Hiding the centre icon on each of those
      // dips (then re-showing on the paused tick) is exactly the blink the
      // user sees while paused on the poster. The spinner stays gated by
      // isLoading, so nothing visible is "loading" during these blips —
      // keep the resume affordance steady through them.
      const currentState = this.player?.getState();
      const isLoopingEndedTransition = currentState === "ended" && this._loop;
      if (
        isLoading ||
        this._isUnsupported ||
        this._autoplayStarting ||
        isLoopingEndedTransition
      ) {
        if (centerPlayPauseBtn) {
          centerPlayPauseBtn.classList.remove("movi-center-visible");
        }
      } else {
        if (centerPlayPauseBtn) {
          centerPlayIcon?.style.setProperty("display", "block");
          centerPauseIcon?.style.setProperty("display", "none");

          // Paused/ready state: surface the big play icon whenever
          // controls are enabled — independent of the bottom bar's
          // current visibility. The bar may be auto-hidden (no hover
          // on touch, or after the play→pause flash on desktop), but
          // the user still needs a "click here to resume" affordance.
          // The playing branch above keeps the controlsHidden gate so
          // the pause-confirmation flash continues to fade out with
          // the bar — that's about the click-confirmation flow, not
          // the resume affordance.
          if (this._controls) {
            // Surface the icon synchronously. We only reach this branch when
            // the spinner is already hidden (isLoading false above) and the
            // player isn't playing/loading/unsupported — i.e. genuinely
            // settled into paused/ready. Deferring to rAF here just delayed
            // the icon by a frame-plus-tick, so the play icon lagged behind
            // the spinner clearing instead of appearing right after it.
            //
            // The earlier flicker came from the opposite case — adding the
            // class while a huge source kept dipping paused→buffering. That's
            // now handled by NOT gating on isSuppressedSeek (so spinner-less
            // buffering blips don't churn the icon) plus the isLoading guard,
            // so a sync add no longer races a remove.
            centerPlayPauseBtn.classList.add("movi-center-visible");
          } else {
            centerPlayPauseBtn.classList.remove("movi-center-visible");
          }
        }
      }
    }
  }

  private updateTimeDisplay(): void {
    const currentTimeEl = this.shadowRoot?.querySelector(
      ".movi-current-time",
    ) as HTMLElement;
    const durationEl = this.shadowRoot?.querySelector(
      ".movi-duration",
    ) as HTMLElement;

    // During the postertime poster seek the clock transiently sits at the
    // poster timestamp before being reset to 0 — show 0 so the time doesn't
    // flicker to ~2s and back.
    const ct = this._posterSeekActive ? 0 : this.currentTime;

    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(ct);
    }
    if (durationEl) {
      durationEl.textContent = this.formatTime(this.duration);
    }

    this.updateSeekAria();

    // Trigger title auto-load when duration first becomes available
    if (this._lastDuration === 0 && this.duration > 0) {
      this._lastDuration = this.duration;
      // Call updateTitle to check if we need to auto-load from metadata
      this.updateTitle();
    }
  }

  /**
   * Update the seek slider's ARIA so screen readers announce the position as a
   * real slider ("1:23 of 4:56"), not a bare number. Driven off timeUpdate so
   * it stays current even while the visual chrome is auto-hidden.
   */
  private updateSeekAria(): void {
    const bar = this.shadowRoot?.querySelector(
      ".movi-progress-bar",
    ) as HTMLElement | null;
    if (!bar) return;
    const ct = this._posterSeekActive ? 0 : this.currentTime;
    const live = this.player?.isLiveStream?.();
    const dur =
      Number.isFinite(this.duration) && this.duration > 0 ? this.duration : 0;
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", live ? "0" : String(Math.round(dur)));
    bar.setAttribute("aria-valuenow", String(Math.round(ct)));
    bar.setAttribute(
      "aria-valuetext",
      live
        ? "Live"
        : dur > 0
          ? `${this.formatTime(ct)} of ${this.formatTime(dur)}`
          : this.formatTime(ct),
    );
  }

  /** Push the visible caption's text into the off-screen aria-live region so
   *  screen readers announce it. Deduped so identical re-renders stay quiet. */
  private mirrorCaption(): void {
    if (!this._captionLive || !this.subtitleOverlay) return;
    const text = (this.subtitleOverlay.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    if (text === this._lastCaptionText) return;
    this._lastCaptionText = text;
    this._captionLive.textContent = text;
  }

  // ── QoE analytics ─────────────────────────────────────────────────────────

  private startQoeHeartbeat(): void {
    if (this._qoeHeartbeat !== null) return;
    this._qoeHeartbeat = window.setInterval(() => {
      if (this.player?.getState?.() !== "playing") return;
      const stats = this.player?.getStats?.() as
        | Record<string, unknown>
        | undefined;
      const decoder = String(stats?.["Video Decoder"] ?? "unknown");
      // No dropped-frame counter is exposed yet; rebufferRatio carries the
      // stall cost. Report 0 so the schema stays stable for consumers.
      this._qoe.heartbeat(this.currentTime, 0, decoder);
    }, 10000);
  }

  private stopQoeHeartbeat(): void {
    if (this._qoeHeartbeat !== null) {
      clearInterval(this._qoeHeartbeat);
      this._qoeHeartbeat = null;
    }
  }

  /** Register a QoE analytics sink; returns an unsubscribe fn. Every event is
   *  also dispatched as a `movi-qoe` CustomEvent. */
  addQoeSink(sink: QoESink): () => void {
    this._qoe.addSink(sink);
    return () => this._qoe.removeSink(sink);
  }

  removeQoeSink(sink: QoESink): void {
    this._qoe.removeSink(sink);
  }

  /** POST every QoE event to `url` via sendBeacon — shorthand for
   *  addQoeSink(beaconSink(url)). Returns an unsubscribe fn. */
  setAnalyticsBeacon(url: string): () => void {
    return this.addQoeSink(beaconSink(url));
  }

  /** A rolled-up snapshot of the current QoE session. */
  getQoeSession(): QoESession {
    return this._qoe.getSession();
  }

  /**
   * Render chapter markers on the progress bar (YouTube-style)
   */
  private renderChapterMarkers(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot || !this.player) return;

    const container = shadowRoot.querySelector(".movi-chapter-markers") as HTMLElement;
    if (!container) return;

    container.innerHTML = "";

    const chapters = this.player.getChapters();
    const duration = this.player.getDuration();
    if (chapters.length === 0 || duration <= 0) return;

    for (let i = 1; i < chapters.length; i++) {
      const ch = chapters[i];
      const percent = (ch.start / duration) * 100;

      const marker = document.createElement("div");
      marker.className = "movi-chapter-marker";
      marker.style.left = `${percent}%`;
      marker.setAttribute("data-title", ch.title);

      container.appendChild(marker);
    }

    for (const ch of chapters) {
      const { left, width } = chapterSegmentPercent(ch, duration);
      if (width <= 0) {
        continue;
      }

      const segment = document.createElement("div");
      segment.className = "movi-chapter-segment";
      segment.style.left = `${left}%`;
      segment.style.width = `${width}%`;
      segment.setAttribute("data-title", ch.title);

      const segmentClass = introDbSegmentClassName(ch.title);
      if (segmentClass) {
        segment.classList.add(segmentClass);
      }

      container.appendChild(segment);
    }
  }

  /**
   * Convert a 0..1 seek-bar fraction to a media time. For live streams the bar
   * spans the seekable DVR window [seekStart .. liveEdge], so the fraction maps
   * into that window; for VOD it's the usual 0..duration.
   */
  private barFractionToTime(fraction: number): number {
    const f = Math.max(0, Math.min(1, fraction));
    if (this.player?.isLiveStream?.()) {
      const start = this.player.getSeekRangeStart?.() ?? 0;
      const end = this.player.getLiveEdge?.() ?? 0;
      return start + f * Math.max(0, end - start);
    }
    return f * this.duration;
  }

  private updateProgressBar(): void {
    // Don't update visuals if user is scrubbing or seeking
    if (this.isDragging || this.isTouchDragging || this.isSeeking) return;

    const progressFilled = this.shadowRoot?.querySelector(
      ".movi-progress-filled",
    ) as HTMLElement;
    const progressHandle = this.shadowRoot?.querySelector(
      ".movi-progress-handle",
    ) as HTMLElement;
    const progressBuffer = this.shadowRoot?.querySelector(
      ".movi-progress-buffer",
    ) as HTMLElement;

    // Live (dynamic) streams: duration is Infinity, so scale the bar against
    // the seekable DVR window [seekStart .. liveEdge] instead — the playhead
    // sits at the right edge when watching live and moves left as you scrub
    // back into the window.
    if (this.player?.isLiveStream?.()) {
      const start = this.player.getSeekRangeStart?.() ?? 0;
      const end = this.player.getLiveEdge?.() ?? 0;
      const span = end - start;
      const ct = this.player.getCurrentTime?.() ?? 0;
      const pct =
        span > 0 ? Math.min(100, Math.max(0, ((ct - start) / span) * 100)) : 0;
      if (progressFilled) progressFilled.style.width = `${pct}%`;
      if (progressHandle) progressHandle.style.left = `${pct}%`;
      if (progressBuffer) {
        const bufEnd = this.player.getBufferEndTime?.() ?? 0;
        const bufPct =
          span > 0
            ? Math.min(100, Math.max(0, ((bufEnd - start) / span) * 100))
            : 0;
        progressBuffer.style.left = "0%";
        progressBuffer.style.width = `${bufPct}%`;
      }
      return;
    }

    if (this.duration > 0) {
      // Clamp to 0 during the postertime poster seek (clock transiently parked
      // at the poster timestamp) so the filled bar/handle don't flick to ~2s.
      const ct = this._posterSeekActive ? 0 : this.currentTime;
      const percent = (ct / this.duration) * 100;
      if (progressFilled) {
        progressFilled.style.width = `${percent}%`;
      }
      if (progressHandle) {
        progressHandle.style.left = `${percent}%`;
      }

      // Buffer draws from 0 to bufferEnd; the filled bar overlays it on top
      // so the buffer's left rounded edge is hidden beneath the played
      // portion. Only the trailing (right) rounded edge is visible, which
      // sits cleanly against the filled bar without a radius-on-radius
      // notch. bufferEnd math is already correct (relative to real read
      // cursor), so drawing from 0 is purely a visual choice.
      if (this.player && progressBuffer) {
        // During the postertime poster seek the buffered-end transiently sits
        // at the poster timestamp (before the clock/buffer are reset to 0);
        // show 0 so the buffer bar doesn't flash forward to ~2s.
        const bufferEnd = this._posterSeekActive
          ? 0
          : this.player.getBufferEndTime();
        if (bufferEnd > 0) {
          // In linear mode the RAM window has a moving start (older bytes are
          // dropped), so draw the buffer bar as [bufferStart, bufferEnd] — the
          // actual window of bytes held in memory. (Seeks clamp to a slightly
          // inset seekableStart, but showing the true window reads better — no
          // gap between the playhead and the buffered segment.) Otherwise from 0.
          const bufferStart = this._linearMode
            ? Math.max(0, this.player.getBufferStartTime?.() ?? 0)
            : 0;
          const startPercent = Math.min(100, (bufferStart / this.duration) * 100);
          const endPercent = Math.min(100, (bufferEnd / this.duration) * 100);
          progressBuffer.style.left = `${startPercent}%`;
          progressBuffer.style.width = `${Math.max(0, endPercent - startPercent)}%`;
        } else {
          progressBuffer.style.width = "0%";
        }
      }
    }
  }

  private updateVolumeIcon(): void {
    const volumeHigh = this.shadowRoot?.querySelector(
      ".movi-icon-volume-high",
    ) as HTMLElement;
    const volumeLow = this.shadowRoot?.querySelector(
      ".movi-icon-volume-low",
    ) as HTMLElement;
    const volumeMute = this.shadowRoot?.querySelector(
      ".movi-icon-volume-mute",
    ) as HTMLElement;
    const volumeSlider = this.shadowRoot?.querySelector(
      ".movi-volume-slider",
    ) as HTMLInputElement;

    if (volumeSlider) {
      const v = this._muted ? 0 : this._volume;
      volumeSlider.value = v.toString();
      // Drive the track's fill-up-to-thumb gradient. Native <input
      // type=range> doesn't expose a separate filled portion across
      // browsers, so the CSS gradient below reads this custom prop
      // to draw a coloured segment from 0 to thumb and a muted one
      // beyond. Track max is getMaxVolume() (2 normally, 1 on native audio), so
      // the thumb sits at v/max of the width.
      volumeSlider.style.setProperty(
        "--movi-volume-pct",
        `${Math.round((v / this.getMaxVolume()) * 100)}%`,
      );
      // Above 100% we're boosting — tint the fill so the boost zone is obvious.
      volumeSlider.classList.toggle("movi-volume-boosted", v > 1);
      // Real ARIA for screen readers: announce the percentage, not 0–2.
      const pct = Math.round(v * 100);
      volumeSlider.setAttribute("aria-valuenow", String(pct));
      volumeSlider.setAttribute(
        "aria-valuetext",
        this._muted ? "Muted" : `Volume ${pct}%${v > 1 ? " (boosted)" : ""}`,
      );
    }

    // Reset all first
    volumeHigh?.style.setProperty("display", "none");
    volumeLow?.style.setProperty("display", "none");
    volumeMute?.style.setProperty("display", "none");

    if (this._muted || this._volume === 0) {
      volumeMute?.style.setProperty("display", "block");
    } else if (this._volume < 0.5) {
      volumeLow?.style.setProperty("display", "block");
    } else {
      volumeHigh?.style.setProperty("display", "block");
    }
  }

  private updateLoadingIndicator(state?: string): void {
    const loadingIndicator = this.shadowRoot?.querySelector(
      ".movi-loading-indicator",
    ) as HTMLElement;
    if (!loadingIndicator) return;

    const currentState = state || this.player?.getState() || "idle";
    const duration = this.player?.getDuration() || 0;

    // Show loading only when playback is interrupted:
    // - 'loading': initial load (but only if not playing yet)
    // - 'seeking': seeking (interrupts playback)
    // - 'buffering': buffering (interrupts playback)
    // Don't show loading during normal 'playing' state, even if duration is 0
    let shouldShow = false;

    // Only show loading for interruption states.
    // suppressSeekSpinner covers all internal seeks that briefly enter
    // "seeking"/"buffering" without a real interruption — the initial poster
    // seek(0), first play, and replay-from-ended. A spinner there is a false
    // flash, since from the user's view nothing is loading.
    if (
      (currentState === "seeking" || currentState === "buffering") &&
      !this.player?.suppressSeekSpinner
    ) {
      shouldShow = true;
    } else if (currentState === "loading" && duration === 0) {
      // Show loading only during initial load when duration is not yet available
      // Once playing starts, don't show loading even if duration is still 0
      shouldShow = true;
    }

    // Mobile 4K+ FileSource: hold the spinner regardless of player state
    // until the preload gate releases.
    if (this._preloadGateActive) {
      shouldShow = true;
    }

    if (shouldShow) {
      loadingIndicator.style.display = "flex";
      // Hide center play button when loading is shown
      const centerPlayPauseBtn = this.shadowRoot?.querySelector(
        ".movi-center-play-pause",
      ) as HTMLElement;
      if (centerPlayPauseBtn) {
        centerPlayPauseBtn.classList.remove("movi-center-visible");
      }
    } else {
      loadingIndicator.style.display = "none";
      // Center play button visibility will be managed by updatePlayPauseIcon
    }

    // Strip mode has no spinner — the centre-screen loader is hidden via
    // CSS. Surface the same buffering state by pulsing the progress bar
    // (see :host(.movi-audio-strip.is-buffering) rules in the style block).
    this.classList.toggle("is-buffering", shouldShow);
  }

  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      // Format: H:MM:SS (e.g., 1:02:30)
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    // Format: MM:SS (e.g., 00:26, 01:30, 14:47)
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  private handleUnsupportedVideo(title?: string, message?: string): void {
    const msgLower = message?.toLowerCase() || "";
    const isNetworkError = msgLower.includes("http 4") || msgLower.includes("http 5") ||
      msgLower.includes("stream unavailable") || msgLower.includes("network error") ||
      msgLower.includes("hls error");
    const isDecoderError = !isNetworkError && (
      title === "Format Unsupported" ||
      title === "Codec Unsupported" ||
      title === "Playback Error" ||
      msgLower.includes("decoder") ||
      msgLower.includes("codec"));

    // Silent fallback if sw="auto" is set
    if (
      isDecoderError &&
      this.getAttribute("sw") === "auto" &&
      this._sw !== "software"
    ) {
      Logger.info(
        TAG,
        'Decoder error detected with sw="auto", triggering silent software fallback',
      );
      this.enableSoftwareDecoding();
      return;
    }

    this._isUnsupported = true;

    // Stop player
    if (this.player) {
      const state = this.player.getState();
      if (state !== "idle" && state !== "loading" && state !== "error") {
        try {
          this.player.pause();
        } catch (e) {}
      }
    }

    // Show broken indicator
    if (this.brokenIndicator) {
      this.brokenIndicator.style.display = "flex";

      // Update text if provided
      if (title) {
        const titleEl =
          this.brokenIndicator.querySelector(".movi-broken-title");
        if (titleEl) titleEl.textContent = title;
      }
      if (message) {
        const messageEl = this.brokenIndicator.querySelector(
          ".movi-broken-message",
        );
        if (messageEl) messageEl.textContent = message;
      }

      // Show/hide the software fallback button based on parameter
      const swFallbackBtn = this.brokenIndicator.querySelector(
        ".movi-sw-fallback-btn",
      ) as HTMLElement;
      if (swFallbackBtn) {
        // Show the button for hardware acceleration or decoder failures (not for network errors)
        // Don't show if already using software decoding
        const shouldShowSwButton =
          isDecoderError &&
          this._sw !== "software" &&
          this.getAttribute("sw") !== "false";
        swFallbackBtn.style.display = shouldShowSwButton ? "flex" : "none";
      }
    }

    // Hide loading indicator
    const loadingIndicator = this.shadowRoot?.querySelector(
      ".movi-loading-indicator",
    ) as HTMLElement;
    if (loadingIndicator) loadingIndicator.style.display = "none";

    // Hide center play button in error state
    const centerPlayPauseBtn = this.shadowRoot?.querySelector(
      ".movi-center-play-pause",
    ) as HTMLElement;
    if (centerPlayPauseBtn) {
      centerPlayPauseBtn.classList.remove("movi-center-visible");
    }

    // Update controls
    this.updateControlsVisibility();
    this.updateControlsState();
    this.updatePlayPauseIcon();
    this.updateQualityMenu(); // Update quality menu
  }

  /**
   * Check if required security headers (COOP/COEP) are present
   * These headers are required for SharedArrayBuffer support (needed by FFmpeg)
   */
  private checkSecurityHeaders(): void {
    // Cross-origin isolation (COOP+COEP → SharedArrayBuffer) is NOT required to
    // play anything. The WASM engine is single-threaded (USE_PTHREADS=0) and
    // does all its I/O through Asyncify (async js_read_async), so HttpSource's
    // reads bridge async network fetches without SAB. SAB is purely a zero-copy
    // optimisation; HttpSource's plain-buffer fallback works fine without it
    // (once atomicSetStreaming got its missing non-SAB branch — see HttpSource).
    // Blocking on the headers used to lock out perfectly capable browsers whose
    // embedder couldn't set them, and lite/mobile browsers (Opera Mini "high"
    // mode, UC, etc.) that never report crossOriginIsolated at all.
    if (!window.crossOriginIsolated) {
      Logger.warn(
        TAG,
        "Not cross-origin isolated (no COOP/COEP) — running without SharedArrayBuffer; single-threaded WASM + Asyncify I/O are unaffected, HTTP streaming just uses the plain-buffer path.",
      );
    }

    // The one thing genuinely required is WebAssembly. Proxy/lite browsers that
    // render server-side (Opera Mini's extreme/proxy mode and similar) don't
    // provide it — surface a clear "unsupported browser" message rather than a
    // cryptic decode failure, and skip player init.
    if (typeof WebAssembly === "undefined") {
      Logger.warn(TAG, "WebAssembly unavailable — this browser can't run the player");
      if (this.brokenIndicator) {
        this.brokenIndicator.style.display = "flex";
        if (this.emptyStateIndicator) {
          this.emptyStateIndicator.style.display = "none";
        }
        const titleEl =
          this.brokenIndicator.querySelector(".movi-broken-title");
        if (titleEl) titleEl.textContent = "Browser not supported";
        const messageEl = this.brokenIndicator.querySelector(
          ".movi-broken-message",
        );
        if (messageEl) {
          messageEl.textContent =
            "This player needs WebAssembly, which lite / proxy browsers (like Opera Mini) don't provide. Please open it in Chrome, Firefox, Safari, Edge, or full Opera.";
        }
        const swFallbackBtn = this.brokenIndicator.querySelector(
          ".movi-sw-fallback-btn",
        ) as HTMLElement;
        if (swFallbackBtn) {
          swFallbackBtn.style.display = "none";
        }
      }
      this._isUnsupported = true;
    }
  }

  /**
   * Enable software decoding and reload the video
   */
  private async enableSoftwareDecoding(): Promise<void> {
    Logger.info(TAG, "User requested software decoding fallback");

    // Reset unsupported state
    this._isUnsupported = false;

    // Hide broken indicator
    if (this.brokenIndicator) {
      this.brokenIndicator.style.display = "none";
    }

    // Set sw attribute to enable software decoding for THIS source. The
    // flag is cleared on dispose so the next source isn't forced into
    // software just because the previous one had to fall back.
    this._sw = "software";
    this._swForcedForCurrentSource = true;
    this.setAttribute("sw", "");

    // Get current source
    const currentSrc = this._src;

    // Destroy current player if exists
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // Reset loading state so initializePlayer can run
    this.isLoading = false;

    // Show loading indicator
    const loadingIndicator = this.shadowRoot?.querySelector(
      ".movi-loading-indicator",
    ) as HTMLElement;
    if (loadingIndicator) loadingIndicator.style.display = "flex";

    // Re-initialize with software decoding
    if (currentSrc) {
      try {
        // Call initializePlayer directly since src hasn't changed
        await this.initializePlayer();
      } catch (e) {
        Logger.error(TAG, "Failed to initialize with software decoding", e);
        this.handleUnsupportedVideo(
          "Playback Error",
          "Failed to play video even with software decoding.",
        );
      }
    }
  }

  private updateControlsState(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Initial state: No player, or currently loading
    // But don't treat it as initial if it's already unsupported
    const isInitial = (!this.player || this.isLoading) && !this._isUnsupported;
    const isUnsupported = this._isUnsupported;

    // Controls to disable (everything except volume)
    const controlsToDisableSelector =
      ".movi-play-pause, .movi-progress-container, .movi-audio-track-btn, .movi-subtitle-track-btn, .movi-hdr-btn, .movi-speed-btn, .movi-stable-audio-btn, .movi-aspect-ratio-btn, .movi-loop-btn, .movi-pip-btn, .movi-fullscreen-btn, .movi-more-btn, .movi-center-play-pause, .movi-seek-backward, .movi-seek-forward";
    const controlsToDisable = shadowRoot.querySelectorAll(
      controlsToDisableSelector,
    );

    controlsToDisable.forEach((control) => {
      const el = control as HTMLElement;
      if (isUnsupported || isInitial) {
        // Completely hide center play button in error state
        if (el.classList.contains("movi-center-play-pause")) {
          el.style.display = "none";
          el.style.opacity = "0";
          el.classList.remove("movi-center-visible");
        } else {
          el.style.opacity = "0.4";
        }
        el.style.pointerEvents = "none";
        if (el.tagName === "BUTTON") (el as HTMLButtonElement).disabled = true;
      } else {
        // Special case for center play button: clear opacity to let CSS classes manage it
        if (el.classList.contains("movi-center-play-pause")) {
          el.style.display = "";
          el.style.opacity = "";
        } else {
          el.style.opacity = "1";
        }
        el.style.pointerEvents = "auto";
        if (el.tagName === "BUTTON") (el as HTMLButtonElement).disabled = false;
      }
    });

    // Volume controls (enabled in initial state, disabled in unsupported state)
    const volumeControls = shadowRoot.querySelectorAll(
      ".movi-volume-container, .movi-volume-btn, .movi-volume-slider",
    );
    volumeControls.forEach((control) => {
      const el = control as HTMLElement;
      if (isUnsupported) {
        el.style.opacity = "0.4";
        el.style.pointerEvents = "none";
        if (el.tagName === "BUTTON") (el as HTMLButtonElement).disabled = true;
        if (el.tagName === "INPUT") (el as HTMLInputElement).disabled = true;
      } else {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
        if (el.tagName === "BUTTON") (el as HTMLButtonElement).disabled = false;
        if (el.tagName === "INPUT") (el as HTMLInputElement).disabled = false;
      }
    });

    // Context menu actions
    const contextMenuItems = shadowRoot.querySelectorAll(
      ".movi-context-menu-item",
    );
    contextMenuItems.forEach((item) => {
      const el = item as HTMLElement;
      // Note: context menu doesn't have a volume action yet
      if (isUnsupported || isInitial) {
        el.style.opacity = "0.4";
        el.style.pointerEvents = "none";
      } else {
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }
    });
  }

  private updateAmbientWrapperElement(): void {
    if (this._ambientWrapper) {
      this.ambientWrapperElement = document.getElementById(
        this._ambientWrapper,
      );
      if (this.ambientWrapperElement) {
        // Add transition for smooth color changes
        this.ambientWrapperElement.style.transition = "background 0.5s ease";
      }
    } else {
      this.ambientWrapperElement = null;
    }
  }

  private updateAmbientMode(): void {
    if (this._ambientMode) {
      if (this.ambientWrapperElement) {
        // Restore to display:block + opaque so the painted background +
        // CSS filter (typically blur(80px) saturate()) come back.
        this.ambientWrapperElement.style.display = "";
        this.ambientWrapperElement.style.opacity = "1";
      }
      this.startAmbientColorSampling();
    } else {
      if (this.ambientWrapperElement) {
        // `opacity: 0` leaves the element composited and its expensive
        // filter (e.g. blur(80px) on marketing index.html) STILL runs
        // on the GPU every frame, competing with video rendering. Use
        // `display: none` so the browser skips it entirely — gives a
        // visible perf win on low-end devices when ambient is off.
        this.ambientWrapperElement.style.display = "none";
        this.ambientWrapperElement.style.opacity = "0";
      }
      // Reset letterbox to black
      this.player?.setLetterboxColor(0, 0, 0);
      this.stopAmbientColorSampling();
    }
  }

  private startAmbientColorSampling(): void {
    // Bail when the player isn't built yet — connectedCallback runs
    // updateAmbientMode() before initializePlayer() creates the player.
    if (!this.player) return;

    // Ask the CURRENT renderer to maintain a 16×16 mirror of each drawn frame.
    // sampleCanvasColors() reads from that 256-pixel buffer instead of a full
    // canvas readback per sample (which caused frame slips on 8K HDR sources).
    //
    // This MUST run before the rafId guard below: on a src change a fresh
    // player/renderer replaces the old one while this rAF loop keeps running,
    // so a guard-first version would skip enabling the mirror on the NEW
    // renderer — leaving ambient "on" in the menu but never painting on the new
    // video. Re-enabling here is idempotent and fixes that.
    const renderer = (this.player as any)?.videoRenderer;
    if (renderer && typeof renderer.enableAmbientMirror === "function") {
      renderer.enableAmbientMirror();
    }

    // Loop already running (e.g. carried across a src change) — the mirror was
    // just re-enabled above on the current renderer, so nothing more to start.
    if (this._ambientRafId !== null) return;

    // Reset adaptive interval — a previously-throttled session may have left
    // it ratcheted up to 2s, which would make ambient appear "frozen" until
    // the per-sample recovery slowly walked it back down.
    this._ambientSampleInterval = 200;

    const loop = (timestamp: number) => {
      // If software decoding is active, pause ambient sampling to save main thread cycles
      // This is crucial for CPU-heavy 4K software decoding
      const isSoftware = this.player?.isSoftwareDecoding() ?? false;
      // Also skip during seek/buffering — the renderer is recovering and any
      // canvas readback contends with frame presentation, magnifying stutter.
      const playerState = this.player?.getState();
      const isRecovering = playerState === "seeking" || playerState === "buffering";
      // Skip for a short window after a playback-rate change so audio refill
      // isn't fighting the GPU readback for main-thread time.
      const sinceRateChange = timestamp - this._lastRateChangeTime;
      const isRateChangeCooldown =
        this._lastRateChangeTime > 0 &&
        sinceRateChange < MoviElement.AMBIENT_RATE_CHANGE_COOLDOWN_MS;
      if (isSoftware || isRecovering || isRateChangeCooldown) {
        this._lastAmbientSampleTime = timestamp; // Keep advancing time but skip work
        this._ambientRafId = requestAnimationFrame(loop);
        return;
      }

      if (
        timestamp - this._lastAmbientSampleTime >=
        this._ambientSampleInterval
      ) {
        const start = performance.now();
        this.sampleCanvasColors();
        const duration = performance.now() - start;

        this._lastAmbientSampleTime = timestamp;

        // Adaptive sampling rate based on performance
        // If taking > 8ms, slow down significantly to avoid blocking main thread
        if (duration > 8) {
          this._ambientSampleInterval = Math.min(
            2000,
            this._ambientSampleInterval * 1.5,
          );
          // Only log periodically or if significant change to avoid spam
          if (this._ambientSampleInterval < 2000) {
            Logger.debug(
              TAG,
              `Ambient sampling taking too long (${duration.toFixed(1)}ms), slowing down to ${this._ambientSampleInterval.toFixed(0)}ms`,
            );
          }
        } else if (duration < 5 && this._ambientSampleInterval > 200) {
          // If reasonably fast (<5ms), shrink interval. Threshold was 2ms but
          // GPU readback variance means a healthy machine rarely dips that
          // low, so the interval would ratchet up forever after one slow
          // frame. 5ms still leaves ample headroom on a 16ms (60Hz) budget.
          this._ambientSampleInterval = Math.max(
            200,
            this._ambientSampleInterval * 0.8,
          );
        }
      }
      this._ambientRafId = requestAnimationFrame(loop);
    };

    // Initial sample
    this.sampleCanvasColors();
    this._lastAmbientSampleTime = performance.now();
    this._ambientRafId = requestAnimationFrame(loop);
  }

  private stopAmbientColorSampling(): void {
    if (this._ambientRafId !== null) {
      cancelAnimationFrame(this._ambientRafId);
      this._ambientRafId = null;
    }
    const renderer = (this.player as any)?.videoRenderer;
    if (renderer && typeof renderer.disableAmbientMirror === "function") {
      renderer.disableAmbientMirror();
    }
  }

  private sampleCanvasColors(): void {
    if (!this.player) return;

    // Read from the renderer's 16×16 mirror FBO. A 256-pixel readPixels
    // costs microseconds; the previous canvas readback path stalled the
    // GPU for ~100ms per sample on 8K HDR sources.
    const renderer = (this.player as any)?.videoRenderer;
    const data: Uint8Array | null =
      renderer && typeof renderer.readAmbientPixels === "function"
        ? renderer.readAmbientPixels()
        : null;
    if (!data) return;

    try {
      let r = 0,
        g = 0,
        b = 0;
      let count = 0;

      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }

      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Smooth color transition
        const smoothingFactor = 0.6; // Keep original smoothing
        this.currentAmbientColors = {
          r: Math.floor(
            this.currentAmbientColors.r +
              (r - this.currentAmbientColors.r) * smoothingFactor,
          ),
          g: Math.floor(
            this.currentAmbientColors.g +
              (g - this.currentAmbientColors.g) * smoothingFactor,
          ),
          b: Math.floor(
            this.currentAmbientColors.b +
              (b - this.currentAmbientColors.b) * smoothingFactor,
          ),
        };
        this.updateAmbientBackground();
      }
    } catch (error) {
      // Silently fail if canvas is not accessible (e.g., CORS) or context lost
    }
  }

  private updateAmbientBackground(): void {
    const { r, g, b } = this.currentAmbientColors;

    // Create a gradient with the sampled color
    // Use radial gradient for smooth ambient effect without lines
    let color1, color2, color3, color4;

    if (this._theme === "light") {
      // Significantly higher opacity for light mode to be visible against white/light backgrounds
      // Brighter, more saturated effect
      color1 = `rgba(${r}, ${g}, ${b}, 0.5)`;
      color2 = `rgba(${r}, ${g}, ${b}, 0.3)`;
      color3 = `rgba(${r}, ${g}, ${b}, 0.15)`;
      color4 = `rgba(${r}, ${g}, ${b}, 0.05)`;
    } else {
      // Original subtle opacity for dark mode
      color1 = `rgba(${r}, ${g}, ${b}, 0.2)`;
      color2 = `rgba(${r}, ${g}, ${b}, 0.1)`;
      color3 = `rgba(${r}, ${g}, ${b}, 0.05)`;
      color4 = `rgba(${r}, ${g}, ${b}, 0.02)`;
    }

    const gradient = `radial-gradient(
      ellipse 100% 100% at 50% 50%,
      ${color1} 0%,
      ${color2} 30%,
      ${color3} 60%,
      ${color4} 100%
    )`;

    if (this._ambientMode) {
      const isFullscreen = document.fullscreenElement === this;

      if (this.ambientWrapperElement && !isFullscreen) {
        // External wrapper in normal mode — wrapper handles ambient, letterbox stays black
        this.ambientWrapperElement.style.background = gradient;
        this.player?.setLetterboxColor(0, 0, 0);

        if (this._theme === "light") {
          this.ambientWrapperElement.style.filter =
            "saturate(1.5) brightness(1.1)";
        } else {
          this.ambientWrapperElement.style.filter = "none";
        }
      } else {
        // Fullscreen or no wrapper — letterbox color on canvas
        const maxBrightness = 80;
        const peak = Math.max(r, g, b, 1);
        const scale = Math.min(maxBrightness / peak, 0.45);
        this.player?.setLetterboxColor(
          Math.floor(r * scale),
          Math.floor(g * scale),
          Math.floor(b * scale),
        );
      }
    }
  }

  get src(): string | File | null {
    return this._src;
  }

  /**
   * Separate audio source URL (for split video+audio files)
   */
  get audioSrc(): string | null {
    return this._audioSrc;
  }

  set audioSrc(value: string | null) {
    this._audioSrc = value;
  }

  /**
   * Get available audio language tracks
   */
  getAudioLangs(): { lang: string; label: string; active: boolean }[] {
    if (this.player) return this.player.getAudioLangs();
    return this._audioTracks.map((t, i) => ({
      lang: t.lang,
      label: t.label,
      active: i === 0,
    }));
  }

  /**
   * Switch audio to a different language
   */
  selectAudioLang(lang: string): boolean {
    if (this.player) return this.player.selectAudioLang(lang);
    return false;
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
    if (this.player) {
      const fromPlayer = this.player.getSubtitleLangs();
      if (fromPlayer.length > 0) {
        return fromPlayer;
      }
    }
    return this._subtitleTracks.map((t) => ({
      id: this.resolveExternalSubtitleId(t),
      lang: t.lang,
      label: t.label,
      active: false,
    }));
  }

  /**
   * Select an external subtitle track by stable id (null to disable)
   */
  async selectExternalSubtitle(id: string | null): Promise<boolean> {
    if (this.player) return this.player.selectExternalSubtitle(id);
    return false;
  }

  setExternalSubtitles(
    subtitles: {
      id?: string;
      src: string;
      lang: string;
      label: string;
      format?: string;
      default?: boolean;
    }[],
  ): void {
    this._subtitleTracks = subtitles.map((sub) => ({
      src: sub.src,
      lang: sub.lang,
      label: sub.label,
      format: sub.format,
      id: sub.id,
      default: sub.default,
    }));

    if (this.player) {
      this.player.setExternalSubtitleTracks(
        this._subtitleTracks.map((track) => ({
          url: track.src,
          lang: track.lang,
          label: track.label,
          format: track.format as "vtt" | "srt" | undefined,
          id: track.id ?? track.src,
        })),
      );
    }

    if (this._presentation === "native" && this.player) {
      this.syncNativeSubtitleTracks();
    }
  }

  /**
   * Select an external subtitle track by language (null to disable)
   */
  async selectSubtitleLang(lang: string | null): Promise<boolean> {
    if (this.player) return this.player.selectSubtitleLang(lang);
    return false;
  }

  /**
   * Manifest / muxed subtitle tracks (HLS, MKV, etc.)
   */
  getSubtitleTracks(): ReturnType<MoviPlayer["getSubtitleTracks"]> {
    return this.player?.getSubtitleTracks() ?? [];
  }

  /**
   * Select a manifest / muxed subtitle track (null to disable)
   */
  async selectSubtitleTrack(trackId: number | null): Promise<boolean> {
    if (!this.player) return false;
    return this.player.selectSubtitleTrack(trackId);
  }

  /**
   * Active subtitle language for preference persistence ("off" when disabled)
   */
  getActiveSubtitlePreference(): string {
    const external = this.player?.getSubtitleLangs().find((track) => track.active);
    if (external) {
      return external.lang || external.label || "unknown";
    }

    const muxed = this.player?.trackManager.getActiveSubtitleTrack();
    if (muxed) {
      return muxed.language || muxed.label || "unknown";
    }

    return "off";
  }

  setExternalQualities(qualities: ExternalQualityEntry[]): void {
    this.player?.setExternalQualities(qualities);
  }

  getExternalQualities(): ExternalQualityEntry[] {
    return this.player?.getExternalQualities() ?? [];
  }

  setChapterMarkers(chapters: ChapterMarker[]): void {
    this.player?.setChapterMarkers(chapters);
    this.renderChapterMarkers();
  }

  getChapterMarkers(): ChapterMarker[] {
    return this.player?.getChapterMarkers() ?? [];
  }

  getPresentationMode(): PresentationMode {
    return (
      this.player?.getPresentationMode() ??
      this._presentation ??
      "canvas"
    );
  }

  canCast(): boolean {
    return this.player?.canCast() ?? false;
  }

  set src(value: string | File | null) {
    // Save position before switching source, then stop saving
    if (this._resume) this.saveResumePosition();
    this.stopResumeSaving();
    this._resumeCheckedWithTitle = false;

    // Reset to fully initial state before loading the new source — clears the
    // canvas, destroys the internal player, and resets UI so no previous-video
    // artifacts (last frame, subtitles, duration, title) leak across.
    this.dispose();

    // Switching to a URL/File source supersedes any custom adapter.
    this._sourceAdapter = null;

    this.dispatchEvent(new CustomEvent("loadstart", { detail: { src: value instanceof File ? value.name : value } }));

    if (value instanceof File) {
      // For File objects, store in memory (can't store in attributes)
      this._src = value;
      this._hasEverPlayed = false;
      // Remove the src attribute if it was a string
      this.removeAttribute("src");
      // updatePoster gates on hasSource — re-evaluate now that _src is set.
      this.updatePoster();
      // Re-initialize player if already connected
      if (this.isConnected) {
        this.initializePlayer();
      }
    } else if (typeof value === "string") {
      // For strings, use attribute
      if (value) {
        // dispose() above already destroyed the player. Normally
        // setAttribute fires attributeChangedCallback → load() →
        // initializePlayer(), which recreates it. But the DOM only
        // fires that callback when the attribute VALUE actually changes
        // — re-assigning the SAME url is a no-op write, so the callback
        // never runs and the player stays destroyed (blank player,
        // "just destroyed" symptom). Detect that case and re-init
        // directly, mirroring the File branch below.
        const sameValue = this.getAttribute("src") === value;
        this.setAttribute("src", value);
        if (sameValue) {
          this._src = value;
          this.updatePoster();
          if (this.isConnected) {
            this.load();
          }
        }
      } else {
        this.removeAttribute("src");
        this._src = null;
        // Show empty state when src is cleared
        if (this.emptyStateIndicator && !this.player && !this._isUnsupported) {
          this.emptyStateIndicator.style.display = "flex";
        }
      }
    } else {
      this.removeAttribute("src");
      this._src = null;
      // Show empty state when src is cleared
      if (this.emptyStateIndicator && !this.player) {
        this.emptyStateIndicator.style.display = "flex";
      }
    }
  }

  /**
   * Set a File object as the source (convenience method)
   */
  setFile(file: File | null): void {
    this.src = file;
  }

  /**
   * Custom SourceAdapter — feeds bytes from any protocol (WebSocket, WebRTC
   * data channel, IndexedDB, custom encryption, etc.) without writing a
   * SourceConfig branch. Set to `null` to clear and go back to `src`.
   *
   * Usage:
   * ```ts
   *   const element = document.querySelector('movi-player');
   *   element.sourceAdapter = new MyWebSocketSource(url);
   * ```
   *
   * Clearing src + setting adapter is mutually exclusive — the adapter wins.
   */
  get sourceAdapter(): SourceAdapter | null {
    return this._sourceAdapter;
  }

  set sourceAdapter(adapter: SourceAdapter | null) {
    if (this._resume) this.saveResumePosition();
    this.stopResumeSaving();
    this._resumeCheckedWithTitle = false;

    // Mirror the src setter: full reset so the new adapter starts clean and
    // no previous-video artifacts (last frame, subtitles, duration) leak.
    this.dispose();

    this.dispatchEvent(
      new CustomEvent("loadstart", { detail: { src: adapter ? adapter.getKey() : null } }),
    );

    this._sourceAdapter = adapter;
    // An adapter overrides any prior src — keep them mutually exclusive so
    // initializePlayer's source-type branching isn't ambiguous.
    if (adapter) {
      this._src = null;
      this.removeAttribute("src");
      this.updatePoster();
      if (this.isConnected) {
        this.initializePlayer();
      }
    } else if (this.emptyStateIndicator && !this.player) {
      this.emptyStateIndicator.style.display = "flex";
    }
  }

  /**
   * Convenience method mirroring `setFile()` — same effect as assigning to
   * the `sourceAdapter` property.
   */
  setSourceAdapter(adapter: SourceAdapter | null): void {
    this.sourceAdapter = adapter;
  }

  /**
   * Custom HTTP headers sent with every media network request — the adaptive
   * manifest (.mpd/.m3u8) and all of its segments, plus progressive downloads.
   * Use for auth tokens, signed headers, etc. The object form is the
   * programmatic counterpart to the JSON `headers` attribute; objects can't go
   * through attributes, so set non-trivial header maps via this property.
   *
   *   player.headers = { Authorization: "Bearer <token>" };
   */
  get headers(): Record<string, string> | null {
    return this._headers;
  }

  set headers(value: Record<string, string> | null) {
    this._headers = value && typeof value === "object" ? { ...value } : null;
    // Headers are consumed when the player/stream-wrapper is constructed, so a
    // live change only takes effect on the next load. Reload if a source is
    // already active.
    if (this.isConnected && (this._src || this._sourceAdapter)) {
      this.load();
    }
  }

  /**
   * Audio-only (data-saver) mode. When true the player skips video decoding to
   * save CPU and, for adaptive streams (HLS/DASH), fetches only audio
   * renditions to save bandwidth; the UI shows the album-art / strip surface.
   * Toggle via this property or the `audioonly` attribute.
   *
   *   player.audioOnly = true;  // data saver on
   */
  get audioOnly(): boolean {
    return this._audioOnly;
  }

  set audioOnly(value: boolean) {
    const enabled = !!value;
    if (enabled === this._audioOnly) return;
    this._audioOnly = enabled;
    // Reflect to the attribute (without re-triggering this setter — the
    // attributeChangedCallback no-ops when the flag already matches).
    if (enabled) this.setAttribute("audioonly", "");
    else this.removeAttribute("audioonly");
    if (this.isConnected) this.applyAudioOnly();
  }

  /**
   * Apply an audio-only toggle to the live player. Adaptive streams change what
   * gets downloaded (Shaka ignores video at manifest-parse time), so they
   * reload; the demuxer path flips video decode on/off in place.
   */
  private applyAudioOnly(): void {
    if (!this.player) return;
    // Always flip in place — NEVER reload. A reload destroys the player (and,
    // for a stream, re-runs Shaka's manifest parse, which fails on HLS with
    // disableVideo and drops the LIVE badge on the hls.js fallback). setAudioOnly
    // handles every source live: streams pick an audio-only / smallest-video
    // variant; split sources stop the demux loop; muxed skips the video decode.
    this.player.setAudioOnly?.(this._audioOnly);
    this.updateCoverArtOverlay();
    this.updateControlsVisibility();
    this.updateLiveState(); // keep the LIVE badge correct (stream stays loaded)
  }

  /**
   * Video.js-style source API
   *
   * Usage:
   *   // Single source as string
   *   player.source('video.mp4');
   *
   *   // Single source as object
   *   player.source({ src: 'video.mp4', type: 'video/mp4' });
   *
   *   // Multiple sources (first playable source wins)
   *   player.source([
   *     { src: 'video.mp4', type: 'video/mp4' },
   *     { src: 'video.webm', type: 'video/webm' },
   *   ]);
   *
   *   // Separate video + audio (DASH-style split)
   *   player.source({
   *     video: { src: 'video-only.mp4', type: 'video/mp4' },
   *     audio: { src: 'audio.m4a', type: 'audio/mp4' },
   *   });
   *
   *   // Multi-language audio
   *   player.source({
   *     video: { src: 'video.mp4', type: 'video/mp4' },
   *     audio: [
   *       { src: 'en.m4a', type: 'audio/mp4', lang: 'en', label: 'English' },
   *       { src: 'hi.m4a', type: 'audio/mp4', lang: 'hi', label: 'Hindi' },
   *     ],
   *   });
   *
   *   // Get current source
   *   const current = player.source();
   */
  source(
    value?:
      | string
      | { src: string; type?: string }
      | { src: string; type?: string }[]
      | {
          video: { src: string; type?: string };
          audio?:
            | { src: string; type?: string }
            | { src: string; type?: string; lang: string; label: string }[];
          subtitles?: {
            src: string;
            lang: string;
            label: string;
            format?: string;
            id?: string;
          }[];
        }
  ): { src: string | File | null; type: string; audioSrc?: string | null } | void {
    // Getter
    if (value === undefined) {
      const currentSrc = this._src;
      if (!currentSrc) return { src: null, type: "", audioSrc: this._audioSrc };
      if (currentSrc instanceof File) return { src: currentSrc, type: currentSrc.type, audioSrc: this._audioSrc };
      return { src: currentSrc, type: this.guessMediaType(currentSrc), audioSrc: this._audioSrc };
    }

    // Setter — string
    if (typeof value === "string") {
      this._audioSrc = null;
      this.src = value;
      return;
    }

    // Setter — array (pick first playable)
    if (Array.isArray(value)) {
      this._audioSrc = null;
      const picked = this.pickSource(value);
      if (picked) {
        this.src = picked.src;
      } else if (value.length > 0) {
        this.src = value[0].src;
      }
      return;
    }

    // Setter — separate video + audio/subtitles { video, audio?, subtitles? }
    if ("video" in value) {
      if (value.audio) {
        if (Array.isArray(value.audio)) {
          this._audioTracks = value.audio;
          this._audioSrc = value.audio[0]?.src || null;
        } else {
          this._audioTracks = [];
          this._audioSrc = value.audio.src;
        }
      } else {
        this._audioTracks = [];
        this._audioSrc = null;
      }
      this._subtitleTracks = value.subtitles || [];
      this.src = value.video.src;
      return;
    }

    // Setter — single object { src, type }
    this._audioSrc = null;
    this.src = (value as { src: string }).src;
  }

  /**
   * Pick the first source whose MIME type the browser can play.
   * Falls back to null if none are supported.
   */
  private pickSource(
    sources: { src: string; type?: string }[]
  ): { src: string; type?: string } | null {
    const testVideo = document.createElement("video");
    for (const s of sources) {
      if (!s.type) return s; // No type hint → try it
      const can = testVideo.canPlayType(s.type);
      if (can === "probably" || can === "maybe") return s;
    }
    return null;
  }

  /**
   * Guess MIME type from a URL string extension.
   */
  private guessMediaType(url: string): string {
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      // Video
      mp4: "video/mp4",
      webm: "video/webm",
      ogv: "video/ogg",
      m3u8: "application/x-mpegURL",
      mpd: "application/dash+xml",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      mov: "video/quicktime",
      ts: "video/mp2t",
      m4v: "video/mp4",
      // Audio — limited to what the shipped FFmpeg WASM build can decode
      // (build-ffmpeg.sh demuxer/decoder list). .ogg is ambiguous between
      // Vorbis audio and Theora video; we map it to audio/ogg because
      // pure audio Ogg is the dominant case in 2026, and the demuxer will
      // happily report a video track for the Theora variant either way.
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      m4b: "audio/mp4",
      aac: "audio/aac",
      flac: "audio/flac",
      wav: "audio/wav",
      wave: "audio/wav",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      opus: "audio/opus",
      ac3: "audio/ac3",
      ec3: "audio/eac3",
      eac3: "audio/eac3",
      mka: "audio/x-matroska",
      dts: "audio/vnd.dts",
    };
    return (ext && map[ext]) || "";
  }

  /**
   * Load an encrypted video source (programmatic API)
   *
   * Usage:
   *   const player = document.querySelector('movi-player');
   *   player.loadEncrypted({
   *     videoUrl: '/api/video',
   *     tokenUrl: '/api/token',
   *     videoId: 'my-video',
   *     fingerprint: await generateFingerprint(),
   *     sessionToken: 'jwt-token',
   *   });
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
    // Reset existing player
    this.resetTimeline();
    this.syncThumbnailRotation(0);

    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    this.isLoading = true;
    if (this.emptyStateIndicator) {
      this.emptyStateIndicator.style.display = "none";
    }

    try {
      // Create player with encrypted source (respecting element properties).
      // Custom media headers ride on the SourceConfig — createSource forwards
      // them to EncryptedHttpSource, which spreads them onto both the stream
      // GET and the token-refresh request (alongside the per-request signing
      // headers).
      this.player = new MoviPlayer({
        source: {
          type: "encrypted",
          encrypted: config,
          ...(this._headers && { headers: this._headers }),
        },
        renderer: "canvas",
        decoder: this._sw,
        canvas: this.canvas,
        enablePreviews: this._thumb,
        frameRate: this._fps || undefined,
        ...(this._headers && { headers: this._headers }),
      });

      // Bind device enumeration + apply any pending `audiooutput` selection.
      this.setupAudioOutputs();

      this.setupEventHandlers();
      await this.player.load();
      if (this._bufferSize > 0) {
        this.player.setMaxBufferSize(this._bufferSize);
      }

      // Apply all element properties (same as initializePlayer)
      this.updateVolume();
      this.updateMuted();
      this.updatePlaybackRate();
      this.updateCanvasSize();
      this.updateFitMode();
      this.updateTimeDisplay();
      if (this.player) {
        this.player.setHDREnabled(this._hdr);
        this.player.setStableAudio(this._stableVolume);
        this.player.setSubtitleOverlay(this.subtitleOverlay);
        this.updateStableAudioUI();
      }
      this.updateHDRVisibility();
      this.updateControlsVisibility();
      this.updateControlsState();
      this.updateLoadingIndicator();
      this.renderChapterMarkers();
      this.startUIUpdates();

      // Seek to start position or resume
      if (this._startAt > 0 && this.player) {
        await this.player.seek(this._startAt).catch(() => {});
      } else if (this._resume && this.player) {
        // Defer to the first "playing" transition (see stateChangeHandler) so
        // the prompt only appears once playback has actually started — i.e.
        // when the bottom-bar play icon first flips to pause — not over the
        // paused/loading chrome.
        this._resumeDialogPending = true;
      }

      // Start resume saving if enabled
      if (this._resume) {
        this.startResumeSaving();
      }

      // Autoplay or render first frame
      if (this._autoplay && this.player) {
        await this.player.play().catch(() => {});
      } else if (this.player) {
        if (this._startAt === 0) {
          this.player.seek(0).catch(() => {});
        }
      }

      // Ambient mode
      this.updateAmbientMode();

      // Dispatch load event
      this.dispatchEvent(new Event("loadeddata"));

      this.isLoading = false;
      if (this._pendingPlay && this.player && !this._isUnsupported) {
        this._pendingPlay = false;
        this.player.play().catch(() => {});
      } else {
        this._pendingPlay = false;
      }
      Logger.info("MoviElement", "Encrypted source loaded");
    } catch (e) {
      this.isLoading = false;
      this._pendingPlay = false;
      Logger.error("MoviElement", "Failed to load encrypted source", e);
      throw e;
    }
  }

  get autoplay(): boolean {
    return this._autoplay;
  }

  set autoplay(value: boolean) {
    if (value) {
      this.setAttribute("autoplay", "");
    } else {
      this.removeAttribute("autoplay");
    }
  }

  get controls(): boolean {
    return this._controls;
  }

  set controls(value: boolean) {
    if (value) {
      this.setAttribute("controls", "");
    } else {
      this.removeAttribute("controls");
    }
  }

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = !!value;
    if (this._loop) {
      this.setAttribute("loop", "");
    } else {
      this.removeAttribute("loop");
    }
    this.updateLoopUI();
  }

  /**
   * The root the context menu currently lives in. On desktop the menu portals
   * to a body-level shadow root while open, so its items are NOT in this.shadowRoot
   * at that moment — a toggle-state updater querying the shadow root would find
   * nothing and silently no-op (the reason menu toggles didn't reflect their new
   * state after a click). Query menu items through this so they're found whether
   * the menu is portaled or still home in the shadow root.
   */
  private contextMenuRoot(): ShadowRoot {
    if (this._menuPortalRoot?.querySelector(".movi-context-menu")) {
      return this._menuPortalRoot;
    }
    return this.shadowRoot!;
  }

  private updateLoopUI(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;
    const menuRoot = this.contextMenuRoot();

    const loopBtn = shadowRoot.querySelector(".movi-loop-btn");
    const loopMenuItem = menuRoot.querySelector(
      '.movi-context-menu-item[data-action="loop-toggle"]',
    );
    const loopStatus = menuRoot.querySelector(".movi-loop-status");

    // Context menu icons
    const ctxOutline = menuRoot.querySelector(".movi-context-menu-loop-outline") as HTMLElement;
    const ctxFilled = menuRoot.querySelector(".movi-context-menu-loop-filled") as HTMLElement;

    if (this._loop) {
      loopBtn?.classList.add("active");
      loopMenuItem?.classList.add("movi-context-menu-active");
      if (loopStatus) loopStatus.textContent = "On";
      if (ctxOutline) ctxOutline.style.display = "none";
      if (ctxFilled) ctxFilled.style.display = "block";
    } else {
      loopBtn?.classList.remove("active");
      loopMenuItem?.classList.remove("movi-context-menu-active");
      if (loopStatus) loopStatus.textContent = "Off";
      if (ctxOutline) ctxOutline.style.display = "block";
      if (ctxFilled) ctxFilled.style.display = "none";
    }
  }

  private updateAmbientUI(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;
    const menuRoot = this.contextMenuRoot();

    const menuItem = menuRoot.querySelector('.movi-context-menu-item[data-action="ambient-toggle"]');
    const status = menuRoot.querySelector(".movi-ambient-status");
    const ctxOutline = menuRoot.querySelector(".movi-context-menu-ambient-outline") as HTMLElement;
    const ctxFilled = menuRoot.querySelector(".movi-context-menu-ambient-filled") as HTMLElement;

    if (this._ambientMode) {
      menuItem?.classList.add("movi-context-menu-active");
      if (status) status.textContent = "On";
      if (ctxOutline) ctxOutline.style.display = "none";
      if (ctxFilled) ctxFilled.style.display = "block";
    } else {
      menuItem?.classList.remove("movi-context-menu-active");
      if (status) status.textContent = "Off";
      if (ctxOutline) ctxOutline.style.display = "block";
      if (ctxFilled) ctxFilled.style.display = "none";
    }
  }

  private updateStableAudioUI(shadowRoot: ShadowRoot | null = this.shadowRoot): void {
    if (!shadowRoot) return;
    const isEnabled = this.player?.getStableAudio() ?? true;
    const menuRoot = this.contextMenuRoot();

    const stableBtn = shadowRoot.querySelector(".movi-stable-audio-btn");
    const stableMenuItem = menuRoot.querySelector(
      '.movi-context-menu-item[data-action="stable-audio-toggle"]',
    );
    const stableStatus = menuRoot.querySelector(".movi-stable-audio-status");

    // Context menu icons
    const ctxOutline = menuRoot.querySelector(".movi-context-menu-stable-outline") as HTMLElement;
    const ctxFilled = menuRoot.querySelector(".movi-context-menu-stable-filled") as HTMLElement;

    if (isEnabled) {
      stableBtn?.classList.add("active");
      stableMenuItem?.classList.add("movi-context-menu-active");
      if (stableStatus) stableStatus.textContent = "On";
      if (ctxOutline) ctxOutline.style.display = "none";
      if (ctxFilled) ctxFilled.style.display = "block";
    } else {
      stableBtn?.classList.remove("active");
      stableMenuItem?.classList.remove("movi-context-menu-active");
      if (stableStatus) stableStatus.textContent = "Off";
      if (ctxOutline) ctxOutline.style.display = "block";
      if (ctxFilled) ctxFilled.style.display = "none";
    }
  }

  /**
   * Toggle nerd stats overlay
   */
  private toggleNerdStats(shadowRoot: ShadowRoot | null = this.shadowRoot): void {
    if (!shadowRoot) return;
    const overlay = shadowRoot.querySelector(".movi-nerd-stats") as HTMLElement;
    if (!overlay) return;

    this._nerdStatsVisible = !this._nerdStatsVisible;

    if (this._nerdStatsVisible) {
      overlay.style.display = "flex";
      // In strip mode the host is 56px tall — anchoring the panel to
      // the host (top:16px from above) drops it on top of the strip's
      // own controls. Compute a viewport position just below the
      // strip's bottom-left so the panel doesn't overlap the bar.
      // Non-strip mode keeps the CSS-driven absolute top-left of the
      // video surface.
      if (this.classList.contains("movi-audio-strip")) {
        const hostRect = this.getBoundingClientRect();
        overlay.style.top = `${hostRect.bottom + 8}px`;
        overlay.style.left = `${hostRect.left}px`;
      } else {
        overlay.style.top = "";
        overlay.style.left = "";
      }
      this.networkSpeedHistory = [];
      this.updateNerdStats(shadowRoot);
      // Update every 500ms
      this.nerdStatsInterval = window.setInterval(() => {
        this.updateNerdStats(shadowRoot);
      }, 500);
    } else {
      overlay.style.display = "none";
      // Clear strip-mode inline coords so a subsequent non-strip open
      // doesn't inherit them.
      overlay.style.top = "";
      overlay.style.left = "";
      if (this.nerdStatsInterval) {
        clearInterval(this.nerdStatsInterval);
        this.nerdStatsInterval = null;
      }
      this.focus();
    }
  }

  /**
   * Update nerd stats content and network graph
   */
  private updateNerdStats(shadowRoot: ShadowRoot): void {
    if (!this.player || !this._nerdStatsVisible) return;
    const overlay = shadowRoot.querySelector(".movi-nerd-stats") as HTMLElement;
    const body = shadowRoot.querySelector(".movi-nerd-stats-body");
    if (!body || !overlay) return;

    // Recalculate max-height every update (fullscreen/resize)
    const hostHeight = (this as HTMLElement).offsetHeight || (this as HTMLElement).clientHeight || 400;
    const bar = shadowRoot.querySelector(".movi-controls-bar") as HTMLElement;
    const controlsHeight = (bar?.offsetHeight ?? 60) + 8;
    const topGap = hostHeight < 400 ? 4 : 12;
    overlay.style.maxHeight = `${hostHeight - controlsHeight - topGap}px`;

    const stats = this.player.getStats();
    let html = "";
    for (const [key, value] of Object.entries(stats)) {
      html += `<div class="movi-nerd-stats-row">
        <span class="movi-nerd-stats-key">${key}</span>
        <span class="movi-nerd-stats-value">${value}</span>
      </div>`;
    }
    // Append graph section at the end of stats body
    const speed = this.player.getNetworkSpeed();
    this.networkSpeedHistory.push(speed);
    if (this.networkSpeedHistory.length > MoviElement.GRAPH_MAX_SAMPLES) {
      this.networkSpeedHistory.shift();
    }

    const graphLabel = this.player.isFileSource() ? "Disk Activity" : "Network Activity";
    const speedText = speed > 1048576
      ? `${(speed / 1048576).toFixed(1)} MB/s`
      : speed > 0
        ? `${(speed / 1024).toFixed(0)} KB/s`
        : "—";

    html += `<div class="movi-nerd-stats-graph-section">
      <div class="movi-nerd-stats-graph-header">
        <span class="movi-nerd-stats-graph-title">${graphLabel}</span>
        <span class="movi-nerd-stats-graph-speed">${speedText}</span>
      </div>
      <canvas class="movi-nerd-stats-graph" width="300" height="80"></canvas>
    </div>`;

    body.innerHTML = html;

    // Draw graph
    this.drawNetworkGraph(shadowRoot);
  }

  /**
   * Draw network throughput graph on canvas
   */
  private drawNetworkGraph(shadowRoot: ShadowRoot): void {
    const body = shadowRoot.querySelector(".movi-nerd-stats-body");
    const canvas = body?.querySelector(".movi-nerd-stats-graph") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Auto-resize canvas to match CSS layout size (HiDPI aware)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.round(rect.width);
    const cssH = Math.round(rect.height);
    if (cssW <= 0 || cssH <= 0) return;
    const bufW = Math.round(cssW * dpr);
    const bufH = Math.round(cssH * dpr);
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }

    // Use CSS dimensions for drawing, scale context each frame
    const w = cssW;
    const h = cssH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const data = this.networkSpeedHistory;
    const maxSamples = MoviElement.GRAPH_MAX_SAMPLES;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, w, h);

    if (data.length < 2) return;

    // Find max for scale (minimum 100KB/s for visual stability)
    const maxSpeed = Math.max(102400, ...data);

    // Grid lines (horizontal)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = Math.round(h * (i / 4)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw filled area
    const stepX = w / (maxSamples - 1);
    const startIdx = maxSamples - data.length;

    ctx.beginPath();
    ctx.moveTo(startIdx * stepX, h);
    for (let i = 0; i < data.length; i++) {
      const x = (startIdx + i) * stepX;
      const y = h - (data[i] / maxSpeed) * (h - 4);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve
        const prevX = (startIdx + i - 1) * stepX;
        const prevY = h - (data[i - 1] / maxSpeed) * (h - 4);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.lineTo((startIdx + data.length - 1) * stepX, h);
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "rgba(0, 200, 120, 0.35)");
    gradient.addColorStop(1, "rgba(0, 200, 120, 0.02)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line on top
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = (startIdx + i) * stepX;
      const y = h - (data[i] / maxSpeed) * (h - 4);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (startIdx + i - 1) * stepX;
        const prevY = h - (data[i - 1] / maxSpeed) * (h - 4);
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    ctx.strokeStyle = "rgba(0, 220, 130, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Current value dot
    if (data.length > 0) {
      const lastX = (startIdx + data.length - 1) * stepX;
      const lastY = h - (data[data.length - 1] / maxSpeed) * (h - 4);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff88";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 255, 136, 0.4)";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  /**
   * Reset timeline panel (clear thumbnails, hide panel)
   */
  /**
   * Apply rotation transform + margin to a seek thumbnail image
   */
  private applyThumbnailRotation(img: HTMLImageElement): void {
    const deg = this._currentManualRotation;
    if (deg === 0) {
      img.style.transform = "none";
      img.style.margin = "";
      return;
    }
    img.style.transform = `rotate(${deg}deg)`;
    if (deg % 180 === 0) {
      img.style.margin = "";
      return;
    }
    // 90/270: need margin fix after image has dimensions
    const fixMargin = () => {
      img.style.margin = "0";
      const w = img.offsetWidth;
      const h = img.offsetHeight;
      if (w > 0 && h > 0) {
        const diff = (w - h) / 2;
        img.style.margin = `${diff}px ${-diff}px ${diff + 6}px ${-diff}px`;
      }
    };
    if (img.complete && img.naturalWidth > 0 && img.offsetWidth > 0) {
      fixMargin();
    } else {
      img.addEventListener("load", fixMargin, { once: true });
    }
  }

  /**
   * Sync thumbnail and timeline rotation with video rotation
   */
  private syncThumbnailRotation(deg: number): void {
    if (!this.shadowRoot) return;
    this._currentManualRotation = deg;

    // Get video aspect ratio to determine if portrait
    const videoTrack = this.player?.getVideoTracks()?.[0];
    const isPortraitVideo = videoTrack && videoTrack.height > videoTrack.width;
    const is90 = deg % 180 !== 0;
    // After 90° rotation: portrait becomes landscape, landscape becomes portrait
    const resultIsPortrait = is90 ? !isPortraitVideo : isPortraitVideo;

    // Seek thumbnail
    const thumbImg = this.shadowRoot.querySelector(".movi-thumbnail-img") as HTMLImageElement;
    if (thumbImg) {
      this.applyThumbnailRotation(thumbImg);
    }

    // Timeline — update portrait/landscape class based on result after rotation
    const strip = this.shadowRoot.querySelector(".movi-timeline-strip");
    if (strip) {
      if (resultIsPortrait) {
        strip.classList.add("movi-timeline-portrait");
      } else {
        strip.classList.remove("movi-timeline-portrait");
      }
    }

    // Timeline items — apply rotation + margin fix
    const timelineImgs = this.shadowRoot.querySelectorAll(".movi-timeline-item img") as NodeListOf<HTMLImageElement>;
    timelineImgs.forEach((el) => {
      if (deg === 0) {
        el.style.transform = "none";
        el.style.margin = "";
        el.style.width = "auto";
        el.style.height = "90px";
      } else if (is90) {
        el.style.width = "90px";
        el.style.height = "auto";
        el.style.transform = `rotate(${deg}deg)`;
        // Use naturalWidth/Height — works even when element is hidden
        const nw = el.naturalWidth;
        const nh = el.naturalHeight;
        if (nw > 0 && nh > 0) {
          // After setting width:90px, rendered height = 90 * (nh/nw)
          const renderedH = 90 * (nh / nw);
          const diff = (90 - renderedH) / 2;
          el.style.margin = `${diff}px ${-diff}px`;
        } else {
          el.style.margin = "0";
        }
      } else {
        // 180°
        el.style.transform = `rotate(${deg}deg)`;
        el.style.margin = "";
        el.style.width = "auto";
        el.style.height = "90px";
      }
    });
  }

  /**
   * Show resume dialog if a saved position exists and we're not mid-context-
   * loss recovery. Centralized so the mobile 4K+ preload gate can hold it
   * back and replay it after preload settles.
   */
  private maybeShowResumeDialog(): void {
    // Resume means seeking to the saved position — impossible in linear
    // (non-seekable) playback, so don't offer it.
    // The dialog is interactive chrome, so it has no business appearing on a
    // bare player with no `controls` attribute — skip it there.
    if (
      !this._resume ||
      !this.player ||
      this._contextLostTime !== 0 ||
      this._linearMode ||
      !this._controls
    )
      return;
    const savedTime = this.getResumePosition();
    if (savedTime > 2 && savedTime < this.duration - 5) {
      this.showResumeDialog(savedTime);
    }
  }

  /**
   * Show resume dialog with saved position
   */
  private showResumeDialog(savedTime: number): void {
    // Linear (non-seekable) playback can't jump to the saved position.
    if (this._linearMode) return;
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Skip when the player is already at (or very close to) the saved position.
    // Happens after background-pause: state is preserved at exactly the saved
    // time, and a "Resume from X?" prompt at the same X is pointless noise.
    const currentTime = this.player ? this.player.getCurrentTime() : 0;
    if (Math.abs(savedTime - currentTime) < 3) return;

    const dialog = shadowRoot.querySelector(".movi-resume-dialog") as HTMLElement;
    if (!dialog) return;

    const timeEl = dialog.querySelector(".movi-resume-time");
    if (timeEl) timeEl.textContent = this.formatTime(savedTime);
    dialog.dataset.time = savedTime.toString();
    dialog.style.display = "flex";

    // Highlight Resume button for keyboard navigation
    dialog.querySelectorAll(".movi-resume-btn").forEach(b => b.classList.remove("movi-resume-focused"));
    const yesBtn = dialog.querySelector(".movi-resume-yes") as HTMLElement;
    yesBtn?.classList.add("movi-resume-focused");

    // Auto-hide after 10 seconds with fade-out
    setTimeout(() => {
      if (dialog.style.display !== "none") {
        dialog.style.animation = "movi-resume-fade-out 0.4s ease forwards";
        setTimeout(() => {
          dialog.style.display = "none";
          dialog.style.animation = "";
        }, 400);
      }
    }, 10000);
  }

  // ─── Resume Playback ────────────────────────────────────────────

  /**
   * Get a unique key for the current source (for localStorage)
   */
  private getResumeKey(): string {
    // Use the final clean title — consistent regardless of URL/proxy/CDN variations.
    if (this._title) {
      return `movi-resume:${this._title}`;
    }
    return "";
  }

  /**
   * Get saved resume position from localStorage
   */
  private getResumePosition(): number {
    const key = this.getResumeKey();
    if (!key) return 0;
    try {
      const val = localStorage.getItem(key);
      return val ? parseFloat(val) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Save current position to localStorage
   */
  private saveResumePosition(): void {
    // The postertime poster seek transiently parks currentTime at the poster
    // timestamp before the clock is reset to 0; don't persist that.
    if (this._posterSeekActive) return;
    const key = this.getResumeKey();
    if (!key || !this.player) return;
    const time = this.currentTime;
    if (time <= 0) return;
    try {
      localStorage.setItem(key, time.toFixed(2));
    } catch {
      // localStorage full or unavailable
    }
  }

  /**
   * Start periodically saving playback position
   */
  private startResumeSaving(): void {
    this.stopResumeSaving();
    // Save every 5 seconds
    this._resumeSaveInterval = window.setInterval(() => {
      if (this.player && this.player.getState() === "playing") {
        this.saveResumePosition();
      }
    }, 5000);
  }

  /**
   * Stop saving playback position
   */
  private stopResumeSaving(): void {
    if (this._resumeSaveInterval) {
      clearInterval(this._resumeSaveInterval);
      this._resumeSaveInterval = null;
    }
  }

  /**
   * Clear saved position for current source
   */
  private clearResumePosition(): void {
    const key = this.getResumeKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  private resetTimeline(): void {
    if (!this.shadowRoot) return;
    this._timelineCancelled = true;
    this._timelineComplete = false;
    this._timelineNextIndex = 0;
    const strip = this.shadowRoot.querySelector(".movi-timeline-strip") as HTMLElement;
    const status = this.shadowRoot.querySelector(".movi-timeline-status") as HTMLElement;
    const panel = this.shadowRoot.querySelector(".movi-timeline-panel") as HTMLElement;
    if (strip) strip.innerHTML = "";
    if (status) status.textContent = "";
    if (panel) panel.style.display = "none";
  }

  /**
   * Toggle timeline panel visibility
   */
  private toggleTimeline(): void {
    // Linear (non-seekable) playback — the timeline strip generates frames by
    // seeking across the file, which this source can't do. No timeline.
    if (this._linearMode) return;
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;
    const panel = shadowRoot.querySelector(".movi-timeline-panel") as HTMLElement;
    if (!panel) return;

    if (panel.style.display === "none") {
      panel.style.display = "flex";
      // Auto-generate if strip is empty, previous attempt failed, or generation
      // was paused mid-way (resumes from _timelineNextIndex)
      const strip = shadowRoot.querySelector(".movi-timeline-strip") as HTMLElement;
      const status = shadowRoot.querySelector(".movi-timeline-status") as HTMLElement;
      const failed = status?.textContent?.includes("Failed");
      if (failed) {
        this._timelineNextIndex = 0;
        this._timelineComplete = false;
        if (strip) strip.innerHTML = "";
      }
      if (strip && !this._timelineComplete && !this._timelineGenerating) {
        requestAnimationFrame(() => this.generateTimelineStrip(shadowRoot));
      }
    } else {
      this._timelineCancelled = true;
      panel.style.display = "none";
      this.focus();
      // Re-arm auto-hide only if the bar is currently visible; never surface a
      // hidden bar on close (see the close-button handler for the reasoning).
      if (!this.controlsContainer?.classList.contains("movi-controls-hidden")) {
        this.showControls();
      }
    }
  }

  /**
   * Generate timeline thumbnail strip
   */
  private async generateTimelineStrip(shadowRoot: ShadowRoot): Promise<void> {
    if (!this.player) return;
    if (this._timelineGenerating) return; // re-entrancy guard

    // The Timeline panel is an explicit user action (press "T") and must render
    // regardless of the `thumb` attribute — that attribute only gates the
    // passive seek-bar hover preview (which stays independently gated on
    // `_thumb` in updateSeekVisuals). Enable the shared thumbnail pipeline so
    // the getPreviewFrame() calls below can decode frames even when `thumb`
    // is off; turning it on here never triggers seek-bar previews on its own.
    this.player.setPreviewsEnabled(true);

    const strip = shadowRoot.querySelector(".movi-timeline-strip") as HTMLElement;
    const status = shadowRoot.querySelector(".movi-timeline-status") as HTMLElement;
    const titleEl = shadowRoot.querySelector(".movi-timeline-title") as HTMLElement;
    if (!strip || !status) return;

    // Only clear when starting fresh; on resume we keep already-generated items
    if (this._timelineNextIndex === 0) {
      strip.innerHTML = "";
    }
    this._timelineGenerating = true;
    this._timelineCancelled = false;

    // Detect portrait video — consider metadata rotation
    const videoTrack = this.player.getVideoTracks()?.[0];
    const metadataRotation = videoTrack?.rotation || 0;
    const metaIs90 = metadataRotation % 180 !== 0;
    // After metadata rotation, is the video portrait?
    const isPortraitAfterMeta = videoTrack
      ? (metaIs90 ? videoTrack.width > videoTrack.height : videoTrack.height > videoTrack.width)
      : false;
    const deg = this._currentManualRotation;
    const is90 = deg % 180 !== 0;
    // Manual rotation flips orientation again
    const resultIsPortrait = is90 ? !isPortraitAfterMeta : isPortraitAfterMeta;

    if (resultIsPortrait) {
      strip.classList.add("movi-timeline-portrait");
    } else {
      strip.classList.remove("movi-timeline-portrait");
    }

    // Helper to apply rotation to a single image element
    const applyRotationToImg = (el: HTMLElement) => {
      if (deg === 0) return;
      if (is90) {
        el.style.width = "90px";
        el.style.height = "auto";
        el.style.transform = `rotate(${deg}deg)`;
        el.style.margin = "0";
        requestAnimationFrame(() => {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          if (w > 0 && h > 0) {
            const diff = (w - h) / 2;
            el.style.margin = `${diff}px ${-diff}px`;
          }
        });
      } else {
        el.style.transform = `rotate(${deg}deg)`;
      }
    };

    const formatTime = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = Math.floor(s % 60);
      return h > 0
        ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
        : `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const chapters = this.player.getChapters();
    const hasChapters = chapters.length > 0;

    try {
      if (hasChapters) {
        // Chapter-based timeline
        if (titleEl) titleEl.textContent = `Chapters (${chapters.length})`;
        status.textContent = "Generating...";

        for (let i = this._timelineNextIndex; i < chapters.length; i++) {
          const ch = chapters[i];
          // Generate thumbnail at chapter start time
          const blob = await this.player.getPreviewFrame(ch.start);
          if (this._timelineCancelled) return;

          const item = document.createElement("div");
          item.className = "movi-timeline-item movi-timeline-chapter";

          if (blob) {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(blob);
            img.alt = ch.title;
            item.appendChild(img);
          }

          const labelContainer = document.createElement("div");
          labelContainer.className = "movi-timeline-chapter-label";

          const titleSpan = document.createElement("span");
          titleSpan.className = "movi-timeline-chapter-title";
          titleSpan.textContent = ch.title;

          const timeSpan = document.createElement("span");
          timeSpan.className = "movi-timeline-time";
          timeSpan.textContent = formatTime(ch.start);

          labelContainer.appendChild(titleSpan);
          labelContainer.appendChild(timeSpan);
          item.appendChild(labelContainer);

          // Click to seek to chapter
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentTime = ch.start;
          });

          strip.appendChild(item);
          const chImg = item.querySelector("img") as HTMLElement;
          if (chImg) applyRotationToImg(chImg);
          this._timelineNextIndex = i + 1;
          status.textContent = `${i + 1} / ${chapters.length}`;
        }

        status.textContent = `${chapters.length} chapters`;
        this._timelineComplete = true;
      } else {
        // Regular interval-based timeline
        if (titleEl) titleEl.textContent = "Timeline";
        status.textContent = "Generating...";
        const count = 20;
        const duration = this.player.getDuration();
        if (duration <= 0) {
          status.textContent = "Failed to generate — try again";
          return;
        }
        // Mirror MoviPlayer.generateTimeline interval (avoids first/last frames)
        const interval = duration / (count + 1);

        for (let i = this._timelineNextIndex; i < count; i++) {
          const time = interval * (i + 1);
          const blob = await this.player.getPreviewFrame(time);
          if (this._timelineCancelled) return;
          // Advance even on null so a permanently-failing frame doesn't wedge resume
          this._timelineNextIndex = i + 1;
          if (!blob) continue;

          const item = document.createElement("div");
          item.className = "movi-timeline-item";

          const img = document.createElement("img");
          img.src = URL.createObjectURL(blob);
          img.alt = `Timeline ${formatTime(time)}`;

          const label = document.createElement("span");
          label.className = "movi-timeline-time";
          label.textContent = formatTime(time);

          item.appendChild(img);
          item.appendChild(label);

          item.addEventListener("click", (e) => {
            e.stopPropagation();
            this.currentTime = time;
          });

          strip.appendChild(item);
          applyRotationToImg(img);
          status.textContent = `${strip.children.length} / ${count}`;
        }

        status.textContent = strip.children.length > 0
          ? `${strip.children.length} thumbnails`
          : "Failed to generate — try again";
        if (strip.children.length > 0) this._timelineComplete = true;
      }
    } finally {
      this._timelineGenerating = false;
    }

  }

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    // Set `_muted` directly up front rather than relying on the
    // attributeChangedCallback to do it. The auto-mute autoplay fallback
    // mutes by setting `_muted = true` WITHOUT adding the `muted` attribute
    // (so it doesn't trip the user-intent latch). For that case the
    // attribute is already absent, so removeAttribute() below fires no
    // change callback — leaving `_muted` stuck true and the pill click a
    // no-op. Setting it here makes the unmute path attribute-independent.
    this._muted = value;
    if (value) {
      this.setAttribute("muted", "");
    } else {
      // Reaching the setter (M-key, integrator JS, slider-driven unmute,
      // pill click) is by definition a deliberate unmute — latch so the
      // floating pill doesn't reappear if the user mutes again later.
      // Init-time attribute parsing and SettingsStorage restore mutate
      // `_muted` directly without going through this setter, so they
      // can't accidentally trip the latch.
      this._userHasUnmuted = true;
      this.removeAttribute("muted");
    }
    this.updateMuted();
    SettingsStorage.getInstance().save({ muted: this._muted });
    this.dispatchEvent(new CustomEvent("volumechange", { detail: { volume: this._volume, muted: this._muted } }));
  }

  get playsInline(): boolean {
    return this._playsinline;
  }

  set playsInline(value: boolean) {
    if (value) {
      this.setAttribute("playsinline", "");
    } else {
      this.removeAttribute("playsinline");
    }
  }

  get preload(): "none" | "metadata" | "auto" {
    return this._preload;
  }

  set preload(value: "none" | "metadata" | "auto") {
    this.setAttribute("preload", value);
  }

  get poster(): string {
    return this._poster;
  }

  set poster(value: string) {
    this.setAttribute("poster", value);
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    // 0–2: values above 1 boost audio up to 200% (VLC-style).
    this._volume = Math.max(0, Math.min(this.getMaxVolume(), value));
    this.setAttribute("volume", this._volume.toString());

    // If user increases volume while muted, automatically unmute (like YouTube)
    const autoUnmuted = this._muted && this._volume > 0;
    if (autoUnmuted) {
      this._muted = false;
      this._userHasUnmuted = true;
      this.removeAttribute("muted");
      // Update player muted state immediately
      if (this.player) {
        this.player.setMuted(false);
      }
    }

    this.updateVolume();
    // Persist `muted: false` here too whenever the slider triggered an
    // auto-unmute — this path bypasses `set muted` (mutates `_muted`
    // directly to keep things synchronous with the slider drag), so
    // without this the persisted state lags behind: a session that
    // ends unmuted-via-slider reloads as muted because OPFS still
    // holds the last muted=true write from whenever the user first
    // muted via M-key or the volume button.
    SettingsStorage.getInstance().save(
      autoUnmuted ? { volume: this._volume, muted: false } : { volume: this._volume },
    );
    this.dispatchEvent(new CustomEvent("volumechange", { detail: { volume: this._volume, muted: this._muted } }));
  }

  get playbackRate(): number {
    return this._playbackRate;
  }

  set playbackRate(value: number) {
    // Clamp to the source's allowed ceiling — 8K+ sources can't sustain >1.5x
    // decode in any browser today, so even programmatic callers are clamped
    // to prevent decoder errors / stalls. getMaxAllowedRate returns 2 when
    // no track is active yet, so attribute init / settings restore still work.
    const ceiling = this.getMaxAllowedRate();
    this._playbackRate = Math.max(0.25, Math.min(ceiling, value));
    this.setAttribute("playbackrate", this._playbackRate.toString());
    this.updatePlaybackRate();
    SettingsStorage.getInstance().save({ playbackRate: this._playbackRate });
    this.dispatchEvent(new CustomEvent("ratechange", { detail: { playbackRate: this._playbackRate } }));
    // Keep the OS lock-screen scrubber's speed indicator in sync.
    this.updateMediaSessionPosition();
    // Each new speed gets a fresh stutter warning if it can't keep up.
    this.resetStutterHint();
  }

  get subtitleDelay(): number {
    return this._subtitleDelay;
  }

  set subtitleDelay(value: number) {
    if (!Number.isFinite(value)) return;
    this._subtitleDelay = value;
    this.setAttribute("subtitledelay", this._subtitleDelay.toString());
    this.updateSubtitleDelay();
    this.dispatchEvent(
      new CustomEvent("subtitledelaychange", {
        detail: { subtitleDelay: this._subtitleDelay },
      }),
    );
  }

  /** VLC-style API alias from the feature request issue. */
  setSubtitleDelay(seconds: number): void {
    this.subtitleDelay = seconds;
  }

  /** VLC-style API alias from the feature request issue. */
  getSubtitleDelay(): number {
    return this._subtitleDelay;
  }

  get ambientMode(): boolean {
    return this._ambientMode;
  }

  set ambientMode(value: boolean) {
    this._ambientMode = value;
    if (value) {
      this.setAttribute("ambientmode", "");
    } else {
      this.removeAttribute("ambientmode");
    }
    this.updateAmbientMode();
    SettingsStorage.getInstance().save({ ambientMode: this._ambientMode });
  }

  get stableVolume(): boolean {
    return this._stableVolume;
  }

  set stableVolume(value: boolean) {
    this._stableVolume = !!value;
    if (this._stableVolume) {
      this.setAttribute("stablevolume", "");
    } else {
      this.removeAttribute("stablevolume");
    }
    if (this.player) {
      this.player.setStableAudio(this._stableVolume);
      this.updateStableAudioUI();
    }
    SettingsStorage.getInstance().save({ stableVolume: this._stableVolume });
  }

  get currentTime(): number {
    // While a quality switch is in flight the new player has been created
    // but its clock hasn't been seeked yet, so getCurrentTime() reads 0 and
    // the UI flashes "00:00". Return the captured pre-switch time until the
    // restore step seeks the new clock back to the right position.
    if (this._qualitySwitchInProgress && this._switchResumeTime > 0) {
      const liveTime = this.player?.getCurrentTime() || 0;
      // Once the new clock has actually advanced past 0 (post-seek), trust
      // it again — guards against permanently masking the real time if the
      // safety-timeout fires before "playing".
      if (liveTime > 0.05) return liveTime;
      return this._switchResumeTime;
    }
    return this.player?.getCurrentTime() || 0;
  }

  set currentTime(value: number) {
    // Player not built yet — hold the seek and apply it once it's ready.
    if (!this.player) {
      this._pendingSeek = value;
      return;
    }
    // Linear (non-seekable source) playback — only the bytes in the RAM window
    // are reachable, so clamp the target to the buffered range instead of
    // jumping somewhere that was discarded / not yet downloaded.
    value = this.clampToBufferedWindow(value);
    const state = this.player.getState();
    Logger.info(TAG, `currentTime setter: value=${value.toFixed(2)}, state=${state}, isSeeking=${this.isSeeking}`);
    if (
      state !== "ready" &&
      state !== "playing" &&
      state !== "paused" &&
      state !== "ended" &&
      state !== "seeking" &&
      state !== "buffering"
    ) {
      // Not seekable yet (still loading/initialising). Hold the seek; the
      // stateChange handler applies it the moment the player becomes ready.
      Logger.info(TAG, `Seek held until ready — state=${state}`);
      this._pendingSeek = value;
      return;
    }

    // We're committed to seeking now, so any earlier held seek is superseded.
    this._pendingSeek = null;

    // Coalesce: a previous seek is still running. Stash the latest target and
    // bail. The in-flight seek's finally() will pick up the latest target,
    // collapsing any number of intermediate sets into one tail seek.
    if (this.isSeeking) {
      this.pendingSeekTarget = value;
      return;
    }

    this.isSeeking = true;
    this.player
      .seek(value)
      .then(() => {
        Logger.info(TAG, `Seek resolved: value=${value.toFixed(2)}, newState=${this.player?.getState()}`);
      })
      .catch((error) => {
        Logger.error(TAG, `Seek error: value=${value.toFixed(2)}`, error);
      })
      .finally(() => {
        this.isSeeking = false;
        if (this.pendingSeekTarget !== null) {
          const next = this.pendingSeekTarget;
          this.pendingSeekTarget = null;
          this.currentTime = next;
        }
      });
  }

  get renderer(): RendererType {
    return this._renderer;
  }

  set renderer(value: RendererType) {
    if (this._renderer !== value) {
      if (value === "canvas") {
        this.setAttribute("renderer", value);
      } else {
        // Fallback to canvas for invalid values
        this.setAttribute("renderer", "canvas");
      }
    }
  }

  get sw(): boolean | "auto" {
    if (this.getAttribute("sw") === "auto") return "auto";
    return this._sw === "software";
  }

  set sw(value: boolean | "auto") {
    const newValue: DecoderType =
      value === "auto" ? "auto" : value ? "software" : "auto";
    if (this._sw !== newValue) {
      this._sw = newValue;
      if (newValue === "software") {
        this.setAttribute("sw", "");
      } else if (value === "auto") {
        this.setAttribute("sw", "auto");
      } else {
        this.removeAttribute("sw");
      }
    }
  }

  get fps(): number {
    return this._fps;
  }

  set fps(value: number) {
    if (this._fps !== value) {
      this._fps = value;
      if (value > 0) {
        this.setAttribute("fps", value.toString());
      } else {
        this.removeAttribute("fps");
      }
    }
  }

  /** @deprecated Use `playsInline` instead — an inline player now restricts
   *  touch gestures to fullscreen on its own. Kept for backward compatibility. */
  get gesturefs(): boolean {
    return this._gesturefs;
  }

  /** @deprecated Use `playsInline` instead. */
  set gesturefs(value: boolean) {
    if (this._gesturefs !== value) {
      this._gesturefs = value;
      if (value) {
        this.setAttribute("gesturefs", "");
      } else {
        this.removeAttribute("gesturefs");
      }
    }
  }

  get nohotkeys(): boolean {
    return this._noHotkeys;
  }

  set nohotkeys(value: boolean) {
    if (this._noHotkeys !== value) {
      this._noHotkeys = value;
      if (value) {
        this.setAttribute("nohotkeys", "");
      } else {
        this.removeAttribute("nohotkeys");
      }
    }
  }

  get startat(): number {
    return this._startAt;
  }
  set startat(value: number) {
    this._startAt = value;
    this.setAttribute("startat", value.toString());
  }

  get fastseek(): boolean {
    return this._fastSeek;
  }
  set fastseek(value: boolean) {
    this._fastSeek = value;
    if (value) {
      this.setAttribute("fastseek", "");
    } else {
      this.removeAttribute("fastseek");
    }
    this.updateFastSeek();
    this.updatePoster();
  }

  private updatePoster() {
    // Only show the poster when there's actually a media source to back it.
    // Without this gate, setting poster="..." paints the overlay even in the
    // empty "No Video" state, which looks like a broken image.
    const hasSource = !!this._src || (this._encrypted && !!this._videoUrl);
    if (!hasSource) {
      this.posterElement.style.display = "none";
      return;
    }
    // While a quality switch is in flight the snapshot-poster mechanism owns
    // the overlay (it's pinned to the last canvas frame). Bail out so we
    // don't overwrite its src with the static thumbnail.
    if (this._qualitySwitchInProgress && this._snapshotPosterActive) {
      return;
    }
    if (this._poster) {
      this.posterElement.src = this._poster;
      this.posterElement.style.display = "block";
      this.posterElement.style.objectFit = this.posterObjectFit();
    } else if (this._generatedPosterUrl) {
      // Fall back to the postertime-generated poster if no explicit URL.
      this.posterElement.src = this._generatedPosterUrl;
      this.posterElement.style.display = "block";
      this.posterElement.style.objectFit = this.posterObjectFit();
    } else {
      this.posterElement.style.display = "none";
    }

    // In 360° mode the flat poster <img> is replaced by the equirectangular
    // projection of the same image on the canvas. renderVRPosterIfNeeded hides
    // the <img> only once it has actually drawn, so a load failure leaves the
    // flat overlay visible rather than a blank canvas.
    if (this._vr360 && this.posterElement.style.display !== "none") {
      void this.renderVRPosterIfNeeded();
    }
  }

  get postertime(): string | null {
    return this._posterTime;
  }
  set postertime(value: string | null) {
    this._posterTime = value;
    if (value) {
      this.setAttribute("postertime", value);
    } else {
      this.removeAttribute("postertime");
    }
  }

  /**
   * Parse a `postertime` string into seconds, clamped to [0, duration].
   * Accepted formats:
   *   - "10%"      → 10% of duration
   *   - "5"        → 5 seconds
   *   - "1:30"     → 90 seconds (mm:ss)
   *   - "0:01:30"  → 90 seconds (hh:mm:ss)
   */
  private parsePosterTime(raw: string | null, duration: number): number | null {
    if (!raw || !isFinite(duration) || duration <= 0) return null;
    const s = raw.trim();
    if (!s) return null;

    // Percentage
    if (s.endsWith("%")) {
      const pct = parseFloat(s);
      if (!isFinite(pct)) return null;
      return Math.max(0, Math.min(duration, (pct / 100) * duration));
    }

    // hh:mm:ss or mm:ss
    if (s.includes(":")) {
      const parts = s.split(":").map((p) => parseFloat(p));
      if (parts.some((p) => !isFinite(p))) return null;
      let seconds = 0;
      if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
      else if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      else return null;
      return Math.max(0, Math.min(duration, seconds));
    }

    // Plain seconds (possibly with "s" suffix)
    const num = parseFloat(s.replace(/s$/i, ""));
    if (!isFinite(num)) return null;
    return Math.max(0, Math.min(duration, num));
  }


  get doubletap(): boolean {
    return this._doubleTap;
  }
  set doubletap(value: boolean) {
    this._doubleTap = value;
    if (value) {
      this.setAttribute("doubletap", "true");
    } else {
      this.setAttribute("doubletap", "false");
    }
  }

  get themecolor(): string | null {
    return this._themeColor;
  }
  set themecolor(value: string | null) {
    this._themeColor = value;
    if (value) {
      this.setAttribute("themecolor", value);
      this.style.setProperty("--movi-primary", value);
    } else {
      this.removeAttribute("themecolor");
      this.style.removeProperty("--movi-primary");
    }
  }

  get buffersize(): number {
    return this._bufferSize;
  }
  set buffersize(value: number) {
    this._bufferSize = value;
    this.setAttribute("buffersize", value.toString());
  }

  get title(): string {
    return this._title || "";
  }
  set title(value: string) {
    this._title = value || null;
    // Reset auto-load flag when user explicitly sets title
    this._titleAutoLoaded = false;
    // Do NOT reflect to the host `title` attribute — it would trigger the
    // browser's native tooltip on hover. The overlay reads `_title` directly.
    this.updateTitle();
  }

  get showtitle(): boolean {
    return this._showTitle;
  }
  set showtitle(value: boolean) {
    this._showTitle = value;
    if (value) {
      this.setAttribute("showtitle", "");
    } else {
      this.removeAttribute("showtitle");
    }
    this.updateTitle();
  }

  private updateTitle() {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const titleBar = shadowRoot.querySelector(".movi-title-bar") as HTMLElement;
    const titleText = shadowRoot.querySelector(
      ".movi-title-text",
    ) as HTMLElement;

    if (!titleBar || !titleText) return;

    // Auto-load title from media metadata if not explicitly set
    if (
      this._showTitle &&
      !this._title &&
      !this._titleAutoLoaded &&
      this.player &&
      this.duration > 0
    ) {
      // Title priority: Metadata → Content-Disposition → URL filename.
      // Encrypted mode doesn't set `_src` (URL lives in `videoid`), so
      // allow the block to run there too.
      const haveTitleSource =
        !!this._src ||
        (this._encrypted && !!this._videoId);
      if (haveTitleSource) {
        let filename = "";

        // Priority 1: FFmpeg metadata title (skip if it's a watermark like "Downloaded From ...")
        if (this.player) {
          const metaTitle = this.player.getMetadataTitle?.();
          if (metaTitle && !/download/i.test(metaTitle)) {
            filename = metaTitle;
          }
        }

        // Priority 2: Content-Disposition header (skip if contains "download")
        if (!filename && this.player) {
          const dispositionName = this.player.getContentDispositionFilename();
          if (dispositionName) {
            const nameNoExt = dispositionName.replace(/\.[^.\/]+$/, "");
            if (!/download/i.test(nameNoExt)) {
              filename = nameNoExt;
            }
          }
        }

        // Priority 3: File object name or URL filename
        if (!filename) {
          // In encrypted mode we never set `src` — the upstream URL lives
          // in the `videoid` attribute instead. Fall back to that so the
          // title overlay still works on /api/video-backed playback.
          let srcForTitle: string | File | null = this._src;
          if (
            !srcForTitle &&
            this._encrypted &&
            this._videoId &&
            /^https?:\/\//i.test(this._videoId)
          ) {
            srcForTitle = this._videoId;
          }
          if (srcForTitle instanceof File) {
            filename = srcForTitle.name;
          } else if (typeof srcForTitle === "string") {
            try {
              let srcUrl = new URL(srcForTitle, window.location.href);
              if (srcUrl.pathname === "/proxy" && srcUrl.searchParams.get("url")) {
                srcUrl = new URL(srcUrl.searchParams.get("url")!);
              }
              const pathname = srcUrl.pathname;
              filename = pathname.substring(pathname.lastIndexOf("/") + 1);
              if (filename) {
                filename = decodeURIComponent(filename.split("?")[0]);
              }
            } catch {
              filename = srcForTitle;
            }
          }
        }

        // Remove file extension from filename
        if (filename) {
          filename = filename.replace(/\.[^.\/]+$/, "");
          // If filename is empty or non-descriptive, try parent path segment
          if (!filename || filename === "index" || filename === "master" || filename === "playlist") {
            try {
              const url = new URL(this._src as string, window.location.href);
              const segments = url.pathname.split("/").filter(s => s && !s.includes("."));
              if (segments.length > 0) {
                filename = decodeURIComponent(segments[segments.length - 1]).replace(/[-_]/g, " ");
              }
            } catch { /* ignore */ }
          }
          if (filename) {
            this._title = this.cleanVideoTitle(filename);
          }
        }
        this._titleAutoLoaded = true;
        if (this._title) {
          this.dispatchEvent(new CustomEvent("titlechange", { detail: { title: this._title } }));
          // Re-check resume now that title is available (resume key depends on _title)
          if (this._resume && this.player && !this._resumeCheckedWithTitle) {
            this._resumeCheckedWithTitle = true;
            const savedTime = this.getResumePosition();
            if (savedTime > 2 && savedTime < this.duration - 5) {
              if (this._hasEverPlayed) {
                // Playback already started before the title (and thus the
                // resume key) resolved — surface the prompt immediately.
                this.showResumeDialog(savedTime);
              } else {
                // Still pre-playback: hold it for the first "playing"
                // transition so it lands with the play→pause icon flip.
                this._resumeDialogPending = true;
              }
            }
          }
        }
      }
    }

    if (this._showTitle && this._title) {
      // Detect "title just appeared" — either the text content changed,
      // or the bar was previously hidden. Covers both explicit-attribute
      // and auto-load paths: in autoplay+muted with no user interaction
      // the controls never become visible on their own, so without this
      // nudge the title would stay at opacity 0 until the user moved
      // the mouse.
      const titleAppeared =
        titleText.textContent !== this._title ||
        titleBar.style.display === "none";
      titleText.textContent = this._title;
      titleBar.style.display = "block";

      // Surface the bottom bar alongside the title only after playback
      // has actually started — otherwise the YouTube-style first paint
      // (poster + centre play icon only) gets disrupted the moment the
      // title auto-loads from metadata. The autoplay+muted case the
      // original showControls() call was added for is still covered:
      // by the time autoplay reaches "playing" and the title becomes
      // available, _hasEverPlayed is true.
      if (titleAppeared && this._hasEverPlayed) this.showControls();

      // Show title if controls are currently visible
      const container = this.controlsContainer;
      if (container?.classList.contains("movi-controls-visible")) {
        titleBar.classList.add("movi-title-visible");
      }
    } else {
      titleBar.style.display = "none";
      titleBar.classList.remove("movi-title-visible");
    }

    // Strip mode reads this to grow into a 2-row layout (title band + control
    // row) only when a title is actually present — keeps the untitled audio
    // strip at its thin 56px height.
    this.classList.toggle("movi-has-title", !!(this._showTitle && this._title));
  }

  /**
   * Clean a video filename into a human-readable title (VLC-style).
   * "The.Boys.S05E01.Fifteen.Inches.of.Sheer.Dynamite.2160p.AMZN.WEB-DL.Hindi.DDP5.1-English.DDP5.1.Atmos.DV.HDR.H.265-4kHdHub.Com"
   * → "The Boys S05E01 Fifteen Inches of Sheer Dynamite"
   */
  /**
   * Turn a raw filename or metadata string into a human-readable title by
   * stripping separators, release-group tags, and quality/codec suffixes.
   * Exposed as a static utility so callers (e.g. a playlist UI) can derive
   * the same value the player does — useful for computing the resume
   * localStorage key (`movi-resume:<cleanVideoTitle(name)>`).
   */
  static cleanVideoTitle(filename: string): string {
    // Decode HTML entities a scraper / download-site baked into the name or
    // metadata title (e.g. `From &Quot;X&Quot;` → `From "X"`). `&quot;` is
    // matched case-insensitively — some sources emit the non-standard
    // `&Quot;`. `&amp;` is decoded last so `&amp;gt;` lands at `&gt;`, not `>`.
    let title = filename
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/&#(\d+);/g, (m, n) => {
        const c = parseInt(n, 10);
        return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
      })
      .replace(/&#x([0-9a-f]+);/gi, (m, n) => {
        const c = parseInt(n, 16);
        return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
      })
      .replace(/&amp;/gi, "&");

    // Replace dots and underscores with spaces
    title = title.replace(/[._]/g, " ");

    // Remove common release group / site suffixes (e.g., "-4kHdHub Com", "-YIFY", "-HDHub4u Ms")
    // Only strip if the part after dash looks like a release group (contains digits, dots, or known groups)
    title = title.replace(/\s*-\s*(?:\w*\d\w*[\w ]*|YIFY|RARBG|YTS|ETRG|SPARKS|GECKOS|EVO|FGT|CMRG|NTb|SiGMA|FLUX|ION10|PECULATE|PSA|QxR|TiGOLE|MeGusta|PAHE|HDHub\w*)\s*$/i, "");

    // Truncate at quality/codec markers
    const cutPatterns = /\b(2160p|1080p|720p|480p|4K|UHD|HD|HQ|WEB[ -]?DL|WEB[ -]?Rip|BluRay|BDRip|BRRip|HDRip|DVDRip|HDTV|AMZN|NF|DSNP|HMAX|ATVP|PCOK|PMTP|MA |DDP?\d|AAC|AC3|FLAC|Atmos|TrueHD|DTS|HEVC|H[ .]?26[45]|x26[45]|AV1|VP9|HDR|HDR10|DV|DoVi|Dolby|REMUX|PROPER|REPACK|iNTERNAL|EXTENDED|UNRATED|DC |10bit|8bit)\b/i;
    const match = title.match(cutPatterns);
    if (match && match.index && match.index > 5) {
      title = title.substring(0, match.index);
    }

    // Clean up orphan trailing brackets, hyphens, and extra spaces
    title = title.replace(/\s*[\(\[]\s*$/, "").replace(/\s*[-–—]\s*$/, "").replace(/\s+/g, " ").trim();

    // Convert any remaining internal hyphens into spaces. Done AFTER the
    // release-group strip above (which keys off `-` as the separator
    // marker) so we don't erase its signal before it runs. Source files
    // like `sintel-2010-1080p.mkv` would otherwise read as "sintel 2010"
    // — readable, but visually clunky next to the dot-separated style
    // (`Sintel.2010.1080p.mkv` → "Sintel 2010") that picker-dropped
    // files produce. Normalising both styles keeps the overlay
    // consistent regardless of how the source was named.
    title = title.replace(/[-–—]+/g, " ").replace(/\s+/g, " ").trim();

    // Title-case words that arrived all-lowercase (e.g. URL filenames
    // are usually `sintel`, not `Sintel`). Mixed-case tokens like
    // `iPhone` or `MoviePlayer` are intentional capitalisation — the
    // `\b[a-z]+\b` guard skips them. Numbers and ALLCAPS stay as-is.
    title = title.replace(/\b[a-z]+\b/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));

    return title || filename;
  }

  private cleanVideoTitle(filename: string): string {
    return MoviElement.cleanVideoTitle(filename);
  }

  get duration(): number {
    const live = this.player?.getDuration() || 0;
    // While a quality switch is in flight the new player's mediaInfo isn't
    // populated yet so getDuration() returns 0 — fall back to the cached
    // pre-switch duration. (Quality variants share the same length, so this
    // is always correct.)
    if (this._qualitySwitchInProgress && this._switchResumeDuration > 0 && live <= 0) {
      return this._switchResumeDuration;
    }
    return live;
  }

  get paused(): boolean {
    return this.player?.getState() === "paused" || false;
  }

  get ended(): boolean {
    return this.player?.getState() === "ended" || false;
  }

  /** True only while the player is actively playing. Unlike `!paused`, this
   * distinguishes "playing" from intermediate states like "ready", "loading",
   * "seeking" and "buffering" — useful when deciding whether to carry play
   * state over to a new source. */
  get playing(): boolean {
    return this.player?.getState() === "playing" || false;
  }

  get readyState(): number {
    // Map MoviPlayer states to HTMLMediaElement readyState
    // 0 = HAVE_NOTHING, 1 = HAVE_METADATA, 2 = HAVE_CURRENT_DATA, 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
    const state = this.player?.getState();
    if (!state || state === "idle") return 0; // HAVE_NOTHING
    if (state === "ready" || state === "loading") return 1; // HAVE_METADATA
    if (state === "playing" || state === "paused") return 4; // HAVE_ENOUGH_DATA
    return 0;
  }

  get width(): number {
    return this.canvas.width;
  }

  set width(value: number) {
    this.setAttribute("width", value.toString());
    this.updateCanvasSize();
  }

  get height(): number {
    return this.canvas.height;
  }

  set height(value: number) {
    this.setAttribute("height", value.toString());
    this.updateCanvasSize();
  }

  get objectFit(): "contain" | "cover" | "fill" | "zoom" | "control" {
    return this._objectFit;
  }

  set objectFit(value: "contain" | "cover" | "fill" | "zoom" | "control") {
    this.setAttribute("objectfit", value);
  }

  get thumb(): boolean {
    return this._thumb;
  }

  set thumb(value: boolean) {
    if (value) {
      this.setAttribute("thumb", "");
    } else {
      this.removeAttribute("thumb");
    }
  }

  get hdr(): boolean {
    return this._hdr;
  }

  set hdr(value: boolean) {
    const v = !!value;
    if (this._hdr === v) return;
    this._hdr = v;
    if (this._hdr) {
      this.setAttribute("hdr", "");
    } else {
      this.removeAttribute("hdr");
    }

    this.updateHDRUI();

    // Pass to player
    if (this.player) {
      this.player.setHDREnabled(this._hdr);
    }

    SettingsStorage.getInstance().save({ hdr: this._hdr });
  }

  /**
   * Whether the currently loaded source is classified as HDR (BT.2020
   * primaries or PQ/HLG transfer). Public mirror of the same check the
   * element uses internally for HDR-button visibility — safe for host
   * pages to read without reaching into private `.player` internals.
   * Returns false before a source has loaded.
   */
  get isHDRContent(): boolean {
    return !!this.player?.isHDRSupported?.();
  }

  private updateHDRUI(): void {
    const menuRoot = this.contextMenuRoot();
    const hdrBtn = this.shadowRoot?.querySelector(".movi-hdr-btn");
    const hdrStatus = menuRoot.querySelector(".movi-hdr-status");
    const hdrMenuItem = menuRoot.querySelector(
      '.movi-context-menu-item[data-action="hdr-toggle"]',
    );

    if (this._hdr) {
      hdrBtn?.classList.add("movi-hdr-active");
      hdrMenuItem?.classList.add("movi-context-menu-active");
      if (hdrStatus) hdrStatus.textContent = "On";
    } else {
      hdrBtn?.classList.remove("movi-hdr-active");
      hdrMenuItem?.classList.remove("movi-context-menu-active");
      if (hdrStatus) hdrStatus.textContent = "Off";
    }
  }

  /*
   * Take a snapshot of the current frame and download it
   */
  private async takeSnapshot(): Promise<void> {
    if (!this.player) return;

    try {
      let dataUrl: string | null = null;

      // If we are in canvas mode, it's easy
      if (this.canvas && this.canvas.style.display !== "none") {
        dataUrl = this.canvas.toDataURL("image/png");
        // Some GPUs return an all-black buffer when a WebGL canvas that
        // displayed a HARDWARE-decoded frame (4K AV1/HEVC etc.) is read back
        // via toDataURL — even with preserveDrawingBuffer — so the snapshot
        // saves empty. Detect that and fall back to the raw decoded VideoFrame
        // drawn onto a plain 2D canvas (GPU-readback-independent). Trade-off:
        // this frame has no burned-in subtitles, but a real frame beats a
        // black one.
        if (await this.isDataUrlBlank(dataUrl)) {
          const frame = this.player.getCurrentVideoFrame?.();
          if (frame) {
            try {
              const c = document.createElement("canvas");
              c.width = frame.displayWidth;
              c.height = frame.displayHeight;
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.drawImage(frame, 0, 0);
                dataUrl = c.toDataURL("image/png");
                Logger.info(TAG, "Snapshot: WebGL readback was blank, used decoded VideoFrame");
              }
            } catch (e) {
              Logger.warn(TAG, "VideoFrame snapshot fallback failed", e);
            }
          }
        }
      } else if (this.video && this.video.style.display !== "none") {
        // If in video mode, draw video to a temporary canvas
        const canvas = document.createElement("canvas");
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL("image/png");
        }
      }

      if (dataUrl) {
        const link = document.createElement("a");
        // Format timestamp for filename
        const time = this.currentTime;
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const seconds = Math.floor(time % 60);
        const timeStr = `${hours > 0 ? hours + "-" : ""}${minutes.toString().padStart(2, "0")}-${seconds.toString().padStart(2, "0")}`;

        link.download = `snapshot-${timeStr}.png`;
        link.href = dataUrl;
        link.click();

        Logger.info(TAG, "Snapshot taken and download triggered");
      } else {
        Logger.warn(TAG, "Failed to capture snapshot: No valid source found");
        // Could show a toast message here
      }
    } catch (e) {
      Logger.error(TAG, "Error taking snapshot", e);
    }
  }

  /**
   * Decode a data-URL into a small sampling canvas and report whether every
   * pixel is (near-)black — i.e. the capture came out empty. Used to detect a
   * failed WebGL readback so takeSnapshot can fall back to the raw VideoFrame.
   */
  private isDataUrlBlank(dataUrl: string | null): Promise<boolean> {
    return new Promise((resolve) => {
      if (!dataUrl || dataUrl.length < 32) return resolve(true);
      const img = new Image();
      img.onload = () => {
        try {
          const w = 32;
          const h = 18;
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(false); // can't sample — trust the capture
          ctx.drawImage(img, 0, 0, w, h);
          const d = ctx.getImageData(0, 0, w, h).data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i] > 8 || d[i + 1] > 8 || d[i + 2] > 8) return resolve(false);
          }
          resolve(true); // every sampled pixel is essentially black
        } catch {
          resolve(false); // decode/read failed — don't force the fallback
        }
      };
      img.onerror = () => resolve(true);
      img.src = dataUrl;
    });
  }

  /**
   * Final safety net for context-menu placement. Whatever a path computed
   * (strip-mode position:fixed, host-relative absolute, …), the host's
   * `contain` re-anchors fixed/absolute to the host box — so a clamp done in
   * window coordinates can still leave the menu spilling off the real viewport
   * (seen in audio-strip mode on touch). Re-measure the ACTUAL rect and nudge
   * left/top by the overflow. Translation isn't affected by the containing
   * block, so this works regardless. The mobile drawer is a deliberate
   * right-edge panel — skip it.
   */
  /**
   * Below ~290px even the always-visible right cluster (more · fullscreen)
   * crowds the bar, so fold the fullscreen button into the collapsible
   * expandable too — leaving only the "more" (>) toggle outside, with
   * fullscreen reachable (and horizontally scrollable) once expanded. Restored
   * to its normal slot (last child of the right cluster, after the more button)
   * once there's room again. Idempotent: only moves when out of place, so it
   * survives repeated resize ticks without thrashing the DOM.
   */
  private syncTinyLayout(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const fsBtn = root.querySelector(".movi-fullscreen-btn");
    const expandable = root.querySelector(".movi-mobile-expandable");
    const right = root.querySelector(".movi-controls-right");
    if (!fsBtn || !expandable || !right) return;
    const tiny = this.clientWidth > 0 && this.clientWidth < 290;
    if (tiny) {
      if (expandable.lastElementChild !== fsBtn) expandable.appendChild(fsBtn);
    } else if (right.lastElementChild !== fsBtn) {
      right.appendChild(fsBtn);
    }
  }

  /**
   * A body-level shadow-DOM portal for the desktop context menu. Moving the
   * menu here lets it escape any overflow:hidden / clipping ancestor of the
   * player (page wrappers, cards, `body{overflow-x:hidden}`) — the player's own
   * shadow keeps `container-type` for its @container queries, which makes it a
   * containing block for fixed descendants, so a menu that stays inside can't
   * break out. The portal clones the player's shadow styles so the menu looks
   * identical, and carries over any inline theme custom-properties.
   */
  private ensureMenuPortal(): ShadowRoot | null {
    if (this._menuPortalRoot) return this._menuPortalRoot;
    if (typeof document === "undefined" || !document.body) return null;
    const host = document.createElement("div");
    host.setAttribute("data-movi-menu-portal", "");
    // Plain fixed box at the origin. The cloned player styles below carry the
    // player's own `:host { overflow:hidden; contain:paint; container-type:...;
    // width:100% }` rules, which would apply to THIS host and clip the menu to
    // a 0×0 box / re-anchor its fixed positioning — so hard-override them inline
    // (inline beats the non-important :host rules). NO contain/container-type,
    // so a fixed-positioned menu inside is viewport-relative and clipped by
    // nothing.
    host.style.cssText =
      "position:fixed !important;top:0 !important;left:0 !important;" +
      "width:0 !important;height:0 !important;overflow:visible !important;" +
      "contain:none !important;container-type:normal !important;" +
      "background:none !important;border-radius:0 !important;" +
      "z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    for (const s of Array.from(
      this.shadowRoot?.querySelectorAll("style") || [],
    )) {
      root.appendChild(s.cloneNode(true));
    }
    document.body.appendChild(host);
    this._menuPortalHost = host;
    this._menuPortalRoot = root;
    return root;
  }

  // Submenu panels (Speed / Fit / Audio / Subtitle / Audio-output) are
  // shadow-root SIBLINGS of the menu, not children — they must travel to the
  // portal with it, or they'd stay behind and open detached from the menu.
  private _portaledSubs: Element[] = [];

  /** Move the context menu (+ its submenu panels) into the body portal and mirror theme vars. */
  private portalContextMenu(menu: HTMLElement): void {
    const root = this.ensureMenuPortal();
    if (!root) return;
    if (menu.parentNode !== root) {
      this._menuHome = menu.parentNode;
      this._portaledSubs = this.shadowRoot
        ? Array.from(
            this.shadowRoot.querySelectorAll(
              ".movi-context-menu-submenu, .movi-context-menu-submenu-audio, .movi-context-menu-submenu-subtitle, .movi-context-menu-submenu-audiodevice",
            ),
          )
        : [];
      root.appendChild(menu);
      for (const sub of this._portaledSubs) root.appendChild(sub);
    }
    // Carry over inline theme overrides (e.g. themecolor -> --movi-primary) so
    // the portaled menu matches; the cloned styles supply the defaults.
    const hostStyle = this._menuPortalHost?.style;
    if (hostStyle) {
      for (const prop of Array.from(this.style)) {
        if (prop.startsWith("--movi")) {
          hostStyle.setProperty(prop, this.style.getPropertyValue(prop));
        }
      }
    }
  }

  /** Return the context menu (+ submenus) from the portal to the shadow root. */
  private unportalContextMenu(menu: HTMLElement): void {
    if (!this._menuHome) return;
    if (menu.parentNode !== this._menuHome) this._menuHome.appendChild(menu);
    for (const sub of this._portaledSubs) {
      if (sub.parentNode !== this._menuHome) this._menuHome.appendChild(sub);
    }
    this._portaledSubs = [];
  }

  private clampMenuToViewport(menu: HTMLElement): void {
    if (menu.classList.contains("movi-context-menu-mobile")) return;
    const m = 8;
    const r = menu.getBoundingClientRect();
    if (r.width === 0) return;
    const curLeft = parseFloat(menu.style.left) || 0;
    const curTop = parseFloat(menu.style.top) || 0;
    let dx = 0;
    let dy = 0;
    if (r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right;
    if (r.left + dx < m) dx = m - r.left;
    if (r.bottom > window.innerHeight - m) dy = window.innerHeight - m - r.bottom;
    if (r.top + dy < m) dy = m - r.top;
    if (dx) menu.style.left = `${curLeft + dx}px`;
    if (dy) menu.style.top = `${curTop + dy}px`;
  }

  private updateHDRVisibility(): void {
    if (!this.player) return;

    // Check for Chromium-based browser (Chrome, Edge, Opera, Brave, etc.)
    const isChromium = !!(window as any).chrome;

    // HDR only supported on Chromium with Canvas renderer
    const canSupportHDR = isChromium && this._renderer === "canvas";

    const isContentHDR = (this.player as any).isHDRSupported?.() || false;
    const shouldShow = canSupportHDR && isContentHDR;

    const hdrContainer = this.shadowRoot?.querySelector(
      ".movi-hdr-container",
    ) as HTMLElement;
    const hdrMenuItem = this.shadowRoot?.querySelector(
      '.movi-context-menu-item[data-action="hdr-toggle"]',
    ) as HTMLElement;

    const hdrDivider = this.shadowRoot?.querySelector(
      ".movi-hdr-divider",
    ) as HTMLElement;

    if (shouldShow) {
      if (hdrContainer) hdrContainer.style.display = "flex";
      if (hdrMenuItem) hdrMenuItem.style.display = "flex";
      if (hdrDivider) hdrDivider.style.display = "block";

      // Show the HDR button when HDR content is detected
      const hdrBtn = this.shadowRoot?.querySelector(
        ".movi-hdr-btn",
      ) as HTMLElement;
      if (hdrBtn) hdrBtn.style.display = "flex";

      // Ensure UI reflects the active state now that it's visible
      this.updateHDRUI();
    } else {
      if (hdrContainer) hdrContainer.style.display = "none";
      if (hdrMenuItem) hdrMenuItem.style.display = "none";
      if (hdrDivider) hdrDivider.style.display = "none";

      // Hide the HDR button when no HDR content
      const hdrBtn = this.shadowRoot?.querySelector(
        ".movi-hdr-btn",
      ) as HTMLElement;
      if (hdrBtn) hdrBtn.style.display = "none";
    }

    Logger.debug(
      TAG,
      `HDR Visibility updated. Show: ${shouldShow} (Content HDR: ${isContentHDR}, Chromium: ${isChromium}, Renderer: ${this._renderer})`,
    );
  }

  private updateFastSeek() {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const seekButtons = shadowRoot.querySelectorAll(
      ".movi-seek-backward, .movi-seek-forward",
    );
    seekButtons.forEach((btn) => {
      (btn as HTMLElement).style.display = this._fastSeek ? "" : "none";
    });
  }
}

// Register the custom element
// Note: Custom element names must contain a hyphen per HTML spec
if (
  typeof customElements !== "undefined" &&
  !customElements.get("movi-player")
) {
  customElements.define("movi-player", MoviElement);
}
