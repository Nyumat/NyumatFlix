import type { PlayerState } from "../types";

export interface BufferedRange {
  start: number;
  end: number;
}

export interface VideoPresenter {
  readonly mode: "native" | "canvas";
  getVideoElement(): HTMLVideoElement | null;
  getCanvasElement(): HTMLCanvasElement | null;
  getCurrentTime(): number;
  getDuration(): number;
  getBuffered(): BufferedRange[];
  getState(): PlayerState;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): Promise<void>;
  setVolume(volume: number): void;
  getVolume(): number;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  requestFullscreen(): Promise<void>;
  requestPictureInPicture(): Promise<void>;
  canCast(): boolean;
  canAirPlay(): boolean;
  showAirPlayPicker(): void;
}

export class NativeVideoPresenter implements VideoPresenter {
  readonly mode = "native" as const;

  constructor(private readonly video: HTMLVideoElement) {}

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  getCanvasElement(): null {
    return null;
  }

  getCurrentTime(): number {
    return this.video.currentTime;
  }

  getDuration(): number {
    return this.video.duration;
  }

  getBuffered(): BufferedRange[] {
    const ranges: BufferedRange[] = [];
    const buffered = this.video.buffered;
    for (let i = 0; i < buffered.length; i++) {
      ranges.push({ start: buffered.start(i), end: buffered.end(i) });
    }
    return ranges;
  }

  getState(): PlayerState {
    if (this.video.ended) return "ended";
    if (this.video.seeking) return "seeking";
    if (this.video.paused) return "paused";
    if (this.video.readyState < 3) return "buffering";
    return "playing";
  }

  async play(): Promise<void> {
    await this.video.play();
  }

  pause(): void {
    this.video.pause();
  }

  async seek(seconds: number): Promise<void> {
    this.video.currentTime = seconds;
  }

  setVolume(volume: number): void {
    this.video.volume = Math.min(1, Math.max(0, volume));
  }

  getVolume(): number {
    return this.video.volume;
  }

  setMuted(muted: boolean): void {
    this.video.muted = muted;
  }

  isMuted(): boolean {
    return this.video.muted;
  }

  setPlaybackRate(rate: number): void {
    this.video.playbackRate = rate;
  }

  getPlaybackRate(): number {
    return this.video.playbackRate;
  }

  async requestFullscreen(): Promise<void> {
    const v = this.video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    };
    if (typeof v.webkitEnterFullscreen === "function") {
      v.webkitEnterFullscreen();
      return;
    }
    if (this.video.requestFullscreen) {
      await this.video.requestFullscreen();
      return;
    }
    const host = this.video.parentElement;
    if (host?.requestFullscreen) {
      await host.requestFullscreen();
    }
  }

  async requestPictureInPicture(): Promise<void> {
    if (document.pictureInPictureEnabled && this.video.requestPictureInPicture) {
      await this.video.requestPictureInPicture();
    }
  }

  canCast(): boolean {
    return true;
  }

  canAirPlay(): boolean {
    return (
      typeof (this.video as HTMLVideoElement & {
        webkitShowPlaybackTargetPicker?: unknown;
      }).webkitShowPlaybackTargetPicker === "function"
    );
  }

  showAirPlayPicker(): void {
    const v = this.video as HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: () => void;
    };
    v.webkitShowPlaybackTargetPicker?.();
  }
}

export class CanvasVideoPresenter implements VideoPresenter {
  readonly mode = "canvas" as const;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly playerApi: {
      getCurrentTime(): number;
      getDuration(): number;
      getState(): PlayerState;
      play(): Promise<void>;
      pause(): void;
      seek(seconds: number): Promise<void>;
      setVolume(volume: number): void;
      getVolume(): number;
      setMuted(muted: boolean): void;
      getMuted(): boolean;
      setPlaybackRate(rate: number): void;
      getPlaybackRate(): number;
      getBufferEndTime(): number;
    },
    private readonly host: HTMLElement,
  ) {}

  getVideoElement(): null {
    return null;
  }

  getCanvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  getCurrentTime(): number {
    return this.playerApi.getCurrentTime();
  }

  getDuration(): number {
    return this.playerApi.getDuration();
  }

  getBuffered(): BufferedRange[] {
    const end = this.playerApi.getBufferEndTime();
    if (end <= 0) return [];
    return [{ start: 0, end }];
  }

  getState(): PlayerState {
    return this.playerApi.getState();
  }

  play(): Promise<void> {
    return this.playerApi.play();
  }

  pause(): void {
    this.playerApi.pause();
  }

  seek(seconds: number): Promise<void> {
    return this.playerApi.seek(seconds);
  }

  setVolume(volume: number): void {
    this.playerApi.setVolume(volume);
  }

  getVolume(): number {
    return this.playerApi.getVolume();
  }

  setMuted(muted: boolean): void {
    this.playerApi.setMuted(muted);
  }

  isMuted(): boolean {
    return this.playerApi.getMuted();
  }

  setPlaybackRate(rate: number): void {
    this.playerApi.setPlaybackRate(rate);
  }

  getPlaybackRate(): number {
    return this.playerApi.getPlaybackRate();
  }

  async requestFullscreen(): Promise<void> {
    if (this.host.requestFullscreen) {
      await this.host.requestFullscreen();
    }
  }

  async requestPictureInPicture(): Promise<void> {
    // Document PiP for canvas is handled by MoviElement.
  }

  canCast(): boolean {
    return false;
  }

  canAirPlay(): boolean {
    return false;
  }

  showAirPlayPicker(): void {}
}
