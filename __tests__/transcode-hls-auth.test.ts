import { describe, expect, it } from "vitest";

import {
  appendAccessTokenToTranscodePlaylist,
  isDirectTranscodeHlsUrl,
  mergeTranscodeHlsAuthConfig,
  readAccessTokenFromUrl,
} from "@/lib/direct/transcode-hls-auth";
import { rewriteDirectProxyPlaylist } from "@/lib/scrape/direct-proxy";

const token = "session-token";

describe("transcode HLS auth", () => {
  it("reads access_token from playlist urls", () => {
    expect(
      readAccessTokenFromUrl(
        "http://localhost:8788/api/transcode/playlist?u=upstream&access_token=abc",
      ),
    ).toBe("abc");
    expect(readAccessTokenFromUrl("/api/transcode/playlist?u=upstream")).toBe(
      null,
    );
  });

  it("detects direct transcode playlist urls", () => {
    expect(
      isDirectTranscodeHlsUrl(
        "http://localhost:8788/api/transcode/playlist?u=x",
      ),
    ).toBe(true);
    expect(isDirectTranscodeHlsUrl("https://cdn.example.com/master.m3u8")).toBe(
      false,
    );
  });

  it("appends access_token to init and segment lines", () => {
    const body = [
      "#EXTM3U",
      '#EXT-X-MAP:URI="/api/transcode/hls/init.mp4?u=upstream&profile=heavy"',
      "/api/transcode/hls/segment.m4s?u=upstream&profile=heavy&seg=0",
    ].join("\n");

    expect(appendAccessTokenToTranscodePlaylist(body, token)).toBe(
      [
        "#EXTM3U",
        `#EXT-X-MAP:URI="/api/transcode/hls/init.mp4?u=upstream&profile=heavy&access_token=${token}"`,
        `/api/transcode/hls/segment.m4s?u=upstream&profile=heavy&seg=0&access_token=${token}`,
      ].join("\n"),
    );
  });

  it("rewrites proxy playlists and injects tokens", () => {
    const body = [
      "#EXTM3U",
      '#EXT-X-MAP:URI="/api/transcode/hls/init.mp4?u=upstream"',
      "/api/transcode/hls/segment.m4s?u=upstream&seg=0",
    ].join("\n");

    expect(rewriteDirectProxyPlaylist(body, token)).toBe(
      [
        "#EXTM3U",
        `#EXT-X-MAP:URI="/api/direct/transcode/hls/init.mp4?u=upstream&access_token=${token}"`,
        `/api/direct/transcode/hls/segment.m4s?u=upstream&seg=0&access_token=${token}`,
      ].join("\n"),
    );
  });

  it("adds fetchSetup for transcode playlists", async () => {
    const playlist =
      "http://localhost:8788/api/transcode/playlist?u=upstream&access_token=abc";
    const config = mergeTranscodeHlsAuthConfig(playlist, { startPosition: 0 });
    expect(config.fetchSetup).toBeTypeOf("function");

    const request = await Promise.resolve(
      config.fetchSetup!(
        {
          url: "http://localhost:8788/api/transcode/hls/init.mp4?u=upstream",
        } as never,
        {},
      ),
    );
    expect(request.url).toContain("access_token=abc");
  });
});
