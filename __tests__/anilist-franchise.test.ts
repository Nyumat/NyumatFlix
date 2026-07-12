import {
  areAnimeFranchiseTitlesCompatible,
  stripSeasonSuffix,
} from "@/lib/anilist-franchise";
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

describe("areAnimeFranchiseTitlesCompatible", () => {
  it("keeps titled sequel seasons in the same chain", () => {
    expect(
      areAnimeFranchiseTitlesCompatible(
        { english: "Jujutsu Kaisen" },
        { english: "Jujutsu Kaisen 2nd Season" },
      ),
    ).toBe(true);
  });

  it("rejects an unrelated AniList sequel relation", () => {
    expect(
      areAnimeFranchiseTitlesCompatible(
        { english: "One Piece", romaji: "ONE PIECE" },
        {
          english: "MONSTERS: 103 Mercies Dragon Damnation",
          romaji: "MONSTERS: Ippyaku Sanjou Hiryuu Jigoku",
        },
      ),
    ).toBe(false);
  });
});
