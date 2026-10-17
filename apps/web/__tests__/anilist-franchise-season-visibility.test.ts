import { describe, expect, it } from "vitest";

import {
  collectEpisodeNumbers,
  isBrowsableFranchiseSeason,
} from "@/lib/anilist-tv-detail";

describe("isBrowsableFranchiseSeason", () => {
  it("hides announced seasons with no episode list yet", () => {
    const unreleased = {
      id: 209939,
      type: "ANIME" as const,
      format: "TV",
      status: "NOT_YET_RELEASED",
      episodes: null,
      title: { english: "Frieren: Beyond Journey's End Season 3" },
    };

    expect(collectEpisodeNumbers(unreleased)).toEqual([]);
    expect(isBrowsableFranchiseSeason(unreleased)).toBe(false);
  });

  it("keeps finished seasons with a declared episode count", () => {
    const released = {
      id: 182255,
      type: "ANIME" as const,
      format: "TV",
      status: "FINISHED",
      episodes: 10,
      title: { english: "Frieren: Beyond Journey's End Season 2" },
    };

    expect(isBrowsableFranchiseSeason(released)).toBe(true);
  });

  it("keeps currently airing seasons when only the schedule is populated", () => {
    const airing = {
      id: 1,
      type: "ANIME" as const,
      format: "TV",
      status: "RELEASING",
      episodes: null,
      nextAiringEpisode: { episode: 3 },
      title: { english: "Show" },
    };

    expect(isBrowsableFranchiseSeason(airing)).toBe(true);
  });
});
