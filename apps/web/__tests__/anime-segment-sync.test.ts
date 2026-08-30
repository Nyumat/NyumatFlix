import { beforeEach, describe, expect, it } from "vitest";

import { applySegmentAnimeEpisodeMapping } from "@/lib/anime/apply-segment-episode-mapping";
import { shouldAwaitPlaybackTmdbTvIdForMapping } from "@/lib/anime/resolve-coords-tmdb-show-id";
import { useEpisodeStore } from "@/lib/stores/episode-store";

const sampleEpisode = {
  id: 1,
  episode_number: 5,
  name: "Episode 5",
  overview: "",
  still_path: null,
  air_date: "",
  vote_average: 0,
  runtime: null,
};

describe("shouldAwaitPlaybackTmdbTvIdForMapping", () => {
  it("waits on AniList routes until playbackTmdbTvId hydrates", () => {
    expect(shouldAwaitPlaybackTmdbTvIdForMapping("anilist-21", 21, null)).toBe(
      true,
    );
  });

  it("does not wait once playbackTmdbTvId is available", () => {
    expect(shouldAwaitPlaybackTmdbTvIdForMapping("anilist-21", 21, 37854)).toBe(
      false,
    );
  });

  it("does not wait on TMDB tv routes without an AniList default", () => {
    expect(shouldAwaitPlaybackTmdbTvIdForMapping("1429", null, null)).toBe(
      false,
    );
  });
});

describe("applySegmentAnimeEpisodeMapping", () => {
  beforeEach(() => {
    useEpisodeStore.getState().clearSelectedEpisode();
    useEpisodeStore.getState().setDefaultAnilistId(21);
  });

  it("applies high-confidence coords when the season map arrives", () => {
    useEpisodeStore
      .getState()
      .setSelectedEpisode(
        sampleEpisode,
        "anilist-21",
        1,
        undefined,
        true,
        undefined,
        {
          confidence: "low",
          isAdult: false,
          animeSeasonNumber: 1,
        },
      );

    const applied = applySegmentAnimeEpisodeMapping(
      [
        {
          anilistMediaId: 21,
          startEpisode: 1,
          endEpisode: 12,
        },
      ],
      sampleEpisode.episode_number,
      {
        tvShowId: "anilist-21",
        seasonNumber: 1,
        episodeNumber: sampleEpisode.episode_number,
        isAdult: false,
      },
    );

    expect(applied).toBe(true);
    const state = useEpisodeStore.getState();
    expect(state.animeCoordsStatus).toBe("resolved");
    expect(state.mappingConfidence).toBe("high");
    expect(state.isAnimeEpisode).toBe(true);
    expect(state.anilistId).toBe(21);
    expect(state.relativeEpisodeNumber).toBe(5);
  });
});
