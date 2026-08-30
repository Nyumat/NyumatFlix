import { describe, expect, it } from "vitest";

import {
  resolveAniBridgePlaybackCoords,
  resolveAniBridgeMalPlaybackTarget,
} from "@/lib/anime/anibridge-mappings";
import { mapEpisodeAcrossRanges } from "@/lib/anime/mapping-ranges";
import { relativeEpisodeInSegment } from "@/lib/anime/tmdb-anilist-map";
import { resolveFribbPlaybackCoords } from "@/lib/fribb-mapping";

describe("anime playback mapping", () => {
  it("maps TMDB episode ranges to AniList-relative episodes", () => {
    expect(mapEpisodeAcrossRanges(26, { "26-38": "1-13" })).toBe(1);
    expect(mapEpisodeAcrossRanges(38, { "26-38": "1-13" })).toBe(13);
    expect(mapEpisodeAcrossRanges(382, { "382-407": "382-407" })).toBe(382);
  });

  it("keeps absolute episode numbers for Hunter x Hunter S2E131", () => {
    const hxhSeason2Ranges = { "63-136": "63-136" };

    expect(mapEpisodeAcrossRanges(131, hxhSeason2Ranges)).toBe(131);

    const segment = {
      anilistMediaId: 11061,
      startEpisode: 63,
      endEpisode: 136,
    };
    expect(relativeEpisodeInSegment(segment, 131)).toBe(69);

    const coords = resolveAniBridgePlaybackCoords(
      {
        "tmdb_show:46298:s2": {
          "anilist:11061": hxhSeason2Ranges,
        },
      },
      46298,
      2,
      131,
    );
    expect(coords).toEqual({ anilistId: 11061, relativeEpisode: 131 });
  });

  it("resolves AniBridge mal: targets when anilist: is missing (Araiya-san)", () => {
    const mappings = {
      "tmdb_show:88090:s1": {
        "anidb:14698:R": { "1-8": "1-8" },
        "mal:39337": { "1-8": "1-8" },
        "tvdb_show:360675:s1": { "1-8": "1-8" },
      },
    };

    expect(resolveAniBridgePlaybackCoords(mappings, 88090, 1, 1)).toBeNull();
    expect(resolveAniBridgeMalPlaybackTarget(mappings, 88090, 1, 1)).toEqual({
      malId: 39337,
      relativeEpisode: 1,
    });
    expect(resolveAniBridgeMalPlaybackTarget(mappings, 88090, 1, 8)).toEqual({
      malId: 39337,
      relativeEpisode: 8,
    });
  });

  it("resolves Fribb offsets for split TMDB seasons", () => {
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

    expect(resolveFribbPlaybackCoords(rows, 61374, 3, 1)).toEqual({
      anilistId: 100240,
      relativeEpisode: 1,
      segmentStart: 1,
    });
    expect(resolveFribbPlaybackCoords(rows, 61374, 3, 13)).toEqual({
      anilistId: 102351,
      relativeEpisode: 1,
      segmentStart: 13,
    });
    expect(resolveFribbPlaybackCoords(rows, 61374, 3, 12)).toEqual({
      anilistId: 100240,
      relativeEpisode: 12,
      segmentStart: 1,
    });
  });

  it("maps Attack on Titan S4E28 to Final Season Part 2, not the Part 3 special", () => {
    const aotSeason4 = [
      {
        anilist_id: 110277,
        themoviedb_id: { tv: 1429 },
        season: { tmdb: 4 },
      },
      {
        anilist_id: 131681,
        themoviedb_id: { tv: 1429 },
        season: { tmdb: 4 },
        episode_offset: { tmdb: 16 },
      },
      {
        anilist_id: 146984,
        themoviedb_id: { tv: 1429 },
        season: { tmdb: 4 },
        episode_offset: { tmdb: 28 },
      },
    ];

    expect(resolveFribbPlaybackCoords(aotSeason4, 1429, 4, 16)).toEqual({
      anilistId: 110277,
      relativeEpisode: 16,
      segmentStart: 1,
    });
    expect(resolveFribbPlaybackCoords(aotSeason4, 1429, 4, 17)).toEqual({
      anilistId: 131681,
      relativeEpisode: 1,
      segmentStart: 17,
    });
    expect(resolveFribbPlaybackCoords(aotSeason4, 1429, 4, 28)).toEqual({
      anilistId: 131681,
      relativeEpisode: 12,
      segmentStart: 17,
    });
    expect(resolveFribbPlaybackCoords(aotSeason4, 1429, 4, 29)).toEqual({
      anilistId: 146984,
      relativeEpisode: 1,
      segmentStart: 29,
    });
    expect(resolveFribbPlaybackCoords(aotSeason4, 1429, 4, 30)).toEqual({
      anilistId: 146984,
      relativeEpisode: 2,
      segmentStart: 29,
    });
  });

  it("maps AniBridge Attack on Titan S4E28 to Final Season Part 2 episode 12", () => {
    const mappings = {
      "tmdb_show:1429:s4": {
        "anilist:110277": { "1-16": "1-16" },
        "anilist:131681": { "17-28": "1-12" },
      },
    };

    expect(resolveAniBridgePlaybackCoords(mappings, 1429, 4, 16)).toEqual({
      anilistId: 110277,
      relativeEpisode: 16,
    });
    expect(resolveAniBridgePlaybackCoords(mappings, 1429, 4, 28)).toEqual({
      anilistId: 131681,
      relativeEpisode: 12,
    });
  });

  it("treats missing or zero Fribb season metadata as TMDB season 1", () => {
    const rows = [
      {
        anilist_id: 21,
        themoviedb_id: { tv: 37854 },
      },
      {
        anilist_id: 1124,
        themoviedb_id: { tv: 26209 },
        season: { tmdb: 0, tvdb: 0 },
      },
    ];

    expect(resolveFribbPlaybackCoords(rows, 37854, 1, 5)).toEqual({
      anilistId: 21,
      relativeEpisode: 5,
      segmentStart: 1,
    });
    expect(resolveFribbPlaybackCoords(rows, 26209, 1, 1)).toEqual({
      anilistId: 1124,
      relativeEpisode: 1,
      segmentStart: 1,
    });
    expect(resolveFribbPlaybackCoords(rows, 37854, 2, 1)).toBeNull();
  });
});
