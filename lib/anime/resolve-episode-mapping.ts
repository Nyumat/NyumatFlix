import type { ResolvedAnimeEpisodeCoords } from "@/lib/anime/tmdb-anilist-map";

export type EpisodeMappingRequest = {
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
  isAdult?: boolean;
};

type PlaybackCoordsResponse = {
  coords: {
    anilistId: number;
    relativeEpisodeNumber: number;
    animeSeasonNumber: number | null;
    animeInfo: ResolvedAnimeEpisodeCoords["animeInfo"];
    confidence: "high" | "low";
    source: "anibridge" | "fribb";
  } | null;
};

export const resolveEpisodeAnimeMapping = async (
  request: EpisodeMappingRequest,
): Promise<(ResolvedAnimeEpisodeCoords & { isAdult: boolean }) | null> => {
  const params = new URLSearchParams({
    tmdbShowId: String(request.tmdbShowId),
    seasonNumber: String(request.seasonNumber),
    episodeNumber: String(request.episodeNumber),
  });

  try {
    const response = await fetch(
      `/api/anime/playback-coords?${params.toString()}`,
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PlaybackCoordsResponse;
    if (!payload.coords || payload.coords.confidence !== "high") {
      return null;
    }

    return {
      anilistId: payload.coords.anilistId,
      relativeEpisodeNumber: payload.coords.relativeEpisodeNumber,
      animeSeasonNumber: payload.coords.animeSeasonNumber,
      animeInfo: payload.coords.animeInfo,
      confidence: "high",
      isAdult: request.isAdult === true,
    };
  } catch {
    return null;
  }
};
