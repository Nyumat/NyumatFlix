import { describe, expect, it } from "vitest";

import {
  buildSub1x2SubtitleApiUrl,
  parseSub1x2SubtitleEntries,
  resolveSub1x2SubtitleUrl,
} from "@/lib/scrape/subtitles";

describe("sub1x2 subtitles", () => {
  it("builds movie and tv API URLs", () => {
    expect(buildSub1x2SubtitleApiUrl({ mediaType: "movie", tmdbId: 550 })).toBe(
      "https://sub.1x2.space/api/movie/550",
    );

    expect(
      buildSub1x2SubtitleApiUrl({
        mediaType: "tv",
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 3,
      }),
    ).toBe("https://sub.1x2.space/api/tv/1399/1/3");
  });

  it("defaults tv season and episode to 1", () => {
    expect(buildSub1x2SubtitleApiUrl({ mediaType: "tv", tmdbId: 1399 })).toBe(
      "https://sub.1x2.space/api/tv/1399/1/1",
    );
  });

  it("resolves relative subtitle URLs", () => {
    expect(resolveSub1x2SubtitleUrl("/subs/en.vtt")).toBe(
      "https://sub.1x2.space/subs/en.vtt",
    );
    expect(resolveSub1x2SubtitleUrl("subs/en.vtt")).toBe(
      "https://sub.1x2.space/subs/en.vtt",
    );
    expect(resolveSub1x2SubtitleUrl("https://cdn.example/en.vtt")).toBe(
      "https://cdn.example/en.vtt",
    );
  });

  it("builds URLs for anime TMDB softsub lookups", () => {
    expect(
      buildSub1x2SubtitleApiUrl({
        mediaType: "tv",
        tmdbId: 94664,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe("https://sub.1x2.space/api/tv/94664/1/1");
    expect(
      buildSub1x2SubtitleApiUrl({
        mediaType: "tv",
        tmdbId: 13916,
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBe("https://sub.1x2.space/api/tv/13916/1/1");
  });

  it("normalizes bogus .wtt Tym URLs to .vtt", () => {
    const [track] = parseSub1x2SubtitleEntries([
      {
        label: "Slovak",
        url: "https://sub.1x2.space/subtitle/tv/125988/1/1/Slovak - Slovak.wtt",
      },
    ]);

    expect(track?.url).toBe(
      "https://sub.1x2.space/subtitle/tv/125988/1/1/Slovak - Slovak.vtt",
    );
    expect(track?.format).toBe("vtt");
  });

  it("drops entries without a subtitle extension and trims whitespace", () => {
    const tracks = parseSub1x2SubtitleEntries([
      { label: "English", url: "https://cdn.example/en.txt" },
      { label: "French", url: "  https://cdn.example/fr.vtt  " },
      { label: "German", url: "" },
      { url: "https://cdn.example/de.srt" },
      { label: "Arabic", url: "https://cdn.example/ar.ass" },
    ]);

    expect(tracks.map((track) => track.url)).toEqual([
      "https://cdn.example/fr.vtt",
      "https://cdn.example/de.srt",
      "https://cdn.example/ar.ass",
    ]);
    expect(tracks[1]?.format).toBe("srt");
    expect(tracks[2]?.format).toBe("ass");
  });

  it("drops sub1x2 entries it failed to fetch, keeps cached ones", () => {
    const tracks = parseSub1x2SubtitleEntries([
      {
        label: "Arabic",
        url: "/subtitle/tv/125988/1/1/Arabic.vtt",
        status: "cached",
      },
      {
        label: "Arabic - Arabic",
        url: "/subtitle/tv/125988/1/1/Arabic - Arabic.vtt",
        status: "failed",
      },
      // No status (older API shape) — keep for backwards compat.
      { label: "English", url: "/subtitle/tv/125988/1/1/English.vtt" },
    ]);

    expect(tracks.map((track) => track.url)).toEqual([
      "https://sub.1x2.space/subtitle/tv/125988/1/1/Arabic.vtt",
      "https://sub.1x2.space/subtitle/tv/125988/1/1/English.vtt",
    ]);
  });
});
