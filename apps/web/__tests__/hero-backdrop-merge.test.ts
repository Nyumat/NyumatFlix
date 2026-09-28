import { describe, expect, it } from "vitest";

import type { HeroBackdropCandidate } from "@/lib/flags/hero-backdrop-candidates";
import { mergeHeroBackdropCandidates } from "@/lib/flags/hero-backdrop-merge";

const candidate = (
  overrides: Partial<HeroBackdropCandidate> &
    Pick<HeroBackdropCandidate, "id" | "title" | "mediaType">,
): HeroBackdropCandidate => ({
  year: "2015",
  tmdbId: null,
  anilistId: null,
  malId: null,
  posterUrl: null,
  subtitle: overrides.mediaType === "anime" ? "TV" : "TMDB",
  backdrops: [
    {
      path: `/${overrides.id}.jpg`,
      previewUrl: `https://example.com/${overrides.id}.jpg`,
      label: overrides.mediaType === "anime" ? "AniList · banner" : "TMDB",
      source: overrides.mediaType === "anime" ? "anilist" : "tmdb",
      width: null,
      height: null,
    },
  ],
  ...overrides,
});

describe("mergeHeroBackdropCandidates", () => {
  it("keeps the series anilist id when later specials contain the same title", () => {
    const tmdb = [
      candidate({
        id: "tv-62564",
        mediaType: "tv",
        title: "Sound! Euphonium",
        tmdbId: 62564,
      }),
    ];
    const anime = [
      candidate({
        id: "anime-20912",
        mediaType: "anime",
        title: "Sound! Euphonium",
        anilistId: 20912,
        malId: 27989,
      }),
      candidate({
        id: "anime-21255",
        mediaType: "anime",
        title: "Sound! Euphonium Shorts",
        anilistId: 21255,
        subtitle: "SPECIAL",
      }),
      candidate({
        id: "anime-21460",
        mediaType: "anime",
        title: "Sound! Euphonium 2",
        year: "2016",
        anilistId: 21460,
      }),
      candidate({
        id: "anime-21376",
        mediaType: "anime",
        title: "Sound! Euphonium: Ready, Set, Monaka",
        anilistId: 21376,
        subtitle: "OVA",
      }),
    ];

    const merged = mergeHeroBackdropCandidates(tmdb, anime);
    const series = merged.find((item) => item.tmdbId === 62564);

    expect(series?.anilistId).toBe(20912);
    expect(series?.malId).toBe(27989);
    expect(series?.title).toBe("Sound! Euphonium");
    expect(merged.map((item) => item.anilistId)).toEqual([
      20912, 21255, 21460, 21376,
    ]);
  });

  it("still combines backdrops when the titles are the same work", () => {
    const merged = mergeHeroBackdropCandidates(
      [
        candidate({
          id: "tv-1",
          mediaType: "tv",
          title: "Frieren",
          tmdbId: 1,
        }),
      ],
      [
        candidate({
          id: "anime-2",
          mediaType: "anime",
          title: "Frieren",
          anilistId: 2,
          malId: 3,
        }),
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.subtitle).toBe("TMDB + AniList");
    expect(merged[0]?.backdrops.map((option) => option.path)).toEqual([
      "/tv-1.jpg",
      "/anime-2.jpg",
    ]);
  });

  it("leaves a same title from a different year as its own row", () => {
    const merged = mergeHeroBackdropCandidates(
      [
        candidate({
          id: "movie-1",
          mediaType: "movie",
          title: "Ghost in the Shell",
          year: "1995",
          tmdbId: 1,
        }),
      ],
      [
        candidate({
          id: "anime-2",
          mediaType: "anime",
          title: "Ghost in the Shell",
          year: "2017",
          anilistId: 2,
        }),
      ],
    );

    expect(merged.map((item) => item.anilistId)).toEqual([null, 2]);
  });
});
