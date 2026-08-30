import {
  findSegmentForEpisode,
  toAnimeDisplayCoords,
  type MappingSegment,
} from "@/lib/anime/tmdb-anilist-map";
import {
  useEpisodeStore,
  type AnimeEpisodeMappingContext,
} from "@/lib/stores/episode-store";

export const applySegmentAnimeEpisodeMapping = (
  segments: readonly MappingSegment[],
  episodeNumber: number,
  input: AnimeEpisodeMappingContext & { isAdult: boolean },
): boolean => {
  const segment = findSegmentForEpisode(segments, episodeNumber);
  const animeDisplay = toAnimeDisplayCoords(segments, episodeNumber);
  if (!segment || !animeDisplay) {
    return false;
  }

  const state = useEpisodeStore.getState();
  if (
    state.tvShowId !== input.tvShowId ||
    state.seasonNumber !== input.seasonNumber ||
    state.selectedEpisode?.episode_number !== input.episodeNumber
  ) {
    return false;
  }

  if (
    state.animeCoordsStatus === "resolved" &&
    state.mappingConfidence === "high" &&
    state.anilistId === segment.anilistMediaId &&
    state.relativeEpisodeNumber === animeDisplay.episodeNumber
  ) {
    return false;
  }

  useEpisodeStore.getState().applyAnimeEpisodeMapping(
    {
      animeInfo: {
        anilistId: segment.anilistMediaId,
        startEpisode: segment.startEpisode,
        endEpisode: segment.endEpisode,
      },
      relativeEpisodeNumber: animeDisplay.episodeNumber,
      confidence: "high",
      isAdult: input.isAdult,
      animeSeasonNumber: animeDisplay.seasonNumber,
    },
    input,
  );

  return true;
};
