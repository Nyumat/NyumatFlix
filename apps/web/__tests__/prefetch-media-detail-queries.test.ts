import { describe, expect, it } from "vitest";
import { resolveInitialTvSeasonNumber } from "@/lib/resolve-initial-tv-season";
import type { TvShowDetails } from "@/lib/domain/typings";

describe("resolveInitialTvSeasonNumber", () => {
  it("prefers the requested season when it exists on the show", () => {
    const details = {
      seasons: [
        { season_number: 1, episode_count: 25 },
        { season_number: 2, episode_count: 12 },
      ],
    } as TvShowDetails;

    expect(resolveInitialTvSeasonNumber(details, 2)).toBe(2);
  });

  it("falls back to the first regular season", () => {
    const details = {
      seasons: [
        { season_number: 0, episode_count: 1 },
        { season_number: 3, episode_count: 12 },
      ],
    } as TvShowDetails;

    expect(resolveInitialTvSeasonNumber(details, null)).toBe(3);
  });
});
