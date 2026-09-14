import { describe, expect, it } from "vitest";

import { COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID } from "@/lib/analytics/community-watching-exclusions";
import {
  isExcludedPopularContentPath,
  parsePopularContentPath,
} from "@/lib/analytics/popular-content-path";

describe("parsePopularContentPath", () => {
  it("parses movie detail paths", () => {
    expect(parsePopularContentPath("/movies/969681")).toEqual({
      variant: "tmdb",
      mediaType: "movie",
      id: 969681,
      href: "/movies/969681",
    });
  });

  it("parses tv and numeric anime detail paths as tv", () => {
    expect(parsePopularContentPath("/tvshows/233643")).toEqual({
      variant: "tmdb",
      mediaType: "tv",
      id: 233643,
      href: "/tvshows/233643",
    });
    expect(parsePopularContentPath("/anime/42")).toEqual({
      variant: "tmdb",
      mediaType: "tv",
      id: 42,
      href: "/anime/42",
    });
  });

  it("parses anilist slugs", () => {
    expect(parsePopularContentPath("/anime/anilist-169728")).toEqual({
      variant: "anilist",
      anilistId: 169728,
      href: "/anime/anilist-169728",
    });
    expect(parsePopularContentPath("/tvshows/anilist-113417")).toEqual({
      variant: "anilist",
      anilistId: 113417,
      href: "/anime/anilist-113417",
    });
  });

  it("rejects browse, watch, and malformed paths", () => {
    expect(parsePopularContentPath("/movies/browse")).toBeNull();
    expect(parsePopularContentPath("/movies/watch/123")).toBeNull();
    expect(parsePopularContentPath("/movies/abc")).toBeNull();
    expect(parsePopularContentPath("/")).toBeNull();
  });

  it("excludes only Secret Mission (TMDB tv id)", () => {
    const secretMission = parsePopularContentPath(
      `/tvshows/${COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID}`,
    );
    expect(secretMission).not.toBeNull();
    expect(isExcludedPopularContentPath(secretMission!)).toBe(true);

    const anilist = parsePopularContentPath("/anime/anilist-169728");
    expect(anilist).not.toBeNull();
    expect(isExcludedPopularContentPath(anilist!)).toBe(false);
  });
});
