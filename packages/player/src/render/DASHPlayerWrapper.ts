import { MediaPlayer } from "dashjs";
import type { MediaPlayerClass, Representation } from "dashjs";
import { EventEmitter } from "../events/EventEmitter";
import {
  PlayerEventMap,
  PlayerState,
  PlayerConfig,
  Track,
  VideoTrack,
} from "../types";
import { CanvasRenderer } from "./CanvasRenderer";
import { TrackManager } from "../core/TrackManager";
import { Logger } from "../utils/Logger";

const TAG = "DASHPlayerWrapper";

/**
 * MPEG-DASH wrapper, mirroring HLSPlayerWrapper. dash.js attaches to a hidden
 * <video> element (MSE under the hood); we draw its frames to the shared canvas
 * via requestVideoFrameCallback, exactly like the HLS path. Only the streaming
 * bits — manifest load, quality/representation switching, stats — are dash.js
 * specific; everything that touches the <video> element is identical to HLS.
 */
export class DASHPlayerWrapper extends EventEmitter<PlayerEventMap> {
  private config: PlayerConfig;
  private dash: MediaPlayerClass | null = null;
  private videoElement: HTMLVideoElement;
  private canvasRenderer: CanvasRenderer | null = null;
  private state: PlayerState = "idle";
  public trackManager: TrackManager;
  private frameCallbackId: number | null = null;
  private _framesRendered: number = 0;
  // Representations from the manifest, indexed to match the VideoTrack ids we
  // hand the TrackManager (track id === array index; -1 is Auto/ABR).
  private representations: Representation[] = [];

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
    if (!config.drm && config.renderer === "canvas" && config.canvas) {
      this.canvasRenderer = new CanvasRenderer(config.canvas);
    }

    this.setupEventHandlers();

    // Drive dash.js quality from the TrackManager (mirrors HLS).
    this.trackManager.on("videoTrackChange", (track: VideoTrack | null) => {
      if (!this.dash) return;
      const id = track ? track.id : -1;

      // Auto (-1) → enable ABR.
      if (id === -1) {
        this.dash.updateSettings({
          streaming: { abr: { autoSwitchBitrate: { video: true } } },
        });
        Logger.info(TAG, "Switched to Auto Quality (ABR)");
        return;
      }

      const rep = this.representations[id];
      if (!rep) return;

      // Manual selection: pin ABR off, then switch. forceReplace flushes the
      // buffer for an immediate switch when paused; a smooth (next-segment)
      // switch while playing avoids a stall.
      this.dash.updateSettings({
        streaming: { abr: { autoSwitchBitrate: { video: false } } },
      });
      this.dash.setRepresentationForTypeById(
        "video",
        rep.id,
        this.state !== "playing",
      );
      Logger.info(TAG, `Requesting representation ${rep.id} (${rep.height}p)`);
    });
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

  async load(): Promise<void> {
    this.setState("loading");
    this.emit("loadStart", undefined);

    const source = this.config.source;
    const url = source && source.type === "url" ? source.url : null;
    if (!url) {
      throw new Error("DASH source must be a URL");
    }

    if (this.config.drm) {
      Logger.info(TAG, "DRM mode enabled — using native video element (no canvas)");
      if (this.config.licenseUrl) {
        this.setupEME(this.config.licenseUrl, this.config.licenseHeaders);
      }
    }

    this.dash = MediaPlayer().create();

    // Custom media headers on every request dash.js makes (manifest + segments).
    // Must be registered before initialize() so the manifest fetch carries them.
    const mediaHeaders = this.config.headers;
    if (mediaHeaders) {
      (this.dash as any).addRequestInterceptor((request: any) => {
        request.headers = { ...(request.headers || {}), ...mediaHeaders };
        return Promise.resolve(request);
      });
    }

    // autoplay=false — MoviPlayer/MoviElement decide when to play().
    this.dash.initialize(this.videoElement, url, false);

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      this.dash!.on(MediaPlayer.events.STREAM_INITIALIZED, () => {
        const count = this.updateTracks();
        Logger.info(TAG, `DASH manifest parsed. Found ${count} representations`);
        this.setState("ready");
        this.emit("loadEnd", undefined);
        settled = true;
        resolve();
      });

      // ABR / quality switches change the active rendition without changing
      // the track list — re-fire tracksChange so the gear-badge UI repaints.
      this.dash!.on(MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        this.trackManager.emit("tracksChange", this.trackManager.getTracks());
      });

