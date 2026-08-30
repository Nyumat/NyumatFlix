import { describe, expect, it } from "vitest";

import { resolveEpisodeAnimeSelection } from "@/lib/anime/episode-playback-source";
import { resolveAnimeEpisodeMappingTmdbShowId } from "@/lib/anime/resolve-coords-tmdb-show-id";
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

describe("anilist route id collision playback", () => {
  it("detects when /anime/9936 cannot use 9936 as a TMDB id", () => {
    expect(resolveAnimeEpisodeMappingTmdbShowId("9936", 9936, null)).toBeNull();
  });

  it("resolves Maken-Ki episode coords from embedded AniList fields", () => {
    expect(
      resolveEpisodeAnimeSelection(
        buildEpisode({
          id: 99360001,
          episode_number: 1,
          sourceAnilistId: 9936,
          sourceEpisodeNumber: 1,
        }),
        { animeSeasonNumber: 1 },
      ),
    ).toEqual({
      animeInfo: {
        anilistId: 9936,
        startEpisode: 1,
        endEpisode: 1,
      },
      mapping: {
        confidence: "high",
        isAdult: false,
        relativeEpisodeNumber: 1,
        animeSeasonNumber: 1,
      },
    });
  });
});
