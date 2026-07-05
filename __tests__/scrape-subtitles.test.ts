import { describe, expect, it } from "vitest";

import {
  buildScrapeQualityPlayUrls,
  buildScrapeSubtitleTracks,
  detectScrapeSubtitleType,
  parseQualityLabel,
} from "@/lib/scrape/player-sources";
import { buildScrapePlayUrl } from "@/lib/scrape/playback";

describe("scrape subtitles", () => {
  it("detects vtt and srt from URLs", () => {
    expect(detectScrapeSubtitleType("https://cdn.example/a.vtt")).toBe("vtt");
    expect(detectScrapeSubtitleType("https://cdn.example/a.srt")).toBe("srt");
    expect(detectScrapeSubtitleType("https://cdn.example/sub?format=srt")).toBe(
      "srt",
    );
  });

  it("builds proxied tracks with captions off by default", () => {
    const tracks = buildScrapeSubtitleTracks(
      [
        {
          lang: "Spanish",
          url: "https://cdn.example/es.vtt",
        },
        {
          lang: "English",
          url: "https://cdn.example/a.vtt",
        },
      ],
      "https://www.vidking.net/",
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]?.src).toMatch(/^\/api\/scrape\/play\//);
    expect(tracks.every((track) => !track.default)).toBe(true);
    expect(tracks[1]?.label).toBe("English (A)");
  });

  it("dedupes identical subtitle URLs", () => {
    const tracks = buildScrapeSubtitleTracks(
      [
        { lang: "English", url: "https://cdn.example/a.vtt" },
        { lang: "English", url: "https://cdn.example/a.vtt" },
      ],
      undefined,
    );

    expect(tracks).toHaveLength(1);
  });
});

describe("scrape quality fallbacks", () => {
  it("parses common quality labels", () => {
    expect(parseQualityLabel("1080p")).toEqual({ width: 1920, height: 1080 });
    expect(parseQualityLabel("4K")).toEqual({ width: 3840, height: 2160 });
    expect(parseQualityLabel("auto")).toBeNull();
  });

  it("orders alternate qualities highest-first after primary playUrl", () => {
    const referer = "https://www.vidking.net/";
    const primary = "/api/scrape/play/primary/asset.m3u8";
    const high = buildScrapePlayUrl({
      url: "https://cdn.example/1080.m3u8",
      referer,
    });
    const low = buildScrapePlayUrl({
      url: "https://cdn.example/480.m3u8",
      referer,
    });
    const urls = buildScrapeQualityPlayUrls(
      primary,
      [
        { label: "480p", url: "https://cdn.example/480.m3u8" },
        { label: "1080p", url: "https://cdn.example/1080.m3u8" },
      ],
      referer,
    );

    expect(urls).toEqual([primary, high, low]);
  });

  it("dedupes proxied quality URLs that match the primary playUrl", () => {
    const streamUrl = "https://cdn.example/master.m3u8";
    const playUrl = buildScrapePlayUrl({ url: streamUrl });

    const urls = buildScrapeQualityPlayUrls(
      playUrl,
      [{ label: "1080p", url: streamUrl }],
      undefined,
    );

    expect(urls).toEqual([playUrl]);
  });
});