      this.dash!.on(MediaPlayer.events.ERROR, (e: any) => {
        const detail =
          e?.error?.message ||
          (typeof e?.error === "string" ? e.error : e?.error?.code) ||
          "DASH playback error";
        Logger.error(TAG, `DASH error: ${detail}`);
        const err = new Error(String(detail));
        if (!settled) {
          // Pre-load failure: reject ONLY — don't emit. dash.js is a fallback
          // behind Shaka, so MoviPlayer is still working through the chain and
          // surfaces the final (correctly-classified) error itself. Emitting
          // here flashes the error overlay mid-fallback — and a manifest 403
          // gets misread as a decode failure, briefly showing an irrelevant
          // "Try Software Decoding" button. Mirrors ShakaPlayerWrapper, which
          // throws without emitting.
          settled = true;
          reject(err);
        } else {
          // Post-load runtime error — surface to listeners as usual.
          this.emit("error", err);
          this.setState("error");
        }
      });
    });
  }

  /** Build the quality track list from the manifest's video representations. */
  private updateTracks(): number {
    if (!this.dash) return 0;
    this.representations = this.dash.getRepresentationsByType("video") ?? [];
    const reps = this.representations;

    const tracks: Track[] = [];

    // Auto / ABR track.
    const autoTrack: VideoTrack = {
      id: -1,
      type: "video",
      codec: "auto",
      width: 0,
      height: 0,
      frameRate: 0,
      label: "Auto",
    };
    tracks.push(autoTrack);

    // Disambiguate same-resolution renditions with their bitrate.
    const heightCount = new Map<number, number>();
    reps.forEach((r) => heightCount.set(r.height, (heightCount.get(r.height) || 0) + 1));

    reps.forEach((r, index) => {
      const hasDuplicates = (heightCount.get(r.height) || 0) > 1;
      const label = hasDuplicates
        ? `${r.height}p · ${(r.bandwidth / 1000).toFixed(0)} kbps`
        : `${r.height}p`;

      const videoTrack: VideoTrack = {
        id: index,
        type: "video",
        codec: r.codecs ?? "",
        bitRate: r.bandwidth,
        width: r.width,
        height: r.height,
        frameRate: r.frameRate,
        label,
      };
      tracks.push(videoTrack);
    });

    this.trackManager.setTracks(tracks);
    this.trackManager.selectVideoTrack(-1); // default Auto

    if (this.canvasRenderer && reps.length > 0) {
      // Size the canvas from the highest rendition; fall back to the <video>
      // element's real dimensions if the manifest lacks width/height.
      const top = reps.reduce((a, b) => (b.height > a.height ? b : a), reps[0]);
      const applyDims = (w: number, h: number) => {
        if (!this.canvasRenderer || w <= 0 || h <= 0) return;
        this.canvasRenderer.configure(w, h);
        const canvas = this.canvasRenderer.getCanvas();
        const parent = canvas instanceof HTMLCanvasElement ? canvas.parentElement : null;
        const cw = parent?.clientWidth || w;
        const ch = parent?.clientHeight || h;
        if (cw > 0 && ch > 0) {
          this.canvasRenderer.resize(cw, ch);
        }
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

    return reps.length;
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
    // Pending
  }

  setHDREnabled(enabled: boolean): void {
    if (this.canvasRenderer) {
      this.canvasRenderer.setHDREnabled(enabled);
    }
  }

  /**
   * Setup Encrypted Media Extensions (EME) for Widevine/FairPlay DRM.
   * Identical to the HLS path — it operates on the <video> element, so DASH +
   * a license server URL works the same way.
   */
  private setupEME(licenseUrl: string, headers?: Record<string, string>): void {
    const video = this.videoElement;

    video.addEventListener("encrypted", async (event) => {
      Logger.info(TAG, `EME: encrypted event — initDataType=${event.initDataType}`);

      try {
        const config: MediaKeySystemConfiguration[] = [{
          initDataTypes: [event.initDataType],
          videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
          audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
        }];

        // Try key systems in order: Widevine, PlayReady (Edge), FairPlay (Safari).
        const keySystems = [
          "com.widevine.alpha",
          "com.microsoft.playready",
          "com.apple.fps.1_0",
        ];
        let keySystem = "";
        let access: MediaKeySystemAccess | null = null;
        for (const ks of keySystems) {
          try {
            access = await navigator.requestMediaKeySystemAccess(ks, config);
            keySystem = ks;
            break;
          } catch {
            /* not supported — try the next key system */
          }
        }
        if (!access) {
          throw new Error("No supported DRM key system (Widevine/PlayReady/FairPlay)");
        }

        Logger.info(TAG, `EME: Using ${keySystem}`);
        const keys = await access.createMediaKeys();
        await video.setMediaKeys(keys);

        const session = keys.createSession();
        session.addEventListener("message", async (e) => {
          const response = await fetch(licenseUrl, {
            method: "POST",
            body: e.message,
            headers: {
              "Content-Type": "application/octet-stream",
              ...headers,
            },
          });

          if (!response.ok) {
            Logger.error(TAG, `EME: License request failed (HTTP ${response.status})`);
            this.emit("error", new Error(`DRM license request failed (HTTP ${response.status})`));
            return;
          }

          const license = await response.arrayBuffer();
          await session.update(new Uint8Array(license));
          Logger.info(TAG, "EME: License acquired, playback authorized");
        });

        await session.generateRequest(event.initDataType, event.initData!);
      } catch (err) {
        Logger.error(TAG, "EME: DRM setup failed", err);
        this.emit("error", new Error(`DRM not supported or license server unreachable`));
      }
    });
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

  getVideoTracks(): VideoTrack[] {
    return this.trackManager
      .getTracks()
      .filter((t) => t.type === "video") as VideoTrack[];
  }

  selectVideoTrack(id: number): void {
    if (!this.dash) return;
    // The trackManager event handler performs the dash.js switch.
    this.trackManager.selectVideoTrack(id);
  }

  getAudioTracks() {
    return [];
  }
  selectAudioTrack(_id: number): boolean {
    return false;
  }
  getSubtitleTracks() {
    return [];
  }
  selectSubtitleTrack(_id: number | null): Promise<boolean> {
    return Promise.resolve(false);
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

    const active = this.dash?.getCurrentRepresentationForType?.("video") ?? null;
    const w = active?.width || this.videoElement.videoWidth || 0;
    const h = active?.height || this.videoElement.videoHeight || 0;

    // --- Video ---
    if (w && h) {
      stats["Video Codec"] = active?.codecs ?? "N/A";
      stats["Resolution"] = `${w}x${h}`;
      const eff = Math.max(h, Math.round((w * 9) / 16));
      stats["Quality"] = eff >= 8640 ? "16K" : eff >= 4320 ? "8K" : eff >= 2160 ? "4K" : eff >= 1440 ? "2K" : eff >= 1080 ? "1080p" : eff >= 720 ? "720p" : eff >= 480 ? "480p" : "SD";
      if (active?.frameRate) stats["Frame Rate"] = `${active.frameRate} fps`;
      stats["Video Bitrate"] = active?.bandwidth
        ? `${(active.bandwidth / 1000).toFixed(0)} kbps`
        : "N/A";
    }

    // --- Decoder ---
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
    const quality = (this.videoElement as any).getVideoPlaybackQuality?.();
    if (quality) {
      stats["Frames Decoded"] = quality.totalVideoFrames;
      stats["Frames Dropped"] = quality.droppedVideoFrames;
    }
    if (this.canvasRenderer) {
      stats["Frames Rendered"] = this._framesRendered;
    }

    // --- Buffer ---
    if (this.videoElement.buffered.length > 0) {
      const buffEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
      const ahead = buffEnd - this.videoElement.currentTime;
      stats["Buffer Ahead"] = `${ahead.toFixed(1)}s`;
    }

    // --- DASH specific ---
    const reps = this.representations;
    if (reps.length > 1) {
      const activeLabel = active ? `${active.height}p` : "N/A";
      const autoOn =
        this.dash?.getSettings?.()?.streaming?.abr?.autoSwitchBitrate?.video !== false;
      stats["DASH Quality"] = autoOn ? `Auto (${activeLabel})` : activeLabel;
      const heights = reps.map((r) => r.height);
      stats["Available Levels"] = `${reps.length} (${Math.min(...heights)}p–${Math.max(...heights)}p)`;
    }
    const tp = this.dash?.getAverageThroughput?.("video");
    if (tp && tp > 0) {
      stats["Bandwidth Estimate"] = `${(tp / 1000).toFixed(0)} kbps`;
    }

    // Memory usage (Chrome only)
    const mem = (performance as any).memory;
    if (mem) {
      stats["Memory Used"] = `${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB`;
    }

    return stats;
  }

  getNetworkSpeed(): number {
    // dash.js throughput is in bits/s → bytes/s.
    const tp = this.dash?.getAverageThroughput?.("video");
    return tp && tp > 0 ? tp / 8 : 0;
  }

  isFileSource(): boolean {
    return false;
  }

  destroy(): void {
    this.stopFrameLoop();

    if (this.dash) {
      try {
        this.dash.destroy();
      } catch {
        /* dash.js can throw if already torn down */
      }
      this.dash = null;
    }

    this.videoElement.removeAttribute("src");
    this.videoElement.load();
    if (this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    this.removeAllListeners();
  }
}
