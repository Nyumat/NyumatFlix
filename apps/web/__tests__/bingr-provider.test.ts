import { describe, expect, it } from "vitest";

import {
  BINGR_HLS_PROBE_TIMEOUT_MS,
  BINGR_SERVER_TIMEOUT_MS,
  buildBingrStreamBody,
  parseBingrAbrQualities,
  raceWithTimeout,
  unwrapBingrProxyUrl,
} from "@/lib/scrape/providers/bingr";

describe("unwrapBingrProxyUrl", () => {
  it("peels nested wormhole.filmu.in url params", () => {
    const upstream =
      "https://remoteconsultinggroup.site/abc/pl/H4sIAAAAAAAAAwXB0XaCIBgA4FcCtY7urlraMHAi";
    const nested = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(upstream)}&referer=https%3A%2F%2Fnextgencloudfabric.com%2F`;
    const proxied = `https://wormhole.filmu.in/proxy/m3u8?url=${encodeURIComponent(nested)}`;
    expect(unwrapBingrProxyUrl(proxied)).toBe(upstream);
  });
});

describe("buildBingrStreamBody", () => {
  it("keeps movie payloads without season/episode", () => {
    const body = buildBingrStreamBody(
      { mediaType: "movie", tmdbId: 550 },
      "s3",
      { title: "Fight Club", year: 1999 },
    );
    expect(body).toEqual({
      srv: "s3",
      t: "movie",
      id: "550",
      query: { title: "Fight Club", year: "1999" },
    });
    expect(body.query.season).toBeUndefined();
    expect(body.query.episode).toBeUndefined();
  });

  it("puts TV season and episode on the query, not a show type", () => {
    const body = buildBingrStreamBody(
      {
        mediaType: "tv",
        tmdbId: 1396,
        seasonNumber: 1,
        episodeNumber: 1,
      },
      "s2",
      { title: "Breaking Bad", year: "2008" },
    );
    expect(body.t).toBe("tv");
    expect(body.id).toBe("1396");
    expect(body.srv).toBe("s2");
    expect(body.query).toEqual({
      title: "Breaking Bad",
      year: "2008",
      season: 1,
      episode: 1,
    });
  });

  it("defaults missing TV season/episode to 1", () => {
    const body = buildBingrStreamBody(
      { mediaType: "tv", tmdbId: 1399 },
      "s1",
      null,
    );
    expect(body.query.season).toBe(1);
    expect(body.query.episode).toBe(1);
  });
});

describe("parseBingrAbrQualities", () => {
  it("resolves master STREAM-INF rows into labeled renditions", () => {
    const master = "https://cdn.example/pl/master.m3u8?token=abc";
    const body = [
      "#EXTM3U",
      "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720",
      "720.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=854x480",
      "480.m3u8",
    ].join("\n");
    const qualities = parseBingrAbrQualities(
      master,
      body,
      "https://ref.example/",
    );
    expect(qualities).toEqual([
      {
        label: "720p",
        url: "https://cdn.example/pl/720.m3u8?token=abc",
        referer: "https://ref.example/",
      },
      {
        label: "480p",
        url: "https://cdn.example/pl/480.m3u8?token=abc",
        referer: "https://ref.example/",
      },
    ]);
  });
});

describe("raceWithTimeout", () => {
  it("returns the fallback and timedOut when work never settles", async () => {
    const hung = new Promise<string>(() => undefined);
    const started = Date.now();
    const result = await raceWithTimeout(hung, 40, "timeout");
    expect(result).toEqual({ value: "timeout", timedOut: true });
    expect(Date.now() - started).toBeLessThan(200);
  });

  it("returns the value when work finishes first", async () => {
    const result = await raceWithTimeout(Promise.resolve("ok"), 200, "timeout");
    expect(result).toEqual({ value: "ok", timedOut: false });
  });

  it("keeps Bingr budgets well under the 120s audit wrapper", () => {
    expect(BINGR_SERVER_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(BINGR_HLS_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
    expect(
      BINGR_SERVER_TIMEOUT_MS * 3 + BINGR_HLS_PROBE_TIMEOUT_MS * 3,
    ).toBeLessThan(120_000);
  });
});
