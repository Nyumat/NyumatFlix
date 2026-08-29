import {
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnimeAnilistRouteId,
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
  parseAnimeAnilistRouteId,
  resolveAnilistIdFromTvRoute,
  resolveTvDetailRouteId,
  toAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { describe, expect, it } from "vitest";

describe("anilist route ids", () => {
  it("encodes AniList ids as bare anime detail hrefs", () => {
    expect(toAnilistTvRouteSlug(188)).toBe("anilist-188");
    expect(buildAnilistTvDetailHref(188)).toBe("/anime/188");
    expect(buildAnilistTvDetailHref(200637, { season: 3 })).toBe(
      "/anime/200637?season=3",
    );
  });

  it("decodes AniList tv route slugs", () => {
    expect(isAnilistTvRouteId("anilist-188")).toBe(true);
    expect(fromAnilistTvRouteId("anilist-188")).toBe(188);
    expect(resolveAnilistIdFromTvRoute("anilist-188")).toBe(188);
  });

  it("supports bare numeric ids on anime routes", () => {
    expect(isAnimeAnilistRouteId("154587")).toBe(true);
    expect(parseAnimeAnilistRouteId("154587")).toBe(154587);
    expect(fromAnilistTvRouteId("154587")).toBe(154587);
  });

  it("normalizes legacy negative ids to slugs", () => {
    expect(isAnilistTvRouteId("-188")).toBe(true);
    expect(normalizeAnilistTvRouteSlug("-188")).toBe("anilist-188");
    expect(fromAnilistTvRouteId("-188")).toBe(188);
  });

  it("keeps positive TMDB route ids separate from prefixed AniList slugs", () => {
    expect(isAnilistTvRouteId("85937")).toBe(false);
    expect(resolveAnilistIdFromTvRoute("85937", 154587)).toBe(154587);
    expect(resolveAnilistIdFromTvRoute("85937")).toBeNull();
  });

  it("resolves tv detail route id from pathname for anime ids", () => {
    expect(resolveTvDetailRouteId("/tvshows/anilist-113417", 113417)).toBe(
      "anilist-113417",
    );
    expect(resolveTvDetailRouteId("/anime/113417", 113417)).toBe("113417");
    expect(resolveTvDetailRouteId("/tvshows/85937", 85937)).toBe("85937");
    expect(
      resolveTvDetailRouteId("/tvshows/85937?anilistId=154587", 85937),
    ).toBe("85937");
  });
});
