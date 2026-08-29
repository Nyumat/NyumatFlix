import { describe, expect, it } from "vitest";
import {
  formatAnimeSeasonLabel,
  getAnimeSeasonContext,
  getAniListSeasonForMonth,
  getFeaturedSeason,
} from "@/lib/anime-season";

describe("anime-season", () => {
  it("maps June to Spring broadcast season with Summer featured slate", () => {
    const context = getAnimeSeasonContext(new Date("2026-06-09T12:00:00Z"));

    expect(context.currentSeason).toBe("SPRING");
    expect(context.currentLabel).toBe("Spring 2026");
    expect(context.featuredSeason).toBe("SUMMER");
    expect(context.featuredLabel).toBe("Summer 2026");
  });

  it("features the in-season slate during mid-season months", () => {
    expect(getFeaturedSeason(8, 2026)).toEqual({
      season: "SUMMER",
      year: 2026,
    });
    expect(getAniListSeasonForMonth(8)).toBe("SUMMER");
    expect(formatAnimeSeasonLabel("SUMMER", 2026)).toBe("Summer 2026");
  });
});
