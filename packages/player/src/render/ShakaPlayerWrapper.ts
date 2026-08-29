import shaka from "shaka-player/dist/shaka-player.compiled";
import { EventEmitter } from "../events/EventEmitter";
import {
  PlayerEventMap,
  PlayerState,
  PlayerConfig,
  Track,
  VideoTrack,
  AudioTrack,
  SubtitleTrack,
} from "../types";
import { CanvasRenderer } from "./CanvasRenderer";
import { TrackManager } from "../core/TrackManager";
import { Logger } from "../utils/Logger";

const TAG = "ShakaPlayerWrapper";

/**
 * Unified adaptive-streaming wrapper backed by Shaka Player. Replaces the old
 * hls.js (HLSPlayerWrapper) and dash.js (DASHPlayerWrapper) pair — Shaka plays
 * BOTH HLS (.m3u8) and DASH (.mpd) through one engine, and unlike dash.js it
 * also handles multiplexed DASH (one Representation carrying audio+video, e.g.
 * GPAC output) natively with fast start + seek, so the FFmpeg muxed-DASH
 * fallback is no longer needed.
 *
 * Like the wrappers it replaces, Shaka attaches to a hidden <video> element
 * (MSE under the hood) and we draw its frames to the shared canvas via
 * requestVideoFrameCallback. Everything that touches the <video> element is
 * engine-agnostic; only manifest load, track listing/switching, DRM and stats
 * are Shaka-specific.
 */

// Shaka's compiled bundle ships its own d.ts but the variant/track shapes are
// looser than we need here; treat individual track objects as `any` and lean on
// the documented field names (videoId/audioId/videoBandwidth/etc.).
type ShakaTrack = any;

export class ShakaPlayerWrapper extends EventEmitter<PlayerEventMap> {
  private config: PlayerConfig;
  private player: any = null; // shaka.Player
  private videoElement: HTMLVideoElement;
  private canvasRenderer: CanvasRenderer | null = null;
  private state: PlayerState = "idle";
  public trackManager: TrackManager;
  private frameCallbackId: number | null = null;
  private _framesRendered: number = 0;

  // All Shaka variant tracks for the loaded manifest, plus the per-type
  // representative arrays whose array index === the Track.id we hand the
  // TrackManager (video id -1 is Auto/ABR, subtitle id null is "off").
  private variants: ShakaTrack[] = [];
  private videoRenditions: ShakaTrack[] = []; // distinct video qualities
  private audioRenditions: ShakaTrack[] = []; // distinct audio tracks
  private textTracks: ShakaTrack[] = [];

  // Image/thumbnail track for seek-bar previews (DASH-IF tiled thumbnails or
  // HLS image playlists). null when the manifest carries no thumbnail track.
  private imageTrackId: number | null = null;
  // Decoded sprite sheets keyed by URI — adjacent hover positions usually live
  // in the same sheet, so this avoids re-fetching/decoding it on every move.
  private spriteCache = new Map<string, Promise<ImageBitmap | null>>();

  // Overlay element Shaka renders subtitle/caption cues into (canvas mode),
  // plus the injected <style> that positions Shaka's inner text container.
  private textContainer: HTMLDivElement | null = null;
  private textStyle: HTMLStyleElement | null = null;

  // True once load() has succeeded. While false, a Shaka error is NOT surfaced
  // to the player — load() rejects instead, letting the caller try a fallback
  // engine (hls.js/dash.js) without flashing an error overlay first.
  private _loaded = false;

  constructor(config: PlayerConfig) {
    super();
    this.config = config;
    this.trackManager = new TrackManager();

    this.videoElement = document.createElement("video");
    this.videoElement.crossOrigin = "anonymous";
    this.videoElement.playsInline = true;
    this.videoElement.style.display = "none"; // Hidden; canvas renderer draws frames

    // Preserve pitch when changing playback speed
    (this.videoElement as any).preservesPitch = true;
    (this.videoElement as any).mozPreservesPitch = true; // Firefox
    (this.videoElement as any).webkitPreservesPitch = true; // Safari/older Chrome

    // DRM mode: use native video element directly (no canvas) — canvas can't
    // access DRM-protected frames (browser blocks VideoFrame copy).
    // LCEVC mode: Shaka composites the enhanced frames onto the canvas itself
    // (via attachCanvas), so our rVFC→CanvasRenderer path stays out of the way.
    if (!config.drm && !config.lcevc && config.renderer === "canvas" && config.canvas) {
      this.canvasRenderer = new CanvasRenderer(config.canvas);
    }

    this.setupEventHandlers();
    this.setupTrackSwitching();
  }

