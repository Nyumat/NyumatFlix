import { describe, expect, it } from "vitest";

import {
  directEngineSourceUrl,
  nextDirectPlaybackEngine,
  selectDirectPlaybackEngine,
} from "@/lib/scrape/direct-playback";

describe("direct-playback", () => {
  it("falls back from vidstack-direct to HLS transcode when a fallback exists", () => {
    expect(
      nextDirectPlaybackEngine(
        "direct",
        "vidstack-direct",
        "https://x/fallback.m3u8",
      ),
    ).toBe("vidstack-hls");
  });

  it("falls back from movi to transcode when available", () => {
    expect(
      nextDirectPlaybackEngine("extended", "movi", "https://x/fallback.m3u8"),
    ).toBe("vidstack-hls");
  });

  it("selects direct engine for native mp4 streams", () => {
    expect(selectDirectPlaybackEngine("direct")).toBe("vidstack-direct");
  });

  it("uses transcode fallback url for vidstack-hls engine", () => {
    expect(
      directEngineSourceUrl(
        "https://calluspirates.com/api/media?u=upstream",
        "https://calluspirates.com/api/transcode/playlist?u=upstream",
        "vidstack-hls",
      ),
    ).toBe("https://calluspirates.com/api/transcode/playlist?u=upstream");
  });

  it("uses media url for movi engine", () => {
    expect(
      directEngineSourceUrl(
        "https://calluspirates.com/api/media?u=upstream",
        "https://calluspirates.com/api/transcode/playlist?u=upstream",
        "movi",
      ),
    ).toBe("https://calluspirates.com/api/media?u=upstream");
  });

  it("prefers movi for extended remux when WebCodecs is available", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      expect(
        selectDirectPlaybackEngine(
          "extended",
          "/api/direct/transcode/playlist?u=upstream",
          "/api/direct/media?u=https%3A%2F%2Fcdn%2FFinding.Dory.2016.2160p.BluRay.REMUX.mkv",
        ),
      ).toBe("movi");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });

  it("keeps movi for lighter extended encodes when WebCodecs is available", () => {
    const previous = globalThis.VideoDecoder;
    // @ts-expect-error test shim
    globalThis.VideoDecoder = class VideoDecoder {};
    try {
      expect(
        selectDirectPlaybackEngine(
          "extended",
          "/api/direct/transcode/playlist?u=upstream",
          "/api/direct/media?u=https%3A%2F%2Fcdn%2Fshow.1080p.WEB-DL.x265.mkv",
        ),
      ).toBe("movi");
    } finally {
      if (previous === undefined) {
        // @ts-expect-error test cleanup
        delete globalThis.VideoDecoder;
      } else {
        globalThis.VideoDecoder = previous;
      }
    }
  });
});
