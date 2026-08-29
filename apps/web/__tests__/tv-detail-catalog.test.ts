import {
  isAnilistBackedTvRouteId,
  readTvDetailCatalogFromRequestUrl,
  withTvDetailCatalogQuery,
} from "@/lib/tv-detail-catalog";
import { describe, expect, it } from "vitest";

describe("tv detail catalog", () => {
  it("treats bare numeric ids as AniList only on anime catalog", () => {
    expect(isAnilistBackedTvRouteId("154587", "anime")).toBe(true);
    expect(isAnilistBackedTvRouteId("154587", "tvshows")).toBe(false);
    expect(isAnilistBackedTvRouteId("anilist-154587", "tvshows")).toBe(true);
  });

  it("reads anime catalog from API query params", () => {
    expect(
      readTvDetailCatalogFromRequestUrl(
        new URL("http://localhost/api/media/tv/154587/details?catalog=anime"),
      ),
    ).toBe("anime");
  });

  it("appends catalog=anime to client API paths", () => {
    expect(
      withTvDetailCatalogQuery("/api/media/tv/154587/all-seasons", "anime"),
    ).toBe("/api/media/tv/154587/all-seasons?catalog=anime");
  });
});
