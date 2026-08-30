import type { Episode } from "@/lib/domain/typings";
import type { MappingConfidence } from "@/lib/anime/tmdb-anilist-map";

export type EpisodeAnilistPlayback = {
  anilistId: number;
  episodeNumber: number;
};

export type EpisodeAnimeSelection = {
  animeInfo: {
    anilistId: number;
    startEpisode: number;
    endEpisode: number;
  };
  mapping: {
    confidence: MappingConfidence;
    isAdult: boolean;
    relativeEpisodeNumber: number;
    animeSeasonNumber?: number | null;
    genres?: string[];
  };
};

export const readEpisodeAnilistPlayback = (
  episode: Episode,
): EpisodeAnilistPlayback | null => {
  if (
    typeof episode.sourceAnilistId !== "number" ||
    !Number.isInteger(episode.sourceAnilistId) ||
    episode.sourceAnilistId <= 0 ||
    typeof episode.sourceEpisodeNumber !== "number" ||
    !Number.isInteger(episode.sourceEpisodeNumber) ||
    episode.sourceEpisodeNumber <= 0
  ) {
    return null;
  }

  return {
    anilistId: episode.sourceAnilistId,
    episodeNumber: episode.sourceEpisodeNumber,
  };
};

export const animeInfoFromEpisodePlayback = (
  episode: Episode,
  playback: EpisodeAnilistPlayback,
): EpisodeAnimeSelection["animeInfo"] => {
  const segmentStart = episode.episode_number - playback.episodeNumber + 1;

  return {
    anilistId: playback.anilistId,
    startEpisode: segmentStart,
    endEpisode: segmentStart + playback.episodeNumber - 1,
  };
};

export const resolveEpisodeAnimeSelection = (
  episode: Episode,
  options?: {
    animeSeasonNumber?: number | null;
    isAdult?: boolean;
    genres?: string[];
  },
): EpisodeAnimeSelection | null => {
  const playback = readEpisodeAnilistPlayback(episode);
  if (!playback) {
    return null;
  }

  return {
    animeInfo: animeInfoFromEpisodePlayback(episode, playback),
    mapping: {
      confidence: "high",
      isAdult: options?.isAdult === true,
      relativeEpisodeNumber: playback.episodeNumber,
      animeSeasonNumber: options?.animeSeasonNumber,
      genres: options?.genres,
    },
  };
};
