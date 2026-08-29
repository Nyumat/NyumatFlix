import { describe, expect, it } from "vitest";

import {
  buildScrapeQualityPlayUrls,
  buildScrapeSubtitleTracks,
  detectScrapeSubtitleType,
  parseQualityLabel,
  scrapeSubtitleCaptionMenuValue,
} from "@/lib/scrape/player-sources";
import {
  buildScrapePlayUrl,
  convertAssToVtt,
  decodeScrapePlaybackToken,
} from "@/lib/scrape/playback";

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

  it("keeps unique caption menu labels when lang and source collide", () => {
    const tracks = buildScrapeSubtitleTracks(
      [
        {
          lang: "en-US",
          url: "https://api.animeonsen.xyz/v4/subtitles/title/en-US/1",
          format: "ass",
          source: "AnimeOnsen",
        },
        {
          lang: "en-US",
          url: "https://api.animeonsen.xyz/v4/subtitles/title/en-US/2",
          format: "ass",
          source: "AnimeOnsen",
        },
      ],
      "https://www.animeonsen.xyz",
    );

    expect(tracks).toHaveLength(2);
    expect(tracks[0]?.id).toMatch(/^scrape-en-us-[a-z0-9]+$/);
    expect(tracks[1]?.id).toMatch(/^scrape-en-us-[a-z0-9]+$/);
    expect(tracks[0]?.id).not.toBe(tracks[1]?.id);
    expect(tracks[0]?.label).toBe("en-US · AnimeOnsen");
    expect(tracks[1]?.label).toBe("en-US · AnimeOnsen (2)");
  });

  it("keeps unique Vidstack caption menu values for colliding lang labels", () => {
    const sharedUrl = "https://cdn.example/arabic.vtt";
    const tracks = buildScrapeSubtitleTracks(
      [
        { lang: "Arabic", url: sharedUrl, source: "justanime" },
        {
          lang: "arabic",
          url: "https://cdn.example/arabic-alt.vtt",
          source: "justanime",
        },
      ],
      "https://justanime.to/",
    );

    expect(tracks).toHaveLength(2);
    const menuValues = tracks.map((track) =>
      scrapeSubtitleCaptionMenuValue(track),
    );
    expect(new Set(menuValues).size).toBe(menuValues.length);
  });

  it("converts AniZone ASS captions to WebVTT", () => {
    const vtt = convertAssToVtt(
      "[Events]\nDialogue: 0,0:00:01.20,0:00:03.45,Default,,0,0,0,,{\\an8}Hello\\Nworld",
    );

    expect(vtt).toBe("WEBVTT\n\n00:00:01.200 --> 00:00:03.450\nHello\nworld\n");
  });

  it("serves ASS subtitle URLs through the VTT caption endpoint", () => {
    expect(
      buildScrapePlayUrl({
        url: "https://cdn.example/subtitles.ass?token=x",
      }),
    ).toMatch(/\/captions\.vtt$/);
  });

  it("converts extensionless AnimeOnsen ASS tracks through the VTT endpoint", () => {
    const [track] = buildScrapeSubtitleTracks(
      [
        {
          lang: "en-US",
          url: "https://api.animeonsen.xyz/v4/subtitles/title/en-US/1",
          format: "ass",
        },
      ],
      "https://www.animeonsen.xyz",
    );

    expect(track?.type).toBe("vtt");
    expect(track?.src).toMatch(/\/captions\.vtt$/);
  });

  it("keeps the scrape referer on proxied subtitle tracks", () => {
    const tracks = buildScrapeSubtitleTracks(
      [
        {
          lang: "English",
          url: "https://subst.krussdomi.com/show/en.vtt",
          format: "vtt",
        },
      ],
      "https://krussdomi.com/",
    );

    const token = tracks[0]?.src.match(/\/api\/scrape\/play\/([^/]+)\//)?.[1];
    expect(token).toBeTruthy();
    const decoded = decodeScrapePlaybackToken(token ?? "");
    expect(decoded?.referer).toBe("https://krussdomi.com/");
  });

  it("prefers each track's donor referer over the playing stream referer", () => {
    const tracks = buildScrapeSubtitleTracks(
      [
        {
          lang: "en-US",
          url: "https://api.animeonsen.xyz/v4/subtitles/title/en-US/1",
          format: "ass",
          referer: "https://www.animeonsen.xyz",
          source: "AnimeOnsen",
        },
      ],
      "https://krussdomi.com/",
    );

    expect(tracks[0]?.label).toBe("en-US · AnimeOnsen");
    expect(tracks[0]?.type).toBe("vtt");
    const token = tracks[0]?.src.match(/\/api\/scrape\/play\/([^/]+)\//)?.[1];
    expect(token).toBeTruthy();
    const decoded = decodeScrapePlaybackToken(token ?? "");
    expect(decoded?.referer).toBe("https://www.animeonsen.xyz");
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
