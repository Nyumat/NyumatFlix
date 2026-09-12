import type { ResolvedAnimeEpisodeCoords } from "@/lib/anime/tmdb-anilist-map";

export type EpisodeMappingRequest = {
  tmdbShowId?: number | null;
  anilistId?: number | null;
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
    source: "anibridge" | "fribb" | "anilist";
    isAdult?: boolean;
    genres?: string[];
  } | null;
};

export const resolveEpisodeAnimeMapping = async (
  request: EpisodeMappingRequest,
): Promise<
  (ResolvedAnimeEpisodeCoords & { isAdult: boolean; genres: string[] }) | null
> => {
  const params = new URLSearchParams({
    seasonNumber: String(request.seasonNumber),
    episodeNumber: String(request.episodeNumber),
  });
  if (
    typeof request.tmdbShowId === "number" &&
    Number.isInteger(request.tmdbShowId) &&
    request.tmdbShowId > 0
  ) {
    params.set("tmdbShowId", String(request.tmdbShowId));
  }
  if (
    typeof request.anilistId === "number" &&
    Number.isInteger(request.anilistId) &&
    request.anilistId > 0
  ) {
    params.set("anilistId", String(request.anilistId));
  }

  if (!params.has("tmdbShowId") && !params.has("anilistId")) {
    return null;
  }

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
      isAdult: payload.coords.isAdult === true || request.isAdult === true,
      genres: payload.coords.genres ?? [],
    };
  } catch {
    return null;
  }
};
