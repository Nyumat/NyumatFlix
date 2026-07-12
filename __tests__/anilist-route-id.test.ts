import {
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
  normalizeAnilistTvRouteSlug,
  resolveAnilistIdFromTvRoute,
  toAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { describe, expect, it } from "vitest";

describe("anilist route ids", () => {
  it("encodes AniList ids as tv route slugs", () => {
    expect(toAnilistTvRouteSlug(188)).toBe("anilist-188");
    expect(buildAnilistTvDetailHref(188)).toBe("/tvshows/anilist-188");
    expect(buildAnilistTvDetailHref(200637, { season: 3 })).toBe(
      "/tvshows/anilist-200637?season=3",
    );
  });

  it("decodes AniList tv route slugs", () => {
    expect(isAnilistTvRouteId("anilist-188")).toBe(true);
    expect(fromAnilistTvRouteId("anilist-188")).toBe(188);
    expect(resolveAnilistIdFromTvRoute("anilist-188")).toBe(188);
  });

  it("normalizes legacy negative ids to slugs", () => {
    expect(isAnilistTvRouteId("-188")).toBe(true);
    expect(normalizeAnilistTvRouteSlug("-188")).toBe("anilist-188");
    expect(fromAnilistTvRouteId("-188")).toBe(188);
  });

  it("keeps positive TMDB route ids separate", () => {
    expect(isAnilistTvRouteId("85937")).toBe(false);
    expect(resolveAnilistIdFromTvRoute("85937", 101922)).toBe(101922);
    expect(resolveAnilistIdFromTvRoute("85937")).toBeNull();
  });
});
