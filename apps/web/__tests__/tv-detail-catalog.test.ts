import {
  isAnilistBackedTvRouteId,
  readTvDetailCatalogFromRequestUrl,
  resolveAnimePrefetchRouteId,
  resolveTvDetailCatalogFromHref,
  toAnimeApiId,
  toTvApiRouteId,
  withPageTvApiPath,
  withTvApiRouteId,
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

  it("prefixes bare anime catalog ids so they cannot collide with TMDB", () => {
    expect(toTvApiRouteId("11757", "anime")).toBe("anilist-11757");
    expect(toTvApiRouteId("anilist-11757", "tvshows")).toBe("anilist-11757");
    expect(toTvApiRouteId("11757", "tvshows")).toBe("11757");
    expect(toTvApiRouteId("tmdb-45790", "anime")).toBe("tmdb-45790");
  });

  it("maps AniList route ids onto /api/anime ids", () => {
    expect(toAnimeApiId("11757")).toBe("11757");
    expect(toAnimeApiId("anilist-11757")).toBe("11757");
    expect(toAnimeApiId("tmdb-45790")).toBeNull();
  });

  it("rewrites anime catalog tv API paths onto /api/anime", () => {
    expect(withTvApiRouteId("/api/tv/11757/season/2", "anime")).toBe(
      "/api/anime/11757/season/2",
    );
    expect(withTvApiRouteId("/api/tv/anilist-11757/season/2", "anime")).toBe(
      "/api/anime/11757/season/2",
    );
    expect(withTvApiRouteId("/api/tv/tmdb-45790/season/1", "anime")).toBe(
      "/api/tv/45790/season/1",
    );
    expect(withTvApiRouteId("/api/media/tv/11757/above-fold", "anime")).toBe(
      "/api/media/tv/anilist-11757/above-fold?catalog=anime",
    );
  });

  it("resolves prefetch ids from /anime hrefs", () => {
    expect(resolveAnimePrefetchRouteId("/anime/20021")).toBe("anilist-20021");
    expect(resolveAnimePrefetchRouteId("/anime/tmdb-45790")).toBe("tmdb-45790");
    expect(resolveAnimePrefetchRouteId("/tvshows/11757")).toBeNull();
  });

  it("resolves catalog from detail hrefs", () => {
    expect(resolveTvDetailCatalogFromHref("/anime/20021")).toBe("anime");
    expect(resolveTvDetailCatalogFromHref("/tvshows/11757")).toBe("tvshows");
    expect(resolveTvDetailCatalogFromHref("/movies/550")).toBeNull();
  });

  it("picks /api/anime vs /api/tv from the page URL namespace", () => {
    expect(withPageTvApiPath("/api/tv/11757/season/2", "/anime/11757")).toBe(
      "/api/anime/11757/season/2",
    );
    expect(withPageTvApiPath("/api/tv/11757/season/2", "/tvshows/11757")).toBe(
      "/api/tv/11757/season/2",
    );
    expect(
      withPageTvApiPath("/api/tv/45790/season/1", "/anime/tmdb-45790"),
    ).toBe("/api/tv/45790/season/1");
  });
});
