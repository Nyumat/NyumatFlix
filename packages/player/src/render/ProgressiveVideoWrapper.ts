import { EventEmitter } from "../events/EventEmitter";
import {
  AudioTrack,
  PlayerConfig,
  PlayerEventMap,
  PlayerState,
  Track,
  VideoTrack,
} from "../types";
import { TrackManager } from "../core/TrackManager";
import { applyStreamVideoVisibility } from "../core/presentation";
import { Logger } from "../utils/Logger";
import { VideoPlayGate } from "../utils/safeMediaPlay";

const TAG = "ProgressiveVideoWrapper";

export type ProgressiveNativeDims = {
  videoWidth: number;
  videoHeight: number;
};

export const buildProgressiveNativeTracks = (
  dims: ProgressiveNativeDims,
): Track[] => {
  const tracks: Track[] = [];
  if (dims.videoWidth > 0 && dims.videoHeight > 0) {
    const video: VideoTrack = {
      id: 0,
      type: "video",
      codec: "",
      width: dims.videoWidth,
      height: dims.videoHeight,
      frameRate: 0,
      label: `${dims.videoHeight}p`,
    };
    tracks.push(video);
  }
  const audio: AudioTrack = {
    id: 1,
    type: "audio",
    codec: "",
    channels: 0,
    sampleRate: 0,
    label: "Audio",
  };
  tracks.push(audio);
  return tracks;
};

export class ProgressiveVideoWrapper extends EventEmitter<PlayerEventMap> {
  private config: PlayerConfig;
  private videoElement: HTMLVideoElement;
  private state: PlayerState = "idle";
  private readonly videoPlayGate = new VideoPlayGate();
  public trackManager: TrackManager;
  private publishedWidth = -1;
  private publishedHeight = -1;

  constructor(config: PlayerConfig) {
    super();
    this.config = config;
    this.trackManager = new TrackManager();
    this.videoElement = document.createElement("video");
    this.videoElement.crossOrigin = "anonymous";
    this.videoElement.playsInline = true;
    this.videoElement.preload = "auto";
    applyStreamVideoVisibility(this.videoElement, config);
    this.setupEventHandlers();
  }

  private publishNativeTracks(): void {
    const width = this.videoElement.videoWidth;
    const height = this.videoElement.videoHeight;
    if (width === this.publishedWidth && height === this.publishedHeight) {
      return;
    }
    this.publishedWidth = width;
    this.publishedHeight = height;
    this.trackManager.setTracks(
      buildProgressiveNativeTracks({ videoWidth: width, videoHeight: height }),
    );
  }

  private handleResize = (): void => {
    this.publishNativeTracks();
  };

  private setupEventHandlers(): void {
    this.videoElement.addEventListener("resize", this.handleResize);
    this.videoElement.addEventListener("play", () => this.setState("playing"));
    this.videoElement.addEventListener("playing", () => {
      this.setState("playing");
      this.emit("playing", undefined);
    });
    this.videoElement.addEventListener("pause", () => {
      if (this.state !== "ended") this.setState("paused");
    });
    this.videoElement.addEventListener("ended", () => this.setState("ended"));
    this.videoElement.addEventListener("seeking", () => {
      this.setState("seeking");
      this.emit("seeking", this.videoElement.currentTime);
    });
    this.videoElement.addEventListener("seeked", () => {
      this.emit("seeked", this.videoElement.currentTime);
      if (this.videoElement.paused) this.setState("paused");
      else this.setState("playing");
    });
    this.videoElement.addEventListener("waiting", () => {
      this.setState("buffering");
      this.emit("waiting", undefined);
    });
    this.videoElement.addEventListener("timeupdate", () => {
      this.emit("timeUpdate", this.videoElement.currentTime);
    });
    this.videoElement.addEventListener("durationchange", () => {
      this.emit("durationChange", this.videoElement.duration);
    });
    this.videoElement.addEventListener("error", () => {
      const error = this.videoElement.error;
      this.emit("error", new Error(error?.message || "Video element error"));
      this.setState("error");
    });
  }

  private setState(newState: PlayerState): void {
    if (this.state === newState) return;
    this.state = newState;
    this.emit("stateChange", newState);
  }

  async load(): Promise<void> {
    const url =
      this.config.source?.type === "url" ? this.config.source.url : null;
    if (!url) throw new Error("Progressive source must be a URL");

    this.setState("loading");
    this.emit("loadStart", undefined);

    return new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        this.publishNativeTracks();
        this.setState("ready");
        this.emit("loadEnd", undefined);
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("Progressive video load failed"));
      };
      const cleanup = () => {
        this.videoElement.removeEventListener("loadedmetadata", onLoaded);
        this.videoElement.removeEventListener("error", onError);
      };

      this.videoElement.addEventListener("loadedmetadata", onLoaded);
      this.videoElement.addEventListener("error", onError);
      this.videoElement.src = url;
      this.videoElement.load();
      Logger.info(TAG, `Loading progressive native video: ${url}`);
    });
  }

  async play(): Promise<void> {
    if (!this.videoElement.paused && this.state === "playing") {
      return;
    }
    await this.videoPlayGate.play(this.videoElement);
  }

  pause(): void {
    this.videoPlayGate.reset();
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

  getVideoElement(): HTMLVideoElement {
    return this.videoElement;
  }

  getBufferEndTime(): number {
    if (this.videoElement.buffered.length) {
      return this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
    }
    return 0;
  }

  setFitMode(mode: "contain" | "cover" | "fill" | "zoom" | "control"): void {
    if (mode === "contain") this.videoElement.style.objectFit = "contain";
    else if (mode === "cover") this.videoElement.style.objectFit = "cover";
    else if (mode === "fill") this.videoElement.style.objectFit = "fill";
  }

  getStats(): Record<string, string | number | boolean> {
    return {
      "Playback State": this.state,
      Renderer: "HTML5 Video",
      Resolution: `${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`,
    };
  }

  getNetworkSpeed(): number {
    return 0;
  }

  isFileSource(): boolean {
    return false;
  }

  destroy(): void {
    this.videoElement.removeEventListener("resize", this.handleResize);
    this.videoElement.removeAttribute("src");
    this.videoElement.load();
    if (this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
    }
    this.removeAllListeners();
  }
}
