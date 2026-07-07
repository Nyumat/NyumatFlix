import { stripSeasonSuffix } from "@/lib/anilist-franchise";
import { describe, expect, it } from "vitest";

describe("stripSeasonSuffix", () => {
  it("removes trailing season labels from titles", () => {
    expect(
      stripSeasonSuffix(
        "The 100 Girlfriends Who Really, Really, Really, Really, REALLY Love You Season 3",
      ),
    ).toBe(
      "The 100 Girlfriends Who Really, Really, Really, Really, REALLY Love You",
    );
    expect(stripSeasonSuffix("Frieren: Beyond Journey's End 2nd Season")).toBe(
      "Frieren: Beyond Journey's End",
    );
  });
});
