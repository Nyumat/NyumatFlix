import { describe, expect, it } from "vitest";
import {
  isAdaptiveStreamUrl,
  isProgressiveNativeUrl,
  resolvePresentationMode,
  usesCanvasCopyLoop,
} from "../core/presentation";
import type { PlayerConfig } from "../types";

describe("resolvePresentationMode", () => {
  it("selects native for HLS URLs", () => {
    expect(
      resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/stream.m3u8" },
      }),
    ).toBe("native");
  });

  it("selects native for progressive MP4", () => {
    expect(
      resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/movie.mp4" },
      }),
    ).toBe("native");
  });

  it("selects canvas for MKV URLs by default", () => {
    expect(
      resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/movie.mkv" },
      }),
    ).toBe("canvas");
  });

  it("honors presentation=canvas override on HLS", () => {
    expect(
      resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/stream.m3u8" },
        presentation: "canvas",
      }),
    ).toBe("canvas");
  });

  it("forces canvas when lcevc is enabled", () => {
    expect(
      resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/stream.m3u8" },
        lcevc: true,
      }),
    ).toBe("canvas");
  });
});

describe("usesCanvasCopyLoop", () => {
  const fakeCanvas = {} as HTMLCanvasElement;

  it("disables canvas copy on native presentation", () => {
    const config: PlayerConfig = {
      presentation: "native",
      source: { type: "url", url: "https://cdn.example/stream.m3u8" },
      canvas: fakeCanvas,
      renderer: "canvas",
    };
    expect(usesCanvasCopyLoop(config)).toBe(false);
  });

  it("enables canvas copy for canvas presentation with canvas element", () => {
    const config: PlayerConfig = {
      presentation: "canvas",
      source: { type: "url", url: "https://cdn.example/movie.mkv" },
      canvas: fakeCanvas,
      renderer: "canvas",
    };
    expect(usesCanvasCopyLoop(config)).toBe(true);
  });
});

describe("url helpers", () => {
  it("detects adaptive stream extensions", () => {
    expect(isAdaptiveStreamUrl("https://x/a.m3u8?token=1")).toBe(true);
    expect(isAdaptiveStreamUrl("https://x/a.mpd")).toBe(true);
    expect(isAdaptiveStreamUrl("https://x/a.mp4")).toBe(false);
  });

  it("detects progressive native extensions", () => {
    expect(isProgressiveNativeUrl("https://x/a.webm")).toBe(true);
    expect(isProgressiveNativeUrl("https://x/a.mkv")).toBe(false);
  });
});
