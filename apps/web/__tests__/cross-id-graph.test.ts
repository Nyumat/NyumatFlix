import { describe, expect, it } from "vitest";

import {
  resolveAniBridgeAnilistIdForTmdbShow,
  collectAniBridgeAnilistIdsForTmdbShow,
  resolveAniBridgePlaybackCoords,
  resolveAniBridgeTmdbShowIdForAnilist,
} from "@/lib/anime/anibridge-season-segments";
import { overrideMalIdForTmdbShow } from "@/lib/anime/mapping-overrides";

const overflowMappings = {
  "tmdb_show:95897:s1": {
    "anidb:15274:R": { "1-8": "1-8" },
    "anilist:113417": { "1-8": "1-8" },
    "mal:40746": { "1-8": "1-8" },
  },
  "anilist:113417": {
    "tmdb_show:95897:s1": { "1-8": "1-8" },
    "mal:40746": { "1-8": "1-8" },
  },
};

const aotMappings = {
  "tmdb_show:1429:s1": {
    "anilist:16498": { "1-25": "1-25" },
  },
  "tmdb_show:1429:s3": {
    "anilist:99147": { "1-12": "1-12" },
    "anilist:104578": { "13-22": "1-10" },
  },
  "anilist:104578": {
    "tmdb_show:1429:s3": { "1-10": "13-22" },
  },
};

describe("AniBridge TMDB ↔ AniList graph", () => {
  it("resolves Overflow TMDB 95897 to AniList 113417 without title search", () => {
    expect(
      resolveAniBridgeAnilistIdForTmdbShow(overflowMappings, 95897, 1),
    ).toBe(113417);
    expect(resolveAniBridgeAnilistIdForTmdbShow(overflowMappings, 95897)).toBe(
      113417,
    );
    expect(
      resolveAniBridgePlaybackCoords(overflowMappings, 95897, 1, 8),
    ).toEqual({ anilistId: 113417, relativeEpisode: 8 });
    expect(
      collectAniBridgeAnilistIdsForTmdbShow(overflowMappings, 95897),
    ).toEqual([113417]);
  });

  it("reverses Overflow AniList 113417 back to TMDB 95897", () => {
    expect(
      resolveAniBridgeTmdbShowIdForAnilist(overflowMappings, 113417),
    ).toEqual({ tmdbShowId: 95897, seasonNumber: 1 });
  });

  it("picks season 1 for a multi-season TMDB show when season is omitted", () => {
    expect(resolveAniBridgeAnilistIdForTmdbShow(aotMappings, 1429)).toBe(16498);
    expect(resolveAniBridgeAnilistIdForTmdbShow(aotMappings, 1429, 3)).toBe(
      99147,
    );
    expect(collectAniBridgeAnilistIdsForTmdbShow(aotMappings, 1429)).toEqual([
      16498, 99147, 104578,
    ]);
  });

  it("reverses a split-cour AniList id to its TMDB season, not season 1", () => {
    expect(resolveAniBridgeTmdbShowIdForAnilist(aotMappings, 104578)).toEqual({
      tmdbShowId: 1429,
      seasonNumber: 3,
    });
  });

  it("does not invent an AniList id for Secret Mission (no graph row)", () => {
    expect(
      resolveAniBridgeAnilistIdForTmdbShow(overflowMappings, 233643, 1),
    ).toBeNull();
    expect(overrideMalIdForTmdbShow(233643)).toBe(56497);
    expect(overrideMalIdForTmdbShow(95897)).toBeNull();
  });
});
