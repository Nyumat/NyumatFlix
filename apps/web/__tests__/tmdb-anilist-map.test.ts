import { describe, expect, it } from "vitest";

import {
  animeSeasonNumberForEpisode,
  buildUnknownEpisodeCountSegment,
  findSegmentForEpisode,
  inferMappingConfidence,
  relativeEpisodeInSegment,
  resolveAnimeEpisodeCoords,
  toAnimeDisplayCoords,
} from "@/lib/anime/tmdb-anilist-map";

describe("tmdb-anilist-map", () => {
  const segments = [
    { startEpisode: 1, endEpisode: 12, anilistMediaId: 100 },
    { startEpisode: 13, endEpisode: 24, anilistMediaId: 200 },
  ];

  it("finds the segment for a TMDB episode number", () => {
    expect(findSegmentForEpisode(segments, 5)?.anilistMediaId).toBe(100);
    expect(findSegmentForEpisode(segments, 20)?.anilistMediaId).toBe(200);
    expect(findSegmentForEpisode(segments, 99)).toBeNull();
  });

  it("computes relative episode numbers inside a segment", () => {
    expect(relativeEpisodeInSegment(segments[0], 5)).toBe(5);
    expect(relativeEpisodeInSegment(segments[1], 20)).toBe(8);
  });

  it("resolves coords from segments with confidence", () => {
    const resolved = resolveAnimeEpisodeCoords({
      segments,
      tmdbEpisodeNumber: 20,
      fallbackAnilistId: 999,
      confidence: "high",
    });

    expect(resolved.anilistId).toBe(200);
    expect(resolved.relativeEpisodeNumber).toBe(8);
    expect(resolved.animeSeasonNumber).toBe(2);
    expect(resolved.confidence).toBe("high");
  });

  it("maps TMDB absolute episodes to anime display seasons", () => {
    expect(toAnimeDisplayCoords(segments, 5)).toEqual({
      seasonNumber: 1,
      episodeNumber: 5,
    });
    expect(toAnimeDisplayCoords(segments, 20)).toEqual({
      seasonNumber: 2,
      episodeNumber: 8,
    });
    expect(animeSeasonNumberForEpisode(segments, 13)).toBe(2);
  });

  it("falls back to source AniList id when no segment matches", () => {
    const resolved = resolveAnimeEpisodeCoords({
      segments: [],
      tmdbEpisodeNumber: 3,
      fallbackAnilistId: 170913,
      confidence: "low",
    });

    expect(resolved.anilistId).toBe(170913);
    expect(resolved.relativeEpisodeNumber).toBe(3);
    expect(resolved.confidence).toBe("low");
  });

  it("infers high confidence when source AniList id is used", () => {
    expect(inferMappingConfidence(segments, 2, 100)).toBe("high");
  });

  it("infers low confidence for empty mappings", () => {
    expect(inferMappingConfidence([], 0)).toBe("low");
  });

  it("preserves absolute TMDB episode numbers for ongoing AniList shows", () => {
    expect(
      buildUnknownEpisodeCountSegment({
        anilistMediaId: 21,
        tmdbEpisodeCount: 26,
        tmdbEpisodeNumbers: [382, 383, 407],
      }),
    ).toEqual({
      startEpisode: 1,
      endEpisode: 407,
      anilistMediaId: 21,
    });
  });
});
