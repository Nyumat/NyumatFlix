import { describe, expect, it } from "vitest";

import {
  isAnimeFirstPlayback,
  shouldAllowTmdbOnlyScrape,
  shouldHoldAnimePlaybackStart,
} from "@/lib/anime/anime-playback-policy";

const holdBase = {
  animeFirst: true,
  hasSelectedEpisode: true,
  animeCoordsReady: false,
  animeCoordsStatus: "pending" as const,
};

describe("anime-playback-policy", () => {
  it("treats anime catalog and AniList-backed pages as anime-first", () => {
    expect(isAnimeFirstPlayback("anime", null)).toBe(true);
    expect(isAnimeFirstPlayback("tvshows", 21)).toBe(true);
    expect(isAnimeFirstPlayback("tvshows", null)).toBe(false);
  });

  it("holds anime playback until coords are ready", () => {
    expect(shouldHoldAnimePlaybackStart(holdBase)).toBe(true);
    expect(
      shouldHoldAnimePlaybackStart({
        ...holdBase,
        animeCoordsStatus: "idle",
      }),
    ).toBe(true);
    expect(
      shouldHoldAnimePlaybackStart({
        ...holdBase,
        animeCoordsReady: true,
      }),
    ).toBe(false);
    expect(
      shouldHoldAnimePlaybackStart({
        ...holdBase,
        animeCoordsStatus: "miss",
      }),
    ).toBe(false);
  });

  it("blocks TMDB-only scrape on anime-first pages until a miss", () => {
    expect(shouldAllowTmdbOnlyScrape(holdBase)).toBe(false);
    expect(
      shouldAllowTmdbOnlyScrape({
        ...holdBase,
        animeCoordsStatus: "miss",
      }),
    ).toBe(true);
    expect(
      shouldAllowTmdbOnlyScrape({
        animeFirst: false,
        hasSelectedEpisode: true,
        animeCoordsReady: false,
        animeCoordsStatus: "pending",
      }),
    ).toBe(true);
  });
});
