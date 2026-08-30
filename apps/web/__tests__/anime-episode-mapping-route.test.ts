import { describe, expect, it } from "vitest";

import { resolveAnimeEpisodeMappingTmdbShowId } from "@/lib/anime/resolve-coords-tmdb-show-id";

describe("anime episode mapping route ids", () => {
  it("uses mapped TMDB id for /anime/16498 instead of the route id", () => {
    expect(resolveAnimeEpisodeMappingTmdbShowId("16498", 16498, 1429)).toBe(
      1429,
    );
  });

  it("returns null for bare AniList routes without a TMDB mapping", () => {
    expect(
      resolveAnimeEpisodeMappingTmdbShowId("16498", 16498, null),
    ).toBeNull();
    expect(resolveAnimeEpisodeMappingTmdbShowId("9936", 9936, null)).toBeNull();
    expect(
      resolveAnimeEpisodeMappingTmdbShowId("anilist-16498", 16498, null),
    ).toBeNull();
  });

  it("uses the numeric route id on TMDB tv pages", () => {
    expect(resolveAnimeEpisodeMappingTmdbShowId("1429", null, null)).toBe(1429);
  });
});
