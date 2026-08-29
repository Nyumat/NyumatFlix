import { describe, expect, it } from "vitest";

import {
  engineSourceUrl,
  nextFallbackEngine,
  selectInitialEngine,
} from "@/lib/direct/playback";
import type { DirectStream } from "@/lib/direct/types";

const extendedStream: DirectStream = {
  name: "Hoppers 2026.mkv",
  resolution: "2160p",
  size: 25_555_055_411,
  url: "/api/direct/media?u=upstream",
  fallbackUrl: "/api/direct/transcode/playlist?u=upstream",
  cached: true,
  hash: "abc",
  playback: "extended",
  browserPlayable: true,
};

describe("direct engine playback", () => {
  it("starts extended streams on movi when WebCodecs is available", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      expect(selectInitialEngine(extendedStream)).toBe("movi");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("falls back from movi to HLS transcode like calluspirates", () => {
    expect(nextFallbackEngine(extendedStream, "movi")).toBe("vidstack-hls");
  });

  it("uses transcode url for vidstack-hls engine", () => {
    expect(engineSourceUrl(extendedStream, "vidstack-hls")).toBe(
      extendedStream.fallbackUrl,
    );
  });
});
