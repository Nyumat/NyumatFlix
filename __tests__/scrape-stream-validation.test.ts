import { describe, expect, it } from "vitest";

import {
  extractHlsProbeTargets,
  isValidHlsAssetResponse,
} from "@/lib/scrape/validate-stream";

describe("scrape stream validation", () => {
  it("follows the first rendition in a master playlist", () => {
    expect(
      extractHlsProbeTargets(
        [
          "#EXTM3U",
          "#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x1080",
          "1080/index.m3u8",
          "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720",
          "720/index.m3u8",
        ].join("\n"),
        "https://cdn.example/master.m3u8",
      ),
    ).toEqual({
      childPlaylist: "https://cdn.example/1080/index.m3u8",
      requiredAssets: [],
    });
  });

  it("requires encryption, initialization, and media assets", () => {
    expect(
      extractHlsProbeTargets(
        [
          "#EXTM3U",
          '#EXT-X-KEY:METHOD=AES-128,URI="../keys/video.key"',
          '#EXT-X-MAP:URI="init.mp4"',
          "#EXTINF:6,",
          "segment-1.m4s",
        ].join("\n"),
        "https://cdn.example/video/playlist.m3u8",
      ),
    ).toEqual({
      childPlaylist: null,
      requiredAssets: [
        "https://cdn.example/keys/video.key",
        "https://cdn.example/video/init.mp4",
        "https://cdn.example/video/segment-1.m4s",
      ],
    });
  });

  it("does not mistake alternate audio for the primary video rendition", () => {
    expect(
      extractHlsProbeTargets(
        [
          "#EXTM3U",
          '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="audio/index.m3u8"',
          '#EXT-X-STREAM-INF:BANDWIDTH=2000000,AUDIO="audio"',
          "video/index.m3u8",
        ].join("\n"),
        "https://cdn.example/master.m3u8",
      ).childPlaylist,
    ).toBe("https://cdn.example/video/index.m3u8");
  });

  it("rejects image and HTML error bodies as HLS media", () => {
    expect(
      isValidHlsAssetResponse(
        "image/png",
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe(false);
    expect(
      isValidHlsAssetResponse(
        "text/html; charset=utf-8",
        new TextEncoder().encode("<!doctype html>"),
      ),
    ).toBe(false);
    expect(
      isValidHlsAssetResponse(
        "image/jpeg",
        new Uint8Array([0x47, 0x40, 0x00, 0x10]),
      ),
    ).toBe(true);
    expect(
      isValidHlsAssetResponse(
        "application/octet-stream",
        new Uint8Array([1, 2, 3]),
      ),
    ).toBe(true);
  });
});
