import { buildAniListUrl } from "@/lib/anilist";
import { describe, expect, test } from "vitest";

describe("AniList URL helpers", () => {
  test("builds the default canonical anime results URL", () => {
    expect(buildAniListUrl({})).toBe("/anime?mode=results");
  });

  test("builds canonical anime results URLs with sort params", () => {
    expect(buildAniListUrl({ medium: "ANIME", sort: "POPULARITY_DESC" })).toBe(
      "/anime?sort=POPULARITY_DESC&mode=results",
    );
  });

  test("preserves filter and page params on canonical results URLs", () => {
    expect(
      buildAniListUrl({
        medium: "ANIME",
        sort: "SCORE_DESC",
        query: "frieren",
        genres: ["Adventure", "Fantasy"],
        page: 2,
      }),
    ).toBe(
      "/anime?sort=SCORE_DESC&query=frieren&genres=Adventure%2CFantasy&page=2&mode=results",
    );
  });

  test("does not emit legacy anime browse URLs", () => {
    expect(buildAniListUrl({})).not.toContain("/anime/browse");
  });
});
