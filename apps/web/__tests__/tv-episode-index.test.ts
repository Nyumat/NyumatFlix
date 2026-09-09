import {
  maxLoadedEpisodeNumber,
  shouldPreferSeasonDetails,
} from "@/lib/tv-episode-index";
import type { Episode, SeasonDetails } from "@/lib/domain/typings";
import { describe, expect, it } from "vitest";

const episode = (episodeNumber: number): Episode => ({
  id: episodeNumber,
  name: `Episode ${episodeNumber}`,
  overview: "",
  episode_number: episodeNumber,
  air_date: "",
  still_path: null,
  runtime: 24,
  vote_average: 0,
  vote_count: 0,
});

const season = (episodes: Episode[]): SeasonDetails => ({
  id: 1,
  name: "Season 4",
  overview: "",
  season_number: 4,
  episodes,
});

describe("tv episode index helpers", () => {
  it("tracks the highest loaded episode number", () => {
    expect(
      maxLoadedEpisodeNumber([
        episode(1),
        episode(28),
        episode(29),
        episode(30),
      ]),
    ).toBe(30);
  });

  it("prefers season details that include split-cour appendix episodes", () => {
    const partial = season(Array.from({ length: 28 }, (_, index) => episode(index + 1)));
    const merged = season([
      ...Array.from({ length: 28 }, (_, index) => episode(index + 1)),
      episode(29),
      episode(30),
    ]);

    expect(shouldPreferSeasonDetails(partial, merged)).toBe(true);
    expect(shouldPreferSeasonDetails(merged, partial)).toBe(false);
  });

  it("prefers season details with unique stills and titles at the same count", () => {
    const stubs = season(
      Array.from({ length: 6 }, (_, index) => ({
        ...episode(index + 1),
        still_path: "/shared-backdrop.jpg",
      })),
    );
    const enriched = season(
      Array.from({ length: 6 }, (_, index) => ({
        ...episode(index + 1),
        name: `Chapter ${index + 1}`,
        still_path: `/ep-${index + 1}.jpg`,
      })),
    );

    expect(shouldPreferSeasonDetails(stubs, enriched)).toBe(true);
    expect(shouldPreferSeasonDetails(enriched, stubs)).toBe(false);
  });
});
