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
});