  // --- Track switching: mirror selections from the TrackManager onto Shaka. ---
  private setupTrackSwitching(): void {
    this.trackManager.on("videoTrackChange", (track: VideoTrack | null) => {
      if (!this.player) return;
      const id = track ? track.id : -1;

      // Auto (-1) → enable ABR.
      if (id === -1) {
        this.player.configure({ abr: { enabled: true } });
        Logger.info(TAG, "Switched to Auto Quality (ABR)");
        return;
      }

      const target = this.videoRenditions[id];
      if (!target) return;

      // Manual selection: pin ABR off, then switch to a variant carrying the
      // chosen video rendition while keeping the active audio. clearBuffer on
      // (paused) gives an immediate switch; smooth (next-segment) while playing.
      this.player.configure({ abr: { enabled: false } });
      const active = this.activeVariant() ?? target;
      const pick =
        this.variants.find(
          (v) => v.videoId === target.videoId && v.audioId === active.audioId,
        ) || target;
      this.player.selectVariantTrack(pick, this.state !== "playing");
      Logger.info(TAG, `Requesting video rendition ${target.height}p`);
    });

    this.trackManager.on("audioTrackChange", (track: AudioTrack | null) => {
      if (!this.player || !track) return;
      const target = this.audioRenditions[track.id];
      if (!target) return;
      // selectAudioLanguage swaps audio while leaving video ABR intact;
      // selectVariantTrack would pin the whole variant and fight the ABR
      // manager (console warning + possible override). Disambiguate same-
      // language tracks by channel count / label where available.
      this.player.selectAudioLanguage(
        target.language || "",
        target.roles?.[0],
        target.channelsCount || undefined,
        undefined,
        undefined,
        undefined,
        target.label || undefined,
      );
      Logger.info(
        TAG,
        `Selected audio track ${track.id} (${target.language || target.label || ""})`,
      );
    });

    this.trackManager.on("subtitleTrackChange", (track: SubtitleTrack | null) => {
      if (!this.player) return;
      if (!track) {
        this.player.setTextTrackVisibility(false);
        Logger.info(TAG, "Subtitles disabled");
        return;
      }
      const t = this.textTracks[track.id];
      if (!t) {
        this.player.setTextTrackVisibility(false);
        return;
      }
      this.player.selectTextTrack(t);
      this.player.setTextTrackVisibility(true);
      Logger.info(TAG, `Selected subtitle track ${track.id} (${track.language || track.label || ""})`);
    });
  }

  private activeVariant(): ShakaTrack | null {
    return this.variants.find((v) => v.active) ?? null;
  }

  /**
   * Map a Shaka error to a plain, user-facing message. The technical code and
   * category are logged for developers but never surfaced in the UI — viewers
   * see why playback failed in everyday language, not "Shaka … (code 6012)".
   * Categories follow shaka.util.Error.Category (thousands digit of the code).
   */
  private friendlyMessage(e: any): string {
    const category =
      typeof e?.category === "number"
        ? e.category
        : typeof e?.code === "number"
          ? Math.floor(e.code / 1000)
          : 0;
    switch (category) {
      case 1: { // NETWORK
        // Not every network failure is the viewer's connection. Shaka splits
        // this category by code: BAD_HTTP_STATUS (1001) means the server DID
        // answer, with an error status (403/404/5xx) — blaming the user's wifi
        // is wrong and unactionable. HTTP_ERROR (1002) / TIMEOUT (1003) are the
        // genuine "request never landed" cases. Surface the real reason.
        const code = typeof e?.code === "number" ? e.code : 0;
        // BAD_HTTP_STATUS data: [uri, httpStatus, responseText, headers, type]
        const status =
          code === 1001 && Array.isArray(e?.data) ? Number(e.data[1]) || 0 : 0;
        if (status === 401 || status === 403)
          return `Access to this video was denied (HTTP ${status}). The link may have expired or be restricted.`;
        if (status === 404 || status === 410)
          return "This video could not be found. The link may be broken or removed.";
        if (status === 429)
          return "The video server is rate-limiting requests. Please wait a moment and try again.";
        if (status >= 500)
          return `The video server had a problem (HTTP ${status}). Please try again later.`;
        if (status > 0)
          return `The video server rejected the request (HTTP ${status}).`;
        if (code === 1003) // TIMEOUT
          return "The video took too long to load. Check your connection and try again.";
        // HTTP_ERROR / CORS / offline — the request never reached the server.
        return "Couldn't load the video. Check your internet connection and try again.";
      }
      case 3: // MEDIA
        return "This video can't be played on this device.";
      case 4: // MANIFEST
        return "This video is unavailable or in an unsupported format.";
      case 5: // STREAMING
        return "Playback was interrupted. Please try again.";
      case 6: // DRM
        return "This video is protected and can't be played here.";
      case 7: // PLAYER
        return "Couldn't start the video. Please try again.";
      default:
        return "Something went wrong while loading the video.";
    }
  }

