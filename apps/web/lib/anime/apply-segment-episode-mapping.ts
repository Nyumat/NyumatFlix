import { resolveSegmentEpisodeCoords } from "@/lib/anime/resolve-segment-episode-coords";
import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";
import {
  useEpisodeStore,
  type AnimeEpisodeMappingContext,
} from "@/lib/stores/episode-store";

export const applySegmentAnimeEpisodeMapping = (
  segments: readonly MappingSegment[],
  episodeNumber: number,
  input: AnimeEpisodeMappingContext & { isAdult: boolean },
): boolean => {
  const segmentCoords = resolveSegmentEpisodeCoords({
    segments,
    tmdbEpisodeNumber: episodeNumber,
  });
  if (!segmentCoords) {
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
    state.anilistId === segmentCoords.anilistId &&
    state.relativeEpisodeNumber === segmentCoords.relativeEpisodeNumber
  ) {
    return false;
  }

  useEpisodeStore.getState().applyAnimeEpisodeMapping(
    {
      animeInfo: {
        anilistId: segmentCoords.anilistId,
        startEpisode: segmentCoords.segment.startEpisode,
        endEpisode: segmentCoords.segment.endEpisode,
      },
      relativeEpisodeNumber: segmentCoords.relativeEpisodeNumber,
      confidence: "high",
      isAdult: input.isAdult,
      animeSeasonNumber: segmentCoords.animeSeasonNumber,
    },
    input,
  );

  return true;
};
