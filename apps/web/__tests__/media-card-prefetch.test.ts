import { shouldWarmAnimeDetailApis } from "@/hooks/use-media-card-prefetch";
import { describe, expect, it } from "vitest";

describe("shouldWarmAnimeDetailApis", () => {
  it("warms anime detail apis for fribb-backed anilist routes", () => {
    expect(
      shouldWarmAnimeDetailApis("/anime/anilist-11061", "anilist-11061"),
    ).toBe(true);
    expect(shouldWarmAnimeDetailApis("/anime/21", "anilist-21")).toBe(true);
  });

  it("still warms tmdb tv/movie cards", () => {
    expect(shouldWarmAnimeDetailApis("/tvshows/1396", 1396)).toBe(true);
    expect(shouldWarmAnimeDetailApis("/movies/550", 550)).toBe(true);
    expect(shouldWarmAnimeDetailApis("/anime/tmdb-45790", "tmdb-45790")).toBe(
      true,
    );
  });
});
