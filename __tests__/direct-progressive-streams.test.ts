import { describe, expect, it } from "vitest";

import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import {
  rewriteDirectStreamUrls,
  rewriteStreamsResponse,
} from "@/lib/direct/client-streams";
import { rewritePlaybackUrlForBrowser } from "@/lib/scrape/direct-proxy";

describe("direct playback url rewrite", () => {
  it("rewrites calluspirates media paths for the browser proxy", () => {
    expect(rewritePlaybackUrlForBrowser("/api/media?u=test")).toBe(
      "/api/direct/media?u=test",
    );
    expect(rewritePlaybackUrlForBrowser("/api/transcode/playlist?u=test")).toBe(
      "/api/direct/transcode/playlist?u=test",
    );
    expect(rewritePlaybackUrlForBrowser("/api/direct/media?u=test")).toBe(
      "/api/direct/media?u=test",
    );
  });

  it("rewrites stream payloads from the server route", () => {
    const response = rewriteStreamsResponse("https://calluspirates.com", {
      streams: [
        {
          name: "Release",
          resolution: "1080p",
          size: 1,
          url: "/api/media?u=upstream",
          playback: "direct",
          cached: true,
          hash: "abc",
          browserPlayable: true,
        },
      ],
    });
    expect(response.streams[0]?.url).toBe("/api/direct/media?u=upstream");
  });

  it("merges stream chunks by hash and keeps best rank first", () => {
    const merged = mergeDirectStreams(
      [],
      [
        rewriteDirectStreamUrls({
          name: "Remux",
          resolution: "2160p",
          size: 50_000_000_000,
          url: "/api/media?u=remux",
          playback: "extended",
          cached: true,
          hash: "remux",
        }),
        rewriteDirectStreamUrls({
          name: "YIFY",
          resolution: "1080p",
          size: 1_000_000_000,
          url: "/api/media?u=mp4",
          playback: "direct",
          cached: true,
          hash: "mp4",
          browserPlayable: true,
        }),
      ],
    );
    expect(merged[0]?.hash).toBe("mp4");
    expect(merged).toHaveLength(2);
  });
});
