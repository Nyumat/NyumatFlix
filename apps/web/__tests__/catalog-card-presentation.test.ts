import { describe, expect, it } from "vitest";

import {
  buildCardHoverPreviewId,
  carouselItemClassName,
  catalogGridTileImageClassName,
  filterCatalogCardArt,
  hasCatalogCardArt,
  readCardPreviewSource,
  readImdbIdForPreview,
} from "@/lib/catalog-card-presentation";
import {
  posterCarouselItemClassName,
  wideCarouselItemClassName,
} from "@/lib/carousel-layout";
import { getDefaultUserSettingsWire } from "@/lib/server/user-settings";

describe("catalog-card-presentation", () => {
  it("filters poster mode by poster_path only", () => {
    const items = [
      { id: 1, poster_path: "/p.jpg", backdrop_path: null },
      { id: 2, poster_path: null, backdrop_path: "/b.jpg" },
    ];

    expect(filterCatalogCardArt(items, "poster")).toEqual([items[0]]);
    expect(hasCatalogCardArt(items[1], "poster")).toBe(false);
  });

  it("filters backdrop mode by poster or backdrop", () => {
    const items = [
      { id: 1, poster_path: null, backdrop_path: "/b.jpg" },
      { id: 2, poster_path: "/p.jpg", backdrop_path: null },
      { id: 3, poster_path: null, backdrop_path: null },
    ];

    expect(filterCatalogCardArt(items, "backdrop")).toEqual([
      items[0],
      items[1],
    ]);
    expect(hasCatalogCardArt(items[2], "backdrop")).toBe(false);
  });

  it("returns wide carousel classes in backdrop mode", () => {
    expect(carouselItemClassName("poster")).toBe(posterCarouselItemClassName);
    expect(carouselItemClassName("backdrop")).toBe(wideCarouselItemClassName);
  });

  it("returns grid tile skeleton classes per catalog card style", () => {
    expect(catalogGridTileImageClassName("poster")).toContain("aspect-poster");
    expect(catalogGridTileImageClassName("poster")).toContain(
      "catalog-grid-tile-skeleton",
    );
    expect(catalogGridTileImageClassName("backdrop")).toContain("aspect-video");
    expect(catalogGridTileImageClassName("backdrop")).toContain("rounded-lg");
  });

  it("reads imdb id from external_ids or root field", () => {
    expect(
      readImdbIdForPreview({
        external_ids: { imdb_id: "tt1234567" },
      }),
    ).toBe("tt1234567");
    expect(readImdbIdForPreview({ imdb_id: "nm999" })).toBeUndefined();
    expect(readImdbIdForPreview({ imdb_id: "tt9990000" })).toBe("tt9990000");
  });

  it("builds stable hover preview ids", () => {
    expect(buildCardHoverPreviewId({ mediaType: "movie", id: 42 })).toBe(
      "movie-42",
    );
  });

  describe("readCardPreviewSource", () => {
    it("treats a plain TMDB item as a stream source by TMDB id", () => {
      expect(readCardPreviewSource({ id: 550, media_type: "movie" })).toEqual({
        kind: "stream",
        tmdbId: 550,
        mediaType: "movie",
      });
    });

    it("prefers an explicit imdb id over the TMDB id", () => {
      expect(
        readCardPreviewSource({
          id: 550,
          media_type: "movie",
          imdb_id: "tt0137523",
        }),
      ).toEqual({
        kind: "stream",
        imdbId: "tt0137523",
        tmdbId: 550,
        mediaType: "movie",
      });
    });

    it("does not treat an unresolved AniList id as a TMDB id", () => {
      // AniList fallback with no imdb and no youtube key has no preview.
      expect(
        readCardPreviewSource({
          id: 21,
          media_type: "tv",
          isAniListFallback: true,
        }),
      ).toBeUndefined();
    });

    it("uses the YouTube trailer for an AniList fallback", () => {
      expect(
        readCardPreviewSource({
          id: 21,
          media_type: "tv",
          isAniListFallback: true,
          youtube_trailer_key: "RIyb52EMx8c",
        }),
      ).toEqual({ kind: "youtube", youtubeKey: "RIyb52EMx8c" });
    });

    it("uses the IMDb id attached to an AniList fallback", () => {
      expect(
        readCardPreviewSource({
          id: 21,
          media_type: "tv",
          isAniListFallback: true,
          imdb_id: "tt0388629",
        }),
      ).toEqual({
        kind: "stream",
        imdbId: "tt0388629",
        mediaType: "tv",
      });
    });

    it("returns undefined for non-objects", () => {
      expect(readCardPreviewSource(null)).toBeUndefined();
      expect(readCardPreviewSource("x")).toBeUndefined();
    });
  });

  it("defaults catalogCardStyle to backdrop in user settings wire", () => {
    expect(getDefaultUserSettingsWire().catalogCardStyle).toBe("backdrop");
  });
});
