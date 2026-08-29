import { beforeEach, describe, expect, it } from "vitest";

import { useEpisodeStore } from "@/lib/stores/episode-store";

const sampleEpisode = {
  id: 1,
  episode_number: 21,
  name: "The Attack Titan",
  overview: "",
  still_path: null,
  air_date: "",
  vote_average: 0,
  runtime: null,
};

describe("anime playback coords pending", () => {
  beforeEach(() => {
    useEpisodeStore.getState().clearSelectedEpisode();
    useEpisodeStore.getState().setDefaultAnilistId(16498);
    useEpisodeStore.getState().setPlaybackTmdbTvId(1429);
  });

  it("keeps coords pending on AniList routes until high-confidence mapping", () => {
    useEpisodeStore
      .getState()
      .setSelectedEpisode(
        sampleEpisode,
        "anilist-16498",
        3,
        undefined,
        true,
        undefined,
        {
          confidence: "low",
          isAdult: false,
          animeSeasonNumber: 3,
        },
      );

    const state = useEpisodeStore.getState();
    expect(state.animeCoordsStatus).toBe("pending");
    expect(state.isAnimeEpisode).toBe(false);
    expect(state.anilistId).toBeNull();
    expect(state.relativeEpisodeNumber).toBeNull();
    expect(state.mappingConfidence).toBe("low");
  });

  it("does not treat low-confidence route-id fallback as resolved", () => {
    useEpisodeStore.getState().setSelectedEpisode(
      sampleEpisode,
      "anilist-16498",
      3,
      {
        anilistId: 16498,
        startEpisode: 1,
        endEpisode: 87,
      },
      true,
      undefined,
      {
        confidence: "low",
        isAdult: false,
        animeSeasonNumber: 3,
      },
    );

    const state = useEpisodeStore.getState();
    expect(state.animeCoordsStatus).toBe("pending");
    expect(state.mappingConfidence).toBe("low");
  });

  it("marks resolved when segment mapping is high confidence", () => {
    useEpisodeStore.getState().setSelectedEpisode(
      sampleEpisode,
      "1429",
      3,
      {
        anilistId: 104578,
        startEpisode: 13,
        endEpisode: 22,
      },
      true,
      undefined,
      {
        confidence: "high",
        isAdult: false,
        animeSeasonNumber: 3,
        relativeEpisodeNumber: 9,
      },
    );

    const state = useEpisodeStore.getState();
    expect(state.animeCoordsStatus).toBe("resolved");
    expect(state.anilistId).toBe(104578);
    expect(state.relativeEpisodeNumber).toBe(9);
    expect(state.mappingConfidence).toBe("high");
  });
});
