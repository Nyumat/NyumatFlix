import { describe, expect, it } from "vitest";

import {
  resolveAniBridgeSubtitleTmdbLookup,
  resolveFribbSubtitleTmdbLookup,
} from "@/lib/scrape/anime/resolve-subtitle-tmdb-lookup";

describe("anime subtitle TMDB lookup", () => {
  it("resolves Fribb reverse lookups for split TMDB seasons", () => {
    const rows = [
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
    ];

    expect(resolveFribbSubtitleTmdbLookup(rows, 100240, 1)).toEqual({
      mediaType: "tv",
      tmdbId: 61374,
      seasonNumber: 3,
      episodeNumber: 1,
    });
    expect(resolveFribbSubtitleTmdbLookup(rows, 102351, 1)).toEqual({
      mediaType: "tv",
      tmdbId: 61374,
      seasonNumber: 3,
      episodeNumber: 13,
    });
  });

  it("resolves AniBridge reverse lookups with forward validation", () => {
    const mappings = {
      "tmdb_show:46298:s2": {
        "anilist:11061": { "63-136": "63-136" },
      },
    };

    expect(resolveAniBridgeSubtitleTmdbLookup(mappings, 11061, 131)).toEqual({
      mediaType: "tv",
      tmdbId: 46298,
      seasonNumber: 2,
      episodeNumber: 131,
    });
  });
});
