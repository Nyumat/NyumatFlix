import { describe, expect, it } from "vitest";
import {
  isAdaptiveStreamUrl,
  resolvePresentationMode,
  usesCanvasCopyLoop,
} from "../core/presentation";
import type { PlayerConfig } from "../types";

describe("host API presentation expectations", () => {
  it("keeps HLS on native presentation without canvas copy loop", () => {
    const fakeCanvas = {} as HTMLCanvasElement;
    const config: PlayerConfig = {
      presentation: resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/master.m3u8" },
      }),
      source: { type: "url", url: "https://cdn.example/master.m3u8" },
      canvas: fakeCanvas,
      renderer: "canvas",
    };

    expect(config.presentation).toBe("native");
    expect(usesCanvasCopyLoop(config)).toBe(false);
  });

  it("keeps MKV on canvas presentation with copy loop when canvas is present", () => {
    const fakeCanvas = {} as HTMLCanvasElement;
    const config: PlayerConfig = {
      presentation: resolvePresentationMode({
        source: { type: "url", url: "https://cdn.example/movie.mkv" },
      }),
      source: { type: "url", url: "https://cdn.example/movie.mkv" },
      canvas: fakeCanvas,
      renderer: "canvas",
    };

    expect(config.presentation).toBe("canvas");
    expect(usesCanvasCopyLoop(config)).toBe(true);
  });

  it("classifies adaptive URLs for harness native mode", () => {
    expect(isAdaptiveStreamUrl("https://x/stream.m3u8")).toBe(true);
    expect(isAdaptiveStreamUrl("https://x/movie.mp4")).toBe(false);
  });
});
