import { describe, expect, it } from "vitest";

import { buildSeasonIndex } from "@/lib/anime/season-segment-merge";
import { seasonIndexLookupKey } from "@/lib/anime/season-index-types";

describe("buildSeasonIndex", () => {
  it("merges AniBridge and Fribb segments for a split-cour TMDB season", () => {
    const index = buildSeasonIndex({
      mappings: {
        "tmdb_show:1429:s4": {
          "anilist:110277": { "1-16": "1-16" },
          "anilist:131681": { "17-28": "1-12" },
        },
      },
      fribbRows: [
        {
          anilist_id: 146984,
          themoviedb_id: { tv: 1429 },
          season: { tmdb: 4 },
          episode_offset: { tmdb: 28 },
        },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(index.version).toBe(1);
    expect(index.entries[seasonIndexLookupKey(1429, 4)]).toEqual({
      source: "anibridge",
      segments: [
        { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
        { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
        { startEpisode: 29, endEpisode: 29, anilistMediaId: 146984 },
        { startEpisode: 30, endEpisode: 30, anilistMediaId: 162314 },
      ],
    });
  });

  it("indexes Fribb-only seasons when AniBridge has no entry", () => {
    const index = buildSeasonIndex({
      mappings: {},
      fribbRows: [
        {
          anilist_id: 100240,
          themoviedb_id: { tv: 61374 },
          season: { tmdb: 3 },
        },
        {
          anilist_id: 102351,
          themoviedb_id: { tv: 61374 },
          season: { tmdb: 3 },
          episode_offset: { tmdb: 12 },
        },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(index.entries[seasonIndexLookupKey(61374, 3)]).toEqual({
      source: "fribb",
      segments: [
        { startEpisode: 1, endEpisode: 12, anilistMediaId: 100240 },
        { startEpisode: 13, endEpisode: 13, anilistMediaId: 102351 },
      ],
    });
  });
});
