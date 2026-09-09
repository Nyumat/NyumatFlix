import { describe, expect, it } from "vitest";

import {
  getMoviVideoElement,
  hasDecodedVideoFrame,
  isMoviHostPlaybackReady,
  isMoviPlayerMakingProgress,
  isMoviVideoPlaybackReady,
  resetMoviProgressObservation,
  subscribeMoviPlaybackReady,
} from "@/lib/player/player-playback-ready";

const attachVideo = (
  host: HTMLElement,
  dims: { videoWidth: number; videoHeight: number },
  extra?: { readyState?: number; paused?: boolean; currentTime?: number },
): HTMLVideoElement => {
  const video = document.createElement("video");
  video.slot = "media";
  Object.defineProperty(video, "videoWidth", {
    configurable: true,
    get: () => dims.videoWidth,
  });
  Object.defineProperty(video, "videoHeight", {
    configurable: true,
    get: () => dims.videoHeight,
  });
  Object.defineProperty(video, "readyState", {
    configurable: true,
    get: () => extra?.readyState ?? 2,
  });
  Object.defineProperty(video, "paused", {
    configurable: true,
    get: () => extra?.paused ?? false,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => extra?.currentTime ?? 12,
  });
  host.append(video);
  return video;
};

describe("getMoviVideoElement", () => {
  it("prefers the light-DOM slotted native video over the shadow placeholder", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const placeholder = document.createElement("video");
    placeholder.dataset.kind = "shadow";
    shadow.append(placeholder);

    const slotted = document.createElement("video");
    slotted.slot = "media";
    slotted.dataset.kind = "light";
    host.append(slotted);

    expect(getMoviVideoElement(host)?.dataset.kind).toBe("light");
  });

  it("prefers the playing native video over a paused shadow placeholder", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const placeholder = document.createElement("video");
    Object.defineProperty(placeholder, "videoWidth", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(placeholder, "videoHeight", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(placeholder, "paused", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(placeholder, "currentTime", {
      configurable: true,
      get: () => 0,
    });
    shadow.append(placeholder);

    const nativeVideo = document.createElement("video");
    nativeVideo.slot = "media";
    Object.defineProperty(nativeVideo, "videoWidth", {
      configurable: true,
      get: () => 1280,
    });
    Object.defineProperty(nativeVideo, "videoHeight", {
      configurable: true,
      get: () => 720,
    });
    Object.defineProperty(nativeVideo, "paused", {
      configurable: true,
      get: () => false,
    });
    Object.defineProperty(nativeVideo, "currentTime", {
      configurable: true,
      get: () => 42,
    });
    host.append(nativeVideo);

    expect(getMoviVideoElement(host)).toBe(nativeVideo);
  });
});

describe("native picture invariant", () => {
  it("treats audio-only native video as not ready", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "videoWidth", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(video, "videoHeight", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(video, "readyState", {
      configurable: true,
      get: () => 4,
    });

    expect(hasDecodedVideoFrame(video)).toBe(false);
    expect(isMoviVideoPlaybackReady(video)).toBe(false);
  });

  it("does not count a moving clock as progress without a video frame", () => {
    const host = document.createElement("div");
    attachVideo(host, { videoWidth: 0, videoHeight: 0 }, { currentTime: 543 });
    Object.defineProperty(host, "currentTime", {
      configurable: true,
      get: () => 543,
    });

    expect(isMoviPlayerMakingProgress(host)).toBe(false);
  });

  it("counts progress once a frame is present", () => {
    const host = document.createElement("div");
    attachVideo(host, { videoWidth: 1920, videoHeight: 800 });
    resetMoviProgressObservation(host);

    expect(isMoviPlayerMakingProgress(host)).toBe(true);
  });

  it("counts host clock progress when native presentation advances currentTime", () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const placeholder = document.createElement("video");
    Object.defineProperty(placeholder, "videoWidth", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(placeholder, "videoHeight", {
      configurable: true,
      get: () => 0,
    });
    Object.defineProperty(placeholder, "currentTime", {
      configurable: true,
      get: () => 0,
    });
    shadow.append(placeholder);

    Object.defineProperty(host, "currentTime", {
      configurable: true,
      get: () => 120,
    });
    Object.defineProperty(host, "playing", {
      configurable: true,
      get: () => true,
    });
    resetMoviProgressObservation(host);

    expect(isMoviPlayerMakingProgress(host)).toBe(true);
    expect(isMoviHostPlaybackReady(host)).toBe(true);
  });
});

describe("subscribeMoviPlaybackReady", () => {
  it("fires immediately when a decoded frame is already playing", () => {
    const host = document.createElement("div");
    attachVideo(
      host,
      { videoWidth: 1920, videoHeight: 1080 },
      { paused: false },
    );
    resetMoviProgressObservation(host);

    expect(isMoviHostPlaybackReady(host)).toBe(true);

    let ready = false;
    const stop = subscribeMoviPlaybackReady(host, () => {
      ready = true;
    });
    expect(ready).toBe(true);
    stop();
  });

  it("does not fire for an audio-only stream", () => {
    const host = document.createElement("div");
    attachVideo(host, { videoWidth: 0, videoHeight: 0 }, { readyState: 4 });
    resetMoviProgressObservation(host);

    let ready = false;
    const stop = subscribeMoviPlaybackReady(host, () => {
      ready = true;
    });
    expect(isMoviHostPlaybackReady(host)).toBe(false);
    expect(ready).toBe(false);
    stop();
  });
});
