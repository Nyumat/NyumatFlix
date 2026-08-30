import { describe, expect, it } from "vitest";

import {
  readEpisodeAnilistPlayback,
  resolveEpisodeAnimeSelection,
} from "@/lib/anime/episode-playback-source";
import type { Episode } from "@/lib/domain/typings";

const buildEpisode = (
  overrides: Partial<Episode> & Pick<Episode, "id" | "episode_number">,
): Episode => ({
  id: overrides.id,
  episode_number: overrides.episode_number,
  name: overrides.name ?? `Episode ${overrides.episode_number}`,
  overview: "",
  air_date: "",
  still_path: null,
  runtime: 24,
  sourceAnilistId: overrides.sourceAnilistId,
  sourceEpisodeNumber: overrides.sourceEpisodeNumber,
});

describe("episode playback source", () => {
  it("reads embedded AniList playback coords from merged episodes", () => {
    expect(
      readEpisodeAnilistPlayback(
        buildEpisode({
          id: 1469840029,
          episode_number: 29,
          sourceAnilistId: 146984,
          sourceEpisodeNumber: 1,
        }),
      ),
    ).toEqual({
      anilistId: 146984,
      episodeNumber: 1,
    });
  });

  it("resolves high-confidence anime selection for Final Chapter specials", () => {
    expect(
      resolveEpisodeAnimeSelection(
        buildEpisode({
          id: 1623140030,
          episode_number: 30,
          sourceAnilistId: 162314,
          sourceEpisodeNumber: 1,
        }),
        { animeSeasonNumber: 4 },
      ),
    ).toEqual({
      animeInfo: {
        anilistId: 162314,
        startEpisode: 30,
        endEpisode: 30,
      },
      mapping: {
        confidence: "high",
        isAdult: false,
        relativeEpisodeNumber: 1,
        animeSeasonNumber: 4,
      },
    });
  });

  it("keeps split-cour relative episode numbers inside a merged TMDB season", () => {
    expect(
      resolveEpisodeAnimeSelection(
        buildEpisode({
          id: 1316810017,
          episode_number: 17,
          sourceAnilistId: 131681,
          sourceEpisodeNumber: 1,
        }),
        { animeSeasonNumber: 4 },
      ),
    ).toMatchObject({
      animeInfo: {
        anilistId: 131681,
        startEpisode: 17,
        endEpisode: 17,
      },
      mapping: {
        confidence: "high",
        relativeEpisodeNumber: 1,
      },
    });
  });
});
