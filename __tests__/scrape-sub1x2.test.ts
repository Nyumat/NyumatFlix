import { describe, expect, it } from "vitest";

import {
  buildSub1x2SubtitleApiUrl,
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
});
