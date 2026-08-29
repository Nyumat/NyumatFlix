import { describe, expect, it } from "vitest";

import {
  isClientDirectPlaybackUrl,
  inferDirectMediaContentType,
  resolveCalluspiratesProxyTarget,
  rewriteDirectProxyPlaylist,
  shouldRewriteDirectProxyPlaylist,
  toClientDirectPlaybackUrl,
  toUpstreamCalluspiratesPlaybackUrl,
} from "@/lib/scrape/direct-proxy";

describe("direct-proxy", () => {
  const apiBase = "http://localhost:8788";

  it("rewrites calluspirates media urls to same-origin proxy paths", () => {
    expect(
      toClientDirectPlaybackUrl(
        apiBase,
        "/api/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
      ),
    ).toBe("/api/direct/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv");
  });

  it("keeps upstream probes on calluspirates origin", () => {
    expect(
      toUpstreamCalluspiratesPlaybackUrl(
        apiBase,
        "/api/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
      ),
    ).toBe(
      "http://localhost:8788/api/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
    );
  });

  it("never exposes cross-origin calluspirates urls to the client", () => {
    const clientUrl = toClientDirectPlaybackUrl(
      "https://calluspirates.com",
      "/api/media?u=test",
    );
    expect(isClientDirectPlaybackUrl(clientUrl)).toBe(true);
    expect(clientUrl).not.toContain("calluspirates.com");
  });

  it("rewrites transcode playlist urls", () => {
    expect(
      toClientDirectPlaybackUrl(
        apiBase,
        "/api/transcode/playlist?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
      ),
    ).toBe(
      "/api/direct/transcode/playlist?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
    );
  });

  it("resolves proxy target back to calluspirates", () => {
    process.env.CALLUSPIRATES_API_URL = apiBase;
    expect(
      resolveCalluspiratesProxyTarget(
        "http://localhost:3000/api/direct/media?u=test",
      ),
    ).toBe("http://localhost:8788/api/media?u=test");
    delete process.env.CALLUSPIRATES_API_URL;
  });

  it("rewrites HLS playlist segment paths for same-origin playback", () => {
    const body = [
      "#EXTM3U",
      '#EXT-X-MAP:URI="/api/transcode/hls/init.mp4?u=upstream"',
      "/api/transcode/hls/segment.m4s?u=upstream&seg=0",
    ].join("\n");
    expect(rewriteDirectProxyPlaylist(body)).toBe(
      [
        "#EXTM3U",
        '#EXT-X-MAP:URI="/api/direct/transcode/hls/init.mp4?u=upstream"',
        "/api/direct/transcode/hls/segment.m4s?u=upstream&seg=0",
      ].join("\n"),
    );
  });

  it("infers matroska content-type from nested media urls", () => {
    expect(
      inferDirectMediaContentType(
        "application/octet-stream",
        "/api/direct/media?u=https%3A%2F%2Fcdn.example%2Fmovie.mkv",
      ),
    ).toBe("video/x-matroska");
  });

  it("does not rewrite binary media paths by pathname alone", () => {
    expect(
      shouldRewriteDirectProxyPlaylist(
        "/api/direct/media?u=https%3A%2F%2Fcdn.example%2Fmovie.mp4",
      ),
    ).toBe(false);
    expect(shouldRewriteDirectProxyPlaylist("/api/direct/media")).toBe(false);
  });

  it("rewrites transcode playlist paths", () => {
    expect(
      shouldRewriteDirectProxyPlaylist(
        "/api/direct/transcode/playlist?u=upstream",
      ),
    ).toBe(true);
  });
});
