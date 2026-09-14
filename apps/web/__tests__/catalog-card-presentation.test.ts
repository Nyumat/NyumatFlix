import { describe, expect, it } from "vitest";

import {
  buildCardHoverPreviewId,
  carouselItemClassName,
  catalogGridTileImageClassName,
  filterCatalogCardArt,
  hasCatalogCardArt,
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

  it("defaults catalogCardStyle to backdrop in user settings wire", () => {
    expect(getDefaultUserSettingsWire().catalogCardStyle).toBe("backdrop");
  });
});
