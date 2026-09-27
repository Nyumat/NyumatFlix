import { describe, expect, it } from "vitest";
import {
  applyTmdbImagesToAnimeHubItem,
  isTmdbBackdropPath,
  shouldEnrichAnimeHubCatalogVisuals,
} from "@/lib/anime-hub-catalog-visuals";

describe("shouldEnrichAnimeHubCatalogVisuals", () => {
  it("skips unmapped AniList fallback items", () => {
    expect(
      shouldEnrichAnimeHubCatalogVisuals({
        id: 21519,
        isAniListFallback: true,
        backdrop_path: "https://s4.anilist.co/banner.jpg",
      }),
    ).toBe(false);
  });

  it("enriches mapped items that still use AniList banner urls", () => {
    expect(
      shouldEnrichAnimeHubCatalogVisuals({
        id: 372058,
        media_type: "movie",
        isAniListFallback: false,
        backdrop_path: "https://s4.anilist.co/banner.jpg",
      }),
    ).toBe(true);
  });

  it("skips mapped items that already have a TMDB backdrop", () => {
    expect(
      shouldEnrichAnimeHubCatalogVisuals({
        id: 372058,
        media_type: "movie",
        isAniListFallback: false,
        backdrop_path: "/mMtUybQ6hL24FXo0F3Z4j2KG7kZ.jpg",
      }),
    ).toBe(false);
  });
});

describe("applyTmdbImagesToAnimeHubItem", () => {
  it("prefers localized backdrops but keeps captions visible", () => {
    const enriched = applyTmdbImagesToAnimeHubItem(
      {
        id: 372058,
        media_type: "movie",
        isAniListFallback: false,
        backdrop_path: "https://s4.anilist.co/banner.jpg",
      },
      {
        backdrops: [
          {
            file_path: "/localized.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "en",
            vote_average: 10,
            vote_count: 1,
          },
          {
            file_path: "/textless.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "",
            vote_average: 5,
            vote_count: 1,
          },
        ],
        logos: [],
        posters: [],
        profiles: [],
        id: 372058,
      },
    );

    expect(enriched.backdrop_path).toBe("/localized.jpg");
    expect(enriched.localized_backdrop).toBe(false);
  });

  it("replaces AniList banner urls with a localized TMDB backdrop", () => {
    const enriched = applyTmdbImagesToAnimeHubItem(
      {
        id: 372058,
        media_type: "movie",
        isAniListFallback: false,
        backdrop_path: "https://s4.anilist.co/banner.jpg",
      },
      {
        backdrops: [
          {
            file_path: "/textless.jpg",
            width: 1920,
            height: 1080,
            aspect_ratio: 16 / 9,
            iso_639_1: "",
            vote_average: 5,
            vote_count: 1,
          },
        ],
        logos: [
          {
            file_path: "/your-name-logo.png",
            width: 800,
            height: 200,
            aspect_ratio: 4,
            iso_639_1: "en",
            vote_average: 5,
            vote_count: 1,
          },
        ],
        posters: [],
        profiles: [],
        id: 372058,
      },
    );

    expect(isTmdbBackdropPath(enriched.backdrop_path)).toBe(true);
    expect(enriched.backdrop_path).toBe("/textless.jpg");
    expect(enriched.localized_backdrop).toBe(false);
    expect(enriched.logo).toBeUndefined();
  });
});
