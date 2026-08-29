import {
  areAnimeFranchiseTitlesCompatible,
  isSeasonChainRelationNode,
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

describe("isSeasonChainRelationNode", () => {
  it("keeps mainline TV seasons in the chain", () => {
    expect(
      isSeasonChainRelationNode({ id: 20958, type: "ANIME", format: "TV" }),
    ).toBe(true);
    expect(
      isSeasonChainRelationNode({ id: 1, type: "ANIME", format: "ONA" }),
    ).toBe(true);
    expect(
      isSeasonChainRelationNode({ id: 2, type: "ANIME", format: null }),
    ).toBe(true);
  });

  it("rejects side-story OVAs marked as PREQUEL of the main series", () => {
    // Attack on Titan: No Regrets (20811) is an OVA that AniList lists as a
    // PREQUEL of Attack on Titan (16498). It must never become the
    // franchise root or a numbered season.
    expect(
      isSeasonChainRelationNode({ id: 20811, type: "ANIME", format: "OVA" }),
    ).toBe(false);
    expect(
      isSeasonChainRelationNode({ id: 3, type: "ANIME", format: "MOVIE" }),
    ).toBe(false);
    expect(
      isSeasonChainRelationNode({ id: 4, type: "ANIME", format: "SPECIAL" }),
    ).toBe(false);
  });
});
