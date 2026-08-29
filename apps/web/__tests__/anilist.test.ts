import {
  ANIME_BROWSE_PATH,
  buildAniListUrl,
  requiresAdultAniListContent,
} from "@/lib/anilist";
import { describe, expect, test } from "vitest";

describe("AniList URL helpers", () => {
  test("builds the default anime browse URL without query params", () => {
    expect(buildAniListUrl({})).toBe(ANIME_BROWSE_PATH);
  });

  test("builds filtered anime URLs with sort params", () => {
    expect(buildAniListUrl({ medium: "ANIME", sort: "POPULARITY_DESC" })).toBe(
      "/anime?sort=POPULARITY_DESC",
    );
  });

  test("preserves filter and page params on filtered anime URLs", () => {
    expect(
      buildAniListUrl({
        medium: "ANIME",
        sort: "SCORE_DESC",
        query: "frieren",
        genres: ["Adventure", "Fantasy"],
        page: 2,
      }),
    ).toBe(
      "/anime?sort=SCORE_DESC&query=frieren&genres=Adventure%2CFantasy&page=2",
    );
  });

  test("does not emit mode=results in anime URLs", () => {
    expect(buildAniListUrl({ genres: ["Hentai"] })).toBe(
      "/anime?genres=Hentai",
    );
    expect(buildAniListUrl({})).not.toContain("mode=results");
  });
});

describe("requiresAdultAniListContent", () => {
  test("returns true when Hentai is selected", () => {
    expect(requiresAdultAniListContent(["Hentai"])).toBe(true);
    expect(requiresAdultAniListContent(["Action", "Hentai"])).toBe(true);
  });

  test("returns false for non-adult genres", () => {
    expect(requiresAdultAniListContent([])).toBe(false);
    expect(requiresAdultAniListContent(["Action", "Romance"])).toBe(false);
  });
});
