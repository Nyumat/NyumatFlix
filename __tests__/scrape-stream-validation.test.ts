import { describe, expect, it } from "vitest";

import {
  extractHlsProbeTargets,
  isValidHlsAssetResponse,
  resolveStreamReferers,
  resolveValidateStreamDepths,
} from "@/lib/scrape/validate-stream";
import { isTokenizedHlsMaster } from "@/lib/scrape/stream-url-patterns";

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

  it("inherits parent query tokens onto relative child playlists", () => {
    expect(
      extractHlsProbeTargets(
        [
          "#EXTM3U",
          "#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1920x1080",
          "index-f1-v1-a1.txt",
        ].join("\n"),
        "https://cdn.example/v4/cf-master.txt?t=token&e=123",
      ).childPlaylist,
    ).toBe("https://cdn.example/v4/index-f1-v1-a1.txt?t=token&e=123");
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

  it("detects tokenized HLS masters", () => {
    expect(
      isTokenizedHlsMaster("https://cdn.example/v4/cf-master.txt?t=abc&e=123"),
    ).toBe(true);
    expect(isTokenizedHlsMaster("https://cdn.example/playlist.m3u8")).toBe(
      false,
    );
  });

  it("defaults accept validation to full depth only", () => {
    expect(resolveValidateStreamDepths(undefined)).toEqual(["full"]);
    expect(resolveValidateStreamDepths("master")).toEqual(["master"]);
    expect(resolveValidateStreamDepths("full")).toEqual(["full"]);
  });

  it("orders embed/player referer before stream-origin referer", () => {
    expect(
      resolveStreamReferers(
        "https://vip.opstream16.com/path/index.m3u8",
        "https://vidnest.fun/",
      ),
    ).toEqual(["https://vidnest.fun/", "https://vip.opstream16.com/"]);

    // VidSrc: CDN origin can fetch the master but 403s segments; player referer
    // must win so playback does not inherit a playlist-only referer.
    expect(
      resolveStreamReferers(
        "https://comityofcognomen.site/pl/tokenized",
        "https://cloudorchestranova.com/",
      ),
    ).toEqual([
      "https://cloudorchestranova.com/",
      "https://comityofcognomen.site/",
    ]);
  });

  it("rejects VixSrc JSON stubs that are not real HLS playlists", async () => {
    const { validateStreamUrl } = await import("@/lib/scrape/validate-stream");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ playlist: "/dead" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    try {
      await expect(
        validateStreamUrl(
          "https://vixsrc.to/playlist/170060?token=abc&expires=1&h=1",
          "https://vixsrc.to/embed/1",
          "hls",
        ),
      ).resolves.toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
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
