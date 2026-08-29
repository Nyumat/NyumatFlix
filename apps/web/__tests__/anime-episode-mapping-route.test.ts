import { describe, expect, it } from "vitest";

const resolveCoordsTmdbShowId = (
  routeId: string,
  defaultAnilistId: number | null,
  playbackTmdbTvId: number | null,
): number | null => {
  if (!defaultAnilistId) {
    const numeric = Number(routeId);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
  }

  const tmdbShowId =
    typeof playbackTmdbTvId === "number" && playbackTmdbTvId > 0
      ? playbackTmdbTvId
      : Number(routeId);

  if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) {
    return null;
  }

  if (
    defaultAnilistId > 0 &&
    tmdbShowId === defaultAnilistId &&
    playbackTmdbTvId == null
  ) {
    return null;
  }

  return tmdbShowId;
};

describe("anime episode mapping route ids", () => {
  it("uses mapped TMDB id for /anime/16498 instead of the route id", () => {
    expect(resolveCoordsTmdbShowId("16498", 16498, 1429)).toBe(1429);
  });

  it("stays pending when anime route id would leak into TMDB coords", () => {
    expect(resolveCoordsTmdbShowId("16498", 16498, null)).toBeNull();
  });

  it("uses the numeric route id on TMDB tv pages", () => {
    expect(resolveCoordsTmdbShowId("1429", null, null)).toBe(1429);
  });
});
