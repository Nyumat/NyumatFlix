import { describe, expect, it } from "vitest";

import { findMatchingOnsenResult } from "@/lib/scrape/anime/providers/animeonsen";

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
});