  private setupEventHandlers(): void {
    this.videoElement.addEventListener("play", () => this.setState("playing"));
    this.videoElement.addEventListener("playing", () =>
      this.setState("playing"),
    );
    this.videoElement.addEventListener("pause", () => {
      if (this.state !== "ended") this.setState("paused");
    });
    this.videoElement.addEventListener("ended", () => this.setState("ended"));
    this.videoElement.addEventListener("seeking", () =>
      this.setState("seeking"),
    );
    this.videoElement.addEventListener("seeked", () => {
      if (this.videoElement.paused) this.setState("paused");
      else this.setState("playing");
    });
    this.videoElement.addEventListener("waiting", () =>
      this.setState("buffering"),
    );
    this.videoElement.addEventListener("timeupdate", () => {
      this.emit("timeUpdate", this.videoElement.currentTime);
    });
    this.videoElement.addEventListener("durationchange", () => {
      this.emit("durationChange", this.videoElement.duration);
    });
    this.videoElement.addEventListener("error", (_e) => {
      const error = this.videoElement.error;
      this.emit("error", new Error(error?.message || "Video element error"));
      this.setState("error");
    });
  }

  private setState(newState: PlayerState) {
    if (this.state !== newState) {
      this.state = newState;
      this.emit("stateChange", newState);

      if (newState === "playing" && this.canvasRenderer) {
        this.startFrameLoop();
      } else if (newState !== "seeking" && newState !== "buffering") {
        if (
          newState === "paused" ||
          newState === "ended" ||
          newState === "error" ||
          newState === "idle"
        ) {
          this.stopFrameLoop();
        }
      }
    }
  }

  private startFrameLoop() {
    if (this.frameCallbackId !== null) return;

    this.frameCallbackId = this.videoElement.requestVideoFrameCallback(
      (_now, _metadata) => {
        this.renderFrame();

        this.frameCallbackId = null;
        if (
          this.state === "playing" ||
          this.state === "seeking" ||
          this.state === "buffering"
        ) {
          this.startFrameLoop();
        }
      },
    );
  }

  private stopFrameLoop() {
    if (this.frameCallbackId !== null) {
      this.videoElement.cancelVideoFrameCallback(this.frameCallbackId);
      this.frameCallbackId = null;
    }
  }

  private renderFrame() {
    if (!this.canvasRenderer) return;

    try {
      const frame = new VideoFrame(this.videoElement);
      this.canvasRenderer.render(frame);
      frame.close();
      this._framesRendered++;
    } catch (e) {
      Logger.warn(TAG, "Failed to create VideoFrame", e);
    }
  }

