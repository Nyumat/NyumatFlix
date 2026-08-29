import { describe, expect, it } from "vitest";

import {
  appendAccessToken,
  isClientDirectPlaybackUrl,
  inferDirectMediaContentType,
  resolveCalluspiratesProxyTarget,
  rewriteDirectProxyPlaylist,
  shouldRewriteDirectProxyPlaylist,
  toClientDirectPlaybackUrl,
  toUpstreamCalluspiratesPlaybackUrl,
  unwrapDirectProxyPath,
} from "@/lib/scrape/direct-proxy";

describe("direct-proxy", () => {
  const apiBase = "http://localhost:8788";
  const token = "session-token";

  it("sends calluspirates media urls to the calluspirates origin", () => {
    expect(
      toClientDirectPlaybackUrl(
        apiBase,
        "/api/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
        token,
      ),
    ).toBe(
      "http://localhost:8788/api/media?u=https%3A%2F%2Fexample.com%2Fmovie.mkv&access_token=session-token",
    );
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

  it("unwraps leftover same-origin proxy paths", () => {
    expect(unwrapDirectProxyPath("/api/direct/media?u=test")).toBe(
      "/api/media?u=test",
    );
    expect(
      toClientDirectPlaybackUrl(
        "https://calluspirates.com",
        "/api/direct/media?u=test",
        token,
      ),
    ).toBe(
      "https://calluspirates.com/api/media?u=test&access_token=session-token",
    );
    expect(
      isClientDirectPlaybackUrl(
        "https://calluspirates.com/api/media?u=test&access_token=session-token",
      ),
    ).toBe(true);
  });

  it("rewrites transcode playlist urls onto calluspirates", () => {
    expect(
      toClientDirectPlaybackUrl(
        apiBase,
        "/api/transcode/playlist?u=https%3A%2F%2Fexample.com%2Fmovie.mkv",
        token,
      ),
    ).toBe(
      "http://localhost:8788/api/transcode/playlist?u=https%3A%2F%2Fexample.com%2Fmovie.mkv&access_token=session-token",
    );
  });

  it("resolves leftover proxy target back to calluspirates", () => {
    process.env.CALLUSPIRATES_API_URL = apiBase;
    expect(
      resolveCalluspiratesProxyTarget(
        "http://localhost:3000/api/direct/media?u=test",
      ),
    ).toBe("http://localhost:8788/api/media?u=test");
    delete process.env.CALLUSPIRATES_API_URL;
  });

  it("still rewrites HLS playlist segment paths if the fallback proxy is used", () => {
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
    expect(rewriteDirectProxyPlaylist(body, token)).toBe(
      [
        "#EXTM3U",
        `#EXT-X-MAP:URI="/api/direct/transcode/hls/init.mp4?u=upstream&access_token=${token}"`,
        `/api/direct/transcode/hls/segment.m4s?u=upstream&seg=0&access_token=${token}`,
      ].join("\n"),
    );
  });

  it("appends access_token without dropping existing query params", () => {
    expect(appendAccessToken("/api/media?u=upstream", token)).toBe(
      "/api/media?u=upstream&access_token=session-token",
    );
  });

  it("infers avi content-type from content-disposition filename", () => {
    expect(
      inferDirectMediaContentType(
        "application/octet-stream",
        "/api/direct/media?u=https%3A%2F%2Fcdn.example%2Fblob",
        { contentDisposition: 'attachment; filename="ep01.avi"' },
      ),
    ).toBe("video/x-msvideo");
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
