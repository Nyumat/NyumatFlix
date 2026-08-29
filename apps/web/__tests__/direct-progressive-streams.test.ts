import { describe, expect, it } from "vitest";

import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import {
  directDiscoveryJsonPath,
  rewriteDirectStreamUrls,
  rewriteStreamsResponse,
} from "@/lib/direct/client-streams";
import {
  consumeSseFrames,
  directDiscoveryEventPath,
  MAX_SSE_RECONNECTS,
  shouldLoadJsonFallback,
} from "@/lib/direct/progressive-streams";
import { unwrapDirectProxyPath } from "@/lib/scrape/direct-proxy";

describe("direct playback url rewrite", () => {
  const target = {
    apiBase: "https://calluspirates.com",
    accessToken: "session-token",
  };

  it("unwraps leftover proxy paths to calluspirates media paths", () => {
    expect(unwrapDirectProxyPath("/api/media?u=test")).toBe(
      "/api/media?u=test",
    );
    expect(unwrapDirectProxyPath("/api/transcode/playlist?u=test")).toBe(
      "/api/transcode/playlist?u=test",
    );
    expect(unwrapDirectProxyPath("/api/direct/media?u=test")).toBe(
      "/api/media?u=test",
    );
  });

  it("rewrites stream payloads onto the calluspirates origin", () => {
    const response = rewriteStreamsResponse(
      target.apiBase,
      {
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
      },
      target.accessToken,
    );
    expect(response.streams[0]?.url).toBe(
      "https://calluspirates.com/api/media?u=upstream&access_token=session-token",
    );
  });

  it("merges stream chunks by hash and keeps best rank first", () => {
    const merged = mergeDirectStreams(
      [],
      [
        rewriteDirectStreamUrls(
          {
            name: "Remux",
            resolution: "2160p",
            size: 50_000_000_000,
            url: "/api/media?u=remux",
            playback: "extended",
            cached: true,
            hash: "remux",
          },
          target,
        ),
        rewriteDirectStreamUrls(
          {
            name: "YIFY",
            resolution: "1080p",
            size: 1_000_000_000,
            url: "/api/media?u=mp4",
            playback: "direct",
            cached: true,
            hash: "mp4",
            browserPlayable: true,
          },
          target,
        ),
      ],
      target,
    );
    expect(merged[0]?.hash).toBe("mp4");
    expect(merged).toHaveLength(2);
  });

  it("keeps stream discovery on the nyumatflix origin", () => {
    expect(directDiscoveryEventPath({ mediaType: "movie", tmdbId: 550 })).toBe(
      "/api/direct/movie/550/streams/stream",
    );
    expect(
      directDiscoveryEventPath({
        mediaType: "tv",
        tmdbId: 1399,
        season: 1,
        episode: 2,
        fresh: true,
      }),
    ).toBe("/api/direct/tv/1399/streams/stream?season=1&episode=2&fresh=1");
    expect(directDiscoveryJsonPath("movie", 550)).toBe(
      "/api/direct/movie/550/streams",
    );
    expect(directDiscoveryJsonPath("movie", 550, { quick: true })).toBe(
      "/api/direct/movie/550/streams?quick=1",
    );
    expect(directDiscoveryJsonPath("tv", 1399, { season: 1, episode: 3 })).toBe(
      "/api/direct/tv/1399/streams?season=1&episode=3",
    );
  });
});

describe("direct discovery sse frames", () => {
  it("parses split chunks and keeps a partial buffer", () => {
    const carry = { buffer: "" };
    const first = consumeSseFrames('event: streams\ndata: {"strea', carry);
    expect(first).toEqual([]);
    const second = consumeSseFrames(
      'ms":[{"name":"GoT","url":"/u","hash":"abc"}]}\n\nevent: done\ndata: {"streams":[]}\n\n',
      carry,
    );
    expect(second.map((frame) => frame.event)).toEqual(["streams", "done"]);
  });

  it("does not treat a connection drop without a done frame as a parsed error", () => {
    const carry = { buffer: "" };
    const frames = consumeSseFrames(
      'event: status\ndata: {"message":"Finding streams","loading":["addon"]}\n\n',
      carry,
    );
    expect(frames).toEqual([
      {
        event: "status",
        data: '{"message":"Finding streams","loading":["addon"]}',
      },
    ]);
    expect(carry.buffer).toBe("");
  });
});

describe("direct discovery sse reconnects", () => {
  it("caps reconnects at 2", () => {
    expect(MAX_SSE_RECONNECTS).toBe(2);
  });

  it("does not json-fallback after a terminal done frame with zero streams", () => {
    expect(
      shouldLoadJsonFallback({
        sawTerminalDone: true,
        accumulatedCount: 0,
      }),
    ).toBe(false);
  });

  it("does not json-fallback when streams were already accumulated", () => {
    expect(
      shouldLoadJsonFallback({
        sawTerminalDone: false,
        accumulatedCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldLoadJsonFallback({
        sawTerminalDone: true,
        accumulatedCount: 3,
      }),
    ).toBe(false);
  });

  it("json-falls back only when we never saw done and accumulated nothing", () => {
    expect(
      shouldLoadJsonFallback({
        sawTerminalDone: false,
        accumulatedCount: 0,
      }),
    ).toBe(true);
  });
});