  /**
   * Ensure the external LCEVC decoder library (lcevc_dec.js) is present. Returns
   * true if the global `LCEVCdec` is available — lazy-loading it from `url` when
   * given. The library is proprietary (V-Nova) and not bundled, so LCEVC is
   * opt-in and degrades gracefully to base-layer playback when it's missing.
   */
  private async ensureLcevcLib(url?: string): Promise<boolean> {
    const present = () =>
      !!((window as any).LCEVCdec || (window as any).libDPIModule);
    if (present()) return true;
    if (!url) return false;
    try {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(s);
      });
    } catch (e) {
      Logger.warn(TAG, "LCEVC decoder library load failed", e);
      return false;
    }
    return present();
  }

  async load(): Promise<void> {
    this.setState("loading");
    this.emit("loadStart", undefined);

    const source = this.config.source;
    const url = source && source.type === "url" ? source.url : null;
    if (!url) {
      throw new Error("Shaka source must be a URL");
    }

    if (!shaka.Player.isBrowserSupported()) {
      // Throw only — let the caller try the hls.js/dash.js fallback before any
      // error surfaces.
      throw new Error("Adaptive streaming not supported in this browser");
    }

    shaka.polyfill.installAll();
    this.player = new shaka.Player();
    await this.player.attach(this.videoElement);

    // Lenient manifest parsing to match dash.js / real-world streams: skip
    // empty AdaptationSets instead of failing the whole load (Shaka error
    // 4003 DASH_EMPTY_ADAPTATION_SET), and don't choke on quirky timing
    // attributes. dash.js ignores these; Shaka is strict by default.
    this.player.configure({
      manifest: {
        dash: {
          ignoreEmptyAdaptationSet: true,
          ignoreMinBufferTime: true,
          ignoreSuggestedPresentationDelay: true,
        },
      },
    });

    // Render subtitle/caption (and IMSC image) cues over the canvas. In canvas
    // mode the <video> is hidden and the canvas is a direct shadow-root child
    // (so canvas.parentElement is null), so we create a dedicated absolutely-
    // positioned overlay as a sibling of the canvas. NOTE: setVideoContainer()
    // alone does NOT wire a displayer in the lib build — an explicit
    // textDisplayFactory → UITextDisplayer is required for cues to actually
    // paint into the overlay (verified empirically).
    try {
      const sibling =
        this.config.canvas instanceof HTMLCanvasElement
          ? this.config.canvas
          : this.videoElement;
      const root = sibling.parentNode; // ShadowRoot or element — appendable
      if (root) {
        const tc = document.createElement("div");
        tc.className = "movi-shaka-text-container";
        tc.style.position = "absolute";
        tc.style.inset = "0";
        tc.style.pointerEvents = "none";
        tc.style.zIndex = "2"; // above the canvas, below the controls bar
        root.appendChild(tc);
        this.textContainer = tc;

        // The lib build ships NO Shaka UI CSS, so Shaka's `.shaka-text-container`
        // would collapse to the top of the overlay (static, content-height) and
        // the cues render up by the title bar — looking like "no subtitles".
        // Inject minimal positioning so it fills the overlay and sits at the
        // bottom, with room to clear the controls bar.
        const style = document.createElement("style");
        style.textContent =
          ".movi-shaka-text-container .shaka-text-container{" +
          "position:absolute!important;inset:0!important;" +
          "box-sizing:border-box!important;padding-bottom:max(48px,8%)!important;}" +
          // Match the player's own subtitle size: same formula as
          // .movi-subtitle-line, so cues track the size setting
          // (--movi-sub-size-mult) and scale with the player width.
          // !important overrides Shaka's small inline default.
          ".movi-shaka-text-container .shaka-text-container div," +
          ".movi-shaka-text-container .shaka-text-container span{" +
          "font-size:calc(clamp(20px,calc(var(--movi-player-width,100vw)*0.032),40px)" +
          "*var(--movi-sub-size-mult,1))!important;line-height:1.3!important;}";
        root.appendChild(style);
        this.textStyle = style;

        const video = this.videoElement;
        this.player.configure(
          "textDisplayFactory",
          () => new (shaka as any).text.UITextDisplayer(video, tc),
        );
      }
    } catch (e) {
      Logger.warn(TAG, "Could not set up Shaka text display", e);
    }

    // DRM: Shaka manages EME natively — point it at the license server(s).
    if (this.config.drm && this.config.licenseUrl) {
      Logger.info(TAG, "DRM mode enabled — using native video element (no canvas)");
      this.player.configure({
        drm: {
          servers: {
            "com.widevine.alpha": this.config.licenseUrl,
            "com.microsoft.playready": this.config.licenseUrl,
            "com.apple.fps": this.config.licenseUrl,
          },
        },
      });
      if (this.config.licenseHeaders) {
        const headers = this.config.licenseHeaders;
        this.player
          .getNetworkingEngine()
          ?.registerRequestFilter((type: any, request: any) => {
            if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
              Object.assign(request.headers, headers);
            }
          });
      }
    }

    // Custom media headers: applied to EVERY outbound request Shaka makes —
    // manifest, segments, init segments, timing, etc. (the "network media flow"
    // the caller asked about). Registered unconditionally (independent of DRM)
    // so auth tokens / signed headers reach the .mpd/.m3u8 and its segments.
    // License headers above stack on top for LICENSE requests.
    if (this.config.headers) {
      const mediaHeaders = this.config.headers;
      this.player
        .getNetworkingEngine()
        ?.registerRequestFilter((_type: any, request: any) => {
          Object.assign(request.headers, mediaHeaders);
        });
    }

    // Surface Shaka errors. load() rejects on a fatal load error; later
    // (post-load) errors arrive via this event without rejecting.
    this.player.addEventListener("error", (event: any) => {
      const detail = event?.detail;
      // Log the technical detail for developers; surface plain text to viewers.
      Logger.error(
        TAG,
        `Shaka runtime error (code ${detail?.code}, category ${detail?.category})`,
        detail?.data,
      );
      // Pre-load errors are handled by load()'s rejection + the caller's
      // fallback — don't surface them (would flash an error before recovery).
      if (!this._loaded) return;
      this.emit("error", new Error(this.friendlyMessage(detail)));
      this.setState("error");
    });

    // MPEG-5 Part 2 LCEVC: enable Shaka's enhancement-layer decoding. The
    // actual decoder is the external lcevc_dec.js library (proprietary, not
    // bundled); Shaka composites the enhanced output onto the attached canvas.
    if (this.config.lcevc) {
      const ready = await this.ensureLcevcLib(this.config.lcevcUrl);
      if (ready) {
        const c = this.config.canvas;
        if (c instanceof HTMLCanvasElement) this.player.attachCanvas(c);
        this.player.configure({ lcevc: { enabled: true } });
        Logger.info(TAG, "LCEVC decoding enabled");
      } else {
        Logger.warn(
          TAG,
          "LCEVC requested but the lcevc_dec.js decoder library is unavailable — playing the base layer only",
        );
      }
    }

    // ABR adaptation / manual variant change swaps the active rendition without
    // changing the track list — re-fire tracksChange so the gear-badge UI in
    // MoviElement repaints against the new height.
    const repaint = () =>
      this.trackManager.emit("tracksChange", this.trackManager.getTracks());
    this.player.addEventListener("adaptation", repaint);
    this.player.addEventListener("variantchanged", repaint);

    try {
      await this.player.load(url);
    } catch (e: any) {
      // Log for developers, but DON'T emit/setState here — just throw. The
      // caller (MoviPlayer) tries hls.js/dash.js/FFmpeg fallbacks and only
      // surfaces an error if they all fail, so a recoverable Shaka failure
      // never flashes an error overlay. The friendly message rides on the
      // thrown error for the no-fallback case.
      Logger.error(
        TAG,
        `Shaka load failed${typeof e?.code === "number" ? ` (code ${e.code}, category ${e.category})` : ""}`,
        e,
      );
      throw new Error(this.friendlyMessage(e));
    }

    this._loaded = true;
    const count = this.updateTracks();
    Logger.info(
      TAG,
      `Manifest parsed (${url.includes(".m3u8") ? "HLS" : "DASH"}). ${count} video renditions, ${this.audioRenditions.length} audio, ${this.textTracks.length} text`,
    );
    // Apply audio-only data-saver if requested at load time.
    if (this.config.audioOnly) this.setAudioOnly(true);

    this.setState("ready");
    this.emit("loadEnd", undefined);
  }

  /**
   * Audio-only (data-saver) mode. Picks a true audio-only variant when the
   * manifest exposes one (zero video bandwidth); otherwise pins the SMALLEST
   * video rendition (most of the saving without breaking a stream whose audio
   * is only muxed with video). ABR is disabled so it doesn't climb back up.
   * Toggling off re-enables ABR. NOT done via manifest.disableVideo — that
   * fails (Shaka 4032) on HLS streams with no separate audio-only variant.
   */
  setAudioOnly(enabled: boolean): void {
    if (!this.player) return;
    try {
      if (!enabled) {
        this.player.configure({ abr: { enabled: true } });
        Logger.info(TAG, "Audio-only off — ABR re-enabled");
        return;
      }
      const variants: any[] = this.player.getVariantTracks() ?? [];
      if (!variants.length) return;
      this.player.configure({ abr: { enabled: false } });
      const audioOnly = variants.filter((v) => !v.videoCodec && !v.height);
      const pick = audioOnly.length
        ? audioOnly[0]
        : variants
            .slice()
            .sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0];
      if (pick) {
        this.player.selectVariantTrack(pick, true);
        Logger.info(
          TAG,
          audioOnly.length
            ? "Audio-only mode — selected audio-only variant"
            : `Audio-only mode — no audio-only variant; pinned smallest video (${pick.height || "?"}p)`,
        );
      }
    } catch (e) {
      Logger.warn(TAG, "setAudioOnly failed", e);
    }
  }

  /** Build the video/audio/subtitle track lists from Shaka's manifest. */
  private updateTracks(): number {
    if (!this.player) return 0;
    this.variants = this.player.getVariantTracks() ?? [];
    this.textTracks = this.player.getTextTracks() ?? [];

    // Thumbnail track (highest-res image AdaptationSet / image playlist).
    const imageTracks = this.player.getImageTracks?.() ?? [];
    this.imageTrackId = imageTracks.length
      ? imageTracks.reduce((a: any, b: any) =>
          (b.height || 0) > (a.height || 0) ? b : a,
        ).id
      : null;

    // --- Distinct video renditions (by videoId; fall back to dimensions). ---
    // Skip audio-only variants (no video component) so an audio-only stream
    // doesn't surface a phantom video rendition — that would make the player
    // think it has video and suppress the audio-strip layout.
    const seenVideo = new Map<string, ShakaTrack>();
    for (const v of this.variants) {
      const hasVideo = v.videoId != null || (v.width || 0) > 0;
      if (!hasVideo) continue;
      const key =
        v.videoId != null
          ? `v${v.videoId}`
          : `${v.width}x${v.height}@${v.videoBandwidth ?? v.bandwidth}`;
      if (!seenVideo.has(key)) seenVideo.set(key, v);
    }
    this.videoRenditions = [...seenVideo.values()].sort(
      (a, b) =>
        (a.height || 0) - (b.height || 0) ||
        (a.bandwidth || 0) - (b.bandwidth || 0),
    );

    // --- Distinct audio tracks (by audioId; fall back to language/label). ---
    const seenAudio = new Map<string, ShakaTrack>();
    for (const v of this.variants) {
      const key =
        v.audioId != null
          ? `a${v.audioId}`
          : `${v.language || ""}/${v.label || ""}/${v.channelsCount || ""}`;
      if (!seenAudio.has(key)) seenAudio.set(key, v);
    }
    this.audioRenditions = [...seenAudio.values()];

    const tracks: Track[] = [];

    // Video tracks — only for streams that actually carry video. Audio-only
    // streams push no video track (not even "Auto"), so the player reports no
    // active video track and switches to the audio-strip layout.
    if (this.videoRenditions.length > 0) {
      // Auto / ABR video track.
      tracks.push({
        id: -1,
        type: "video",
        codec: "auto",
        width: 0,
        height: 0,
        frameRate: 0,
        label: "Auto",
      } as VideoTrack);

      // Disambiguate same-resolution renditions with their bitrate.
      const heightCount = new Map<number, number>();
      this.videoRenditions.forEach((r) =>
        heightCount.set(r.height, (heightCount.get(r.height) || 0) + 1),
      );

      this.videoRenditions.forEach((r, index) => {
        const bitrate = r.videoBandwidth ?? r.bandwidth ?? 0;
        const hasDuplicates = (heightCount.get(r.height) || 0) > 1;
        const label = hasDuplicates
          ? `${r.height}p · ${(bitrate / 1000).toFixed(0)} kbps`
          : `${r.height}p`;
        tracks.push({
          id: index,
          type: "video",
          codec: r.videoCodec ?? "",
          bitRate: bitrate,
          width: r.width,
          height: r.height,
          frameRate: r.frameRate || 0,
          label,
        } as VideoTrack);
      });
    }

    // Audio tracks (only expose the menu if there's a real choice).
    if (this.audioRenditions.length > 1) {
      this.audioRenditions.forEach((a, index) => {
        const lang = a.language && a.language !== "und" ? a.language : "";
        const label =
          a.label ||
          [lang, a.channelsCount ? `${a.channelsCount}ch` : ""]
            .filter(Boolean)
            .join(" ") ||
          `Audio ${index + 1}`;
        tracks.push({
          id: index,
          type: "audio",
          codec: a.audioCodec ?? "",
          language: lang,
          label,
          channels: a.channelsCount || 0,
          sampleRate: a.audioSamplingRate || 0,
          bitRate: a.audioBandwidth ?? 0,
        } as AudioTrack);
      });
    }

    // Subtitle / text tracks. IMSC-1 image profile (codecs "…im1i") and other
    // bitmap captions are image subtitles; everything else (WebVTT, TTML text
    // profile "…im1t", CEA-608/708) is text.
    this.textTracks.forEach((t, index) => {
      const lang = t.language && t.language !== "und" ? t.language : "";
      const label = t.label || lang || `Subtitle ${index + 1}`;
      const codecs = (t.codecs || "").toLowerCase();
      const isImage =
        codecs.includes("im1i") ||
        codecs.includes("image") ||
        /image/i.test((t.roles || []).join(" "));
      tracks.push({
        id: index,
        type: "subtitle",
        codec: t.codecs ?? "",
        language: lang,
        label,
        subtitleType: isImage ? "image" : "text",
      } as SubtitleTrack);
    });

    this.trackManager.setTracks(tracks);
    if (this.videoRenditions.length > 0) {
      this.trackManager.selectVideoTrack(-1); // default Auto (video streams only)
    }

    this.sizeCanvasToTopRendition();
    return this.videoRenditions.length;
  }

  /** True for a live (dynamic) stream — drives the LIVE indicator UI. */
  isLive(): boolean {
    try {
      return !!this.player?.isLive?.();
    } catch {
      return false;
    }
  }

  /** True when the stream carries audio but no video (→ audio-strip layout). */
  isAudioOnly(): boolean {
    return this.videoRenditions.length === 0 && this.variants.length > 0;
  }

  /** Live edge time (seekable range end) — where "go live" jumps to. */
  getLiveEdge(): number {
    try {
      const range = this.player?.seekRange?.();
      return range ? range.end : this.videoElement.duration;
    } catch {
      return this.videoElement.duration;
    }
  }

  /** Start of the seekable (DVR) window — used to scale the live progress bar. */
  getSeekRangeStart(): number {
    try {
      const range = this.player?.seekRange?.();
      return range ? range.start : 0;
    } catch {
      return 0;
    }
  }

  /** Size the canvas from the highest rendition (or the <video> dims). */
  private sizeCanvasToTopRendition(): void {
    if (!this.canvasRenderer || this.videoRenditions.length === 0) return;
    const top = this.videoRenditions.reduce(
      (a, b) => ((b.height || 0) > (a.height || 0) ? b : a),
      this.videoRenditions[0],
    );
    const applyDims = (w: number, h: number) => {
      if (!this.canvasRenderer || w <= 0 || h <= 0) return;
      this.canvasRenderer.configure(w, h);
      const canvas = this.canvasRenderer.getCanvas();
      const parent = canvas instanceof HTMLCanvasElement ? canvas.parentElement : null;
      const cw = parent?.clientWidth || w;
      const ch = parent?.clientHeight || h;
      if (cw > 0 && ch > 0) this.canvasRenderer.resize(cw, ch);
    };

    if (top.width > 0 && top.height > 0) {
      applyDims(top.width, top.height);
    } else {
      const onMeta = () => {
        this.videoElement.removeEventListener("loadedmetadata", onMeta);
        applyDims(this.videoElement.videoWidth, this.videoElement.videoHeight);
      };
      if (this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
        applyDims(this.videoElement.videoWidth, this.videoElement.videoHeight);
      } else {
        this.videoElement.addEventListener("loadedmetadata", onMeta);
      }
    }
  }

  async play(): Promise<void> {
    await this.videoElement.play();
  }

  pause(): void {
    this.videoElement.pause();
  }

  async seek(time: number): Promise<void> {
    this.videoElement.currentTime = time;
  }

  getState(): PlayerState {
    return this.state;
  }

  getDuration(): number {
    return this.videoElement.duration;
  }

  getCurrentTime(): number {
    return this.videoElement.currentTime;
  }

  setVolume(volume: number): void {
    // HTMLMediaElement.volume only accepts [0,1]; boost (>1) is applied via the
    // AudioContext gain path, not the native element, so clamp here.
    this.videoElement.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean): void {
    this.videoElement.muted = muted;
  }

  setPlaybackRate(rate: number): void {
    this.videoElement.playbackRate = rate;
  }

  getVolume(): number {
    return this.videoElement.volume;
  }

  isMuted(): boolean {
    return this.videoElement.muted;
  }

  getPlaybackRate(): number {
    return this.videoElement.playbackRate;
  }

  setSubtitleOverlay(_element: HTMLElement): void {
    // No-op: Shaka renders cues itself into the text container created in
    // load() (see setVideoContainer), so the player's external overlay isn't
    // used for adaptive-stream subtitles.
  }

  setHDREnabled(enabled: boolean): void {
    if (this.canvasRenderer) {
      this.canvasRenderer.setHDREnabled(enabled);
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  getBufferEndTime(): number {
    if (this.videoElement.buffered.length) {
      return this.videoElement.buffered.end(
        this.videoElement.buffered.length - 1,
      );
    }
    return 0;
  }

  resizeCanvas(width: number, height: number): void {
    if (this.canvasRenderer) {
      this.canvasRenderer.resize(width, height);
    }
  }

  /** Active rendition dimensions for the gear-badge UI (used in Auto mode). */
  getActiveResolution(): { width: number; height: number } {
    // Use LIVE stats (the currently-playing rendition), not the cached variant
    // snapshot. In Auto/ABR the active rendition changes after load, so the
    // snapshot's `.active` flag goes stale and would keep reporting the wrong
    // (often top) height — making the gear badge show "HD" while a lower
    // rendition is actually playing.
    try {
      const s = this.player?.getStats?.();
      if (s?.width && s?.height) return { width: s.width, height: s.height };
    } catch {}
    // The hidden <video>'s decoded dimensions also reflect the current rendition.
    return {
      width: this.videoElement.videoWidth || 0,
      height: this.videoElement.videoHeight || 0,
    };
  }

  /** True when the manifest carries a thumbnail/image track for seek previews. */
  hasThumbnails(): boolean {
    return this.imageTrackId !== null;
  }

  /** Fetch + decode a sprite sheet once, cached by URI. */
  private loadSprite(uri: string): Promise<ImageBitmap | null> {
    let p = this.spriteCache.get(uri);
    if (!p) {
      p = (async () => {
        try {
          const res = await fetch(uri, { mode: "cors" });
          if (!res.ok) return null;
          return await createImageBitmap(await res.blob());
        } catch (e) {
          Logger.warn(TAG, "Thumbnail sprite fetch failed", e);
          return null;
        }
      })();
      this.spriteCache.set(uri, p);
    }
    return p;
  }

  /**
   * Seek-preview thumbnail for `time` as a JPEG Blob, or null if the manifest
   * has no thumbnail track. Shaka resolves which tile in the sprite sheet maps
   * to the time; we crop that tile out and hand back a Blob the existing
   * MoviElement preview <img> can show — same contract as getPreviewFrame.
   */
  async getThumbnailBlob(time: number): Promise<Blob | null> {
    if (!this.player || this.imageTrackId == null) return null;

    let thumb: any;
    try {
      thumb = await this.player.getThumbnails(this.imageTrackId, time);
    } catch (e) {
      Logger.warn(TAG, "getThumbnails failed", e);
      return null;
    }
    if (!thumb || !thumb.uris?.length) return null;

    const bitmap = await this.loadSprite(thumb.uris[0]);
    if (!bitmap) return null;

    const w = thumb.width || bitmap.width;
    const h = thumb.height || bitmap.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Crop the single tile (positionX/Y, width/height) out of the sheet.
    ctx.drawImage(
      bitmap,
      thumb.positionX || 0,
      thumb.positionY || 0,
      w,
      h,
      0,
      0,
      w,
      h,
    );
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
  }

  getVideoTracks(): VideoTrack[] {
    return this.trackManager
      .getTracks()
      .filter((t) => t.type === "video") as VideoTrack[];
  }

  selectVideoTrack(id: number): void {
    if (!this.player) return;
    // The trackManager event handler performs the Shaka switch.
    this.trackManager.selectVideoTrack(id);
  }

  getAudioTracks(): AudioTrack[] {
    return this.trackManager
      .getTracks()
      .filter((t) => t.type === "audio") as AudioTrack[];
  }

  selectAudioTrack(id: number): boolean {
    if (!this.player) return false;
    return this.trackManager.selectAudioTrack(id);
  }

  getSubtitleTracks(): SubtitleTrack[] {
    return this.trackManager
      .getTracks()
      .filter((t) => t.type === "subtitle") as SubtitleTrack[];
  }

  async selectSubtitleTrack(id: number | null): Promise<boolean> {
    if (!this.player) return false;
    return this.trackManager.selectSubtitleTrack(id);
  }

  setFitMode(mode: any) {
    if (this.canvasRenderer) {
      this.canvasRenderer.setFitMode(mode);
    } else {
      if (mode === "contain") this.videoElement.style.objectFit = "contain";
      else if (mode === "cover") this.videoElement.style.objectFit = "cover";
      else if (mode === "fill") this.videoElement.style.objectFit = "fill";
    }
  }

  getStats(): Record<string, string | number | boolean> {
    const stats: Record<string, string | number | boolean> = {};
    const s = this.player?.getStats?.();
    const active = this.activeVariant();
    const w = s?.width || active?.width || this.videoElement.videoWidth || 0;
    const h = s?.height || active?.height || this.videoElement.videoHeight || 0;

    // --- Video ---
    if (w && h) {
      stats["Video Codec"] = active?.videoCodec ?? "N/A";
      stats["Resolution"] = `${w}x${h}`;
      const eff = Math.max(h, Math.round((w * 9) / 16));
      stats["Quality"] =
        eff >= 8640 ? "16K" : eff >= 4320 ? "8K" : eff >= 2160 ? "4K" : eff >= 1440 ? "2K" : eff >= 1080 ? "1080p" : eff >= 720 ? "720p" : eff >= 480 ? "480p" : "SD";
      if (active?.frameRate) stats["Frame Rate"] = `${active.frameRate} fps`;
      const bitrate = active?.videoBandwidth ?? active?.bandwidth;
      stats["Video Bitrate"] = bitrate ? `${(bitrate / 1000).toFixed(0)} kbps` : "N/A";
    }
    if (active?.audioCodec) stats["Audio Codec"] = active.audioCodec;

    // --- Decoder / Renderer ---
    if (this.canvasRenderer) {
      const rStats = this.canvasRenderer.getStats();
      stats["Video Decoder"] = "Hardware (Native)";
      stats["Renderer"] = "Canvas";
      stats["Color Space"] = rStats.colorSpace || "N/A";
    } else {
      stats["Video Decoder"] = "Hardware (Native)";
      stats["Renderer"] = "HTML5 Video";
    }

    // --- Playback ---
    stats["Playback State"] = this.state;
    stats["Playback Rate"] = `${this.videoElement.playbackRate}x`;

    // --- Frames ---
    if (s) {
      if (typeof s.decodedFrames === "number") stats["Frames Decoded"] = s.decodedFrames;
      if (typeof s.droppedFrames === "number") stats["Frames Dropped"] = s.droppedFrames;
    }
    if (this.canvasRenderer) stats["Frames Rendered"] = this._framesRendered;

    // --- Buffer ---
    if (this.videoElement.buffered.length > 0) {
      const buffEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
      stats["Buffer Ahead"] = `${(buffEnd - this.videoElement.currentTime).toFixed(1)}s`;
    }

    // --- Stream specific ---
    if (this.videoRenditions.length > 1) {
      const abrOn = this.player?.getConfiguration?.()?.abr?.enabled !== false;
      const activeLabel = active ? `${active.height}p` : "N/A";
      stats["Quality Level"] = abrOn ? `Auto (${activeLabel})` : activeLabel;
      const heights = this.videoRenditions.map((r) => r.height);
      stats["Available Levels"] = `${this.videoRenditions.length} (${Math.min(...heights)}p–${Math.max(...heights)}p)`;
    }
    if (s?.estimatedBandwidth > 0) {
      stats["Bandwidth Estimate"] = `${(s.estimatedBandwidth / 1000).toFixed(0)} kbps`;
    }
    try {
      stats["Stream Type"] = this.player?.isLive?.() ? "Live" : "VOD";
    } catch {}

    // Memory usage (Chrome only)
    const mem = (performance as any).memory;
    if (mem) {
      stats["Memory Used"] = `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB`;
    }

    return stats;
  }

  getNetworkSpeed(): number {
    // Shaka estimatedBandwidth is in bits/s → bytes/s.
    const tp = this.player?.getStats?.()?.estimatedBandwidth;
    return tp && tp > 0 ? tp / 8 : 0;
  }

  isFileSource(): boolean {
    return false;
  }

  destroy(): void {
    this.stopFrameLoop();

    // Release cached thumbnail sprite sheets.
    for (const p of this.spriteCache.values()) {
      p.then((b) => b?.close()).catch(() => {});
    }
    this.spriteCache.clear();
    this.imageTrackId = null;

    if (this.player) {
      // shaka destroy is async; fire-and-forget (we drop the reference below).
      this.player.destroy().catch(() => {
        /* Shaka can throw if already torn down */
      });
      this.player = null;
    }

    if (this.textContainer?.parentNode) {
      this.textContainer.parentNode.removeChild(this.textContainer);
    }
    this.textContainer = null;
    if (this.textStyle?.parentNode) {
      this.textStyle.parentNode.removeChild(this.textStyle);
    }
    this.textStyle = null;

    this.videoElement.removeAttribute("src");
    this.videoElement.load();
    if (this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    this.removeAllListeners();
  }
}
