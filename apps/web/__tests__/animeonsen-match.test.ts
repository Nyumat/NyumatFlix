import { describe, expect, it } from "vitest";

import { buildAnimeSearchContext } from "@/lib/scrape/anime/anilist-meta";
import { findMatchingOnsenResult } from "@/lib/scrape/anime/providers/animeonsen";

const AOT_CATALOG_ROWS = [
  {
    content_id: "6PGE1LU1INC9XAQf",
    content_title: "Shingeki no Kyojin",
    content_title_en: "Attack on Titan",
  },
  {
    content_id: "U5kY5o4cKsfrDpuM",
    content_title: "Shingeki no Kyojin Season 3",
    content_title_en: "Attack on Titan Season 3",
  },
  {
    content_id: "C0jn3ssdhKxigmKa",
    content_title: "Shingeki no Kyojin Season 3 Part 2",
    content_title_en: "Attack on Titan Season 3 Part 2",
  },
];

describe("AnimeOnsen title matching", () => {
  it("rejects unrelated fuzzy search results", () => {
    expect(
      findMatchingOnsenResult(
        [
          {
            content_id: "wrong",
            content_title: "Okashi na Tensei",
            content_title_en: "Sweet Reincarnation",
          },
        ],
        ["Adam's Sweet Agony", "Modaete yo, Adam-kun"],
      ),
    ).toBeUndefined();
  });

  it("accepts an exact normalized English or Romaji title", () => {
    expect(
      findMatchingOnsenResult(
        [
          {
            content_id: "correct",
            content_title: "Modaete yo, Adam-kun",
            content_title_en: "Adam's Sweet Agony",
          },
        ],
        ["Adam's Sweet Agony", "Modaete yo, Adam-kun"],
      )?.content_id,
    ).toBe("correct");
  });

  it("accepts romaji spacing variants after strict match fails", () => {
    expect(
      findMatchingOnsenResult(
        [
          {
            content_id: "hanaori",
            content_title: "Hanaori-san wa Tensei shitemo Kenka ga Shitai",
            content_title_en:
              "Hanaori-san Still Wants to Fight in the Next Life",
          },
        ],
        ["Hanaori-san wa Tensei Shite mo Kenka ga Shitai"],
      )?.content_id,
    ).toBe("hanaori");
  });

  it("matches the season-specific entry, not the base show, for later seasons", () => {
    // Regression: AOT S3 Part 2 (AniList 104578). Matching against the
    // generic route query "Attack on Titan" picked the Season 1 entry and
    // played episode 9 of Season 1 instead of Part 2 ep 9 (= S3E21).
    const { matchTitles } = buildAnimeSearchContext("Attack on Titan", [
      "Attack on Titan Season 3 Part 2",
      "Shingeki no Kyojin Season 3 Part 2",
    ]);

    expect(matchTitles).not.toContain("Attack on Titan");
    expect(
      findMatchingOnsenResult(AOT_CATALOG_ROWS, matchTitles)?.content_id,
    ).toBe("C0jn3ssdhKxigmKa");
  });

  it("falls back to the query for matching when AniList has no titles", () => {
    const { matchTitles } = buildAnimeSearchContext("Attack on Titan", []);

    expect(matchTitles).toEqual(["Attack on Titan"]);
    expect(
      findMatchingOnsenResult(AOT_CATALOG_ROWS, matchTitles)?.content_id,
    ).toBe("6PGE1LU1INC9XAQf");
  });
});

describe("buildAnimeSearchContext", () => {
  it("keeps the generic query as a search keyword but not a match title", () => {
    const context = buildAnimeSearchContext("Attack on Titan", [
      "Attack on Titan Season 3 Part 2",
      "Shingeki no Kyojin Season 3 Part 2",
    ]);

    expect(context.searchQueries).toEqual([
      "Attack on Titan Season 3 Part 2",
      "Shingeki no Kyojin Season 3 Part 2",
      "Attack on Titan",
    ]);
    expect(context.matchTitles).toEqual([
      "Attack on Titan Season 3 Part 2",
      "Shingeki no Kyojin Season 3 Part 2",
    ]);
  });

  it("dedupes when the query equals an AniList title", () => {
    const context = buildAnimeSearchContext("Frieren: Beyond Journey's End", [
      "Frieren: Beyond Journey's End",
      "Sousou no Frieren",
    ]);

    expect(context.searchQueries).toEqual([
      "Frieren: Beyond Journey's End",
      "Sousou no Frieren",
    ]);
    expect(context.matchTitles).toEqual([
      "Frieren: Beyond Journey's End",
      "Sousou no Frieren",
    ]);
  });

  it("returns empty lists when there is nothing to search with", () => {
    const context = buildAnimeSearchContext(undefined, []);

    expect(context.searchQueries).toEqual([]);
    expect(context.matchTitles).toEqual([]);
  });
});
