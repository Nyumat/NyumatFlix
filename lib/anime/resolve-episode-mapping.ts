import {
  inferMappingConfidence,
  resolveAnimeEpisodeCoords,
  type ResolvedAnimeEpisodeCoords,
  type TmdbAnilistMapResponse,
} from "@/lib/anime/tmdb-anilist-map";

export type EpisodeMappingRequest = {
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
  sourceAnilistId: number;
  isAdult?: boolean;
};

const fetchTmdbAnilistMap = async (
  request: EpisodeMappingRequest,
): Promise<TmdbAnilistMapResponse | null> => {
  const params = new URLSearchParams({
    tmdbShowId: String(request.tmdbShowId),
    tmdbSeason: String(request.seasonNumber),
    sourceAnilistId: String(request.sourceAnilistId),
  });

  try {
    const response = await fetch(`/api/map?${params.toString()}`);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TmdbAnilistMapResponse;
  } catch {
    return null;
  }
};

export const resolveEpisodeAnimeMapping = async (
  request: EpisodeMappingRequest,
): Promise<(ResolvedAnimeEpisodeCoords & { isAdult: boolean }) | null> => {
  const map = await fetchTmdbAnilistMap(request);

  if (!map || map.segments.length === 0) {
    return null;
  }

  const confidence =
    map.confidence ??
    inferMappingConfidence(
      map.segments,
      map.segments.length,
      request.sourceAnilistId,
    );

  const coords = resolveAnimeEpisodeCoords({
    segments: map.segments,
    tmdbEpisodeNumber: request.episodeNumber,
    fallbackAnilistId: request.sourceAnilistId,
    confidence,
  });

  if (coords.confidence !== "high") return null;

  return {
    ...coords,
    isAdult: map.isAdult || request.isAdult === true,
  };
};
