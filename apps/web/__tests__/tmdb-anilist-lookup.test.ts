import { describe, expect, it } from "vitest";

import { buildTmdbAnilistLookup } from "@/lib/anime/tmdb-anilist-lookup";
import type { AniBridgeSeasonMappings } from "@/lib/anime/anibridge-season-segments";
import type { FribbAnimeRow } from "@/lib/fribb-core";
import { TMDB_SHOW_TO_ANILIST_OVERRIDES } from "@/lib/anime/mapping-overrides";

const mappings: AniBridgeSeasonMappings = {
  "tmdb_show:100:s1": {
    "anilist:10": { "1-12": "1-12" },
    "mal:10": { "1-12": "1-12" },
  },
  "tmdb_show:100:s2": {
    "anilist:11": { "1-12": "1-12" },
  },
};

const fribbRows: FribbAnimeRow[] = [
  {
    anilist_id: 10,
    themoviedb_id: { tv: 100 },
    season: { tmdb: 1, tvdb: 1 },
  },
  {
    anilist_id: 20,
    themoviedb_id: { tv: 200 },
    season: { tmdb: 1, tvdb: 1 },
  },
  {
    anilist_id: 21,
    themoviedb_id: { movie: 300 },
  },
];

describe("buildTmdbAnilistLookup", () => {
  it("prefers AniBridge over Fribb for the same season", () => {
    const lookup = buildTmdbAnilistLookup({ mappings, fribbRows });
    expect(lookup.tv["tv:100:s1"]).toBe(10);
    expect(lookup.tv["tv:100:s2"]).toBe(11);
  });

  it("falls back to Fribb rows and movies", () => {
    const lookup = buildTmdbAnilistLookup({ mappings, fribbRows });
    expect(lookup.tv["tv:200:s1"]).toBe(20);
    expect(lookup.movie["300"]).toBe(21);
  });

  it("applies overrides last", () => {
    const lookup = buildTmdbAnilistLookup({
      mappings,
      fribbRows,
      overrides: { ...TMDB_SHOW_TO_ANILIST_OVERRIDES, 200: 99 },
    });
    expect(lookup.tv["tv:200:s1"]).toBe(99);
  });

  it("emits a versioned artifact", () => {
    const lookup = buildTmdbAnilistLookup({ mappings, fribbRows });
    expect(lookup.version).toBe(1);
    expect(typeof lookup.generatedAt).toBe("string");
  });
});
