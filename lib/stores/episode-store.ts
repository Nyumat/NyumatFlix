import { Episode } from "@/lib/domain/typings";
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { episodeNumberForProviders } from "@/lib/tv-provider-episode";
import type { MappingConfidence } from "@/lib/anime/tmdb-anilist-map";
import { getSession } from "next-auth/react";
import { create } from "zustand";
import { useServerStore, isScrapeServer } from "./server-store";

export type NextEpisodeTarget = {
  episode: Episode;
  seasonNumber: number;
  seasonEpisodes: Episode[];
};

export type NextEpisodeInfo = {
  seasonNumber: number;
  episodeNumber: number;
  providerEpisodeNumber: number;
};

interface EpisodeState {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
  /** Episodes for the current season (used for provider numbering and auto-advance). */
  seasonEpisodes: Episode[] | null;
  /** 1-based episode index within the season for embed/scrape providers. */
  providerEpisodeNumber: number | null;
  isAnimeEpisode: boolean;
  anilistId: number | null;
  relativeEpisodeNumber: number | null;
  /** 1-based AniList-segment season when TMDB collapses cours into one season. */
  animeSeasonNumber: number | null;
  animeSegmentStart: number | null;
  animeSegmentEnd: number | null;
  mappingConfidence: MappingConfidence | null;
  isAdultAnime: boolean;
  defaultAnilistId: number | null;
  defaultIsAdultAnime: boolean;
  watchCallback: (() => void) | null;
  setSelectedEpisode: (
    episode: Episode,
    tvShowId: string,
    seasonNumber: number,
    animeInfo?: {
      anilistId: number;
      startEpisode: number;
      endEpisode: number;
    },
    skipWatchCallback?: boolean,
    seasonEpisodes?: Episode[],
    mapping?: {
      confidence: MappingConfidence;
      isAdult: boolean;
      animeSeasonNumber?: number | null;
    },
  ) => void;
  applyAnimeEpisodeMapping: (mapping: {
    animeInfo: {
      anilistId: number;
      startEpisode: number;
      endEpisode: number;
    };
    confidence: MappingConfidence;
    isAdult: boolean;
    animeSeasonNumber?: number | null;
  }) => void;
  clearSelectedEpisode: () => void;
  setDefaultAnilistId: (anilistId: number | null, isAdult?: boolean) => void;
  getEmbedUrl: () => string | null;
  /** Next episode within the loaded season, if any. */
  getNextEpisodeTarget: () => NextEpisodeTarget | null;
  /** Scrape-friendly next-episode coordinates (no embed URL). */
  getNextEpisodeInfo: () => NextEpisodeInfo | null;
  /** Advance to the next episode, including cross-season when needed. */
  advanceToNextEpisode: () => Promise<boolean>;
  setWatchCallback: (callback: (() => void) | null) => void;
}

function findNextEpisodeInSeason(
  selectedEpisode: Episode,
  seasonNumber: number,
  seasonEpisodes: readonly Episode[],
): NextEpisodeTarget | null {
  if (seasonEpisodes.length === 0) {
    return null;
  }

  const sorted = [...seasonEpisodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const currentIndex = sorted.findIndex(
    (episode) =>
      episode.id === selectedEpisode.id ||
      episode.episode_number === selectedEpisode.episode_number,
  );

  if (currentIndex < 0 || currentIndex >= sorted.length - 1) {
    return null;
  }

  return {
    episode: sorted[currentIndex + 1]!,
    seasonNumber,
    seasonEpisodes: sorted,
  };
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  selectedEpisode: null,
  tvShowId: null,
  seasonNumber: null,
  seasonEpisodes: null,
  providerEpisodeNumber: null,
  isAnimeEpisode: false,
  anilistId: null,
  relativeEpisodeNumber: null,
  animeSeasonNumber: null,
  animeSegmentStart: null,
  animeSegmentEnd: null,
  mappingConfidence: null,
  isAdultAnime: false,
  defaultAnilistId: null,
  defaultIsAdultAnime: false,
  watchCallback: null,
  setSelectedEpisode: (
    episode,
    tvShowId,
    seasonNumber,
    animeInfo,
    skipWatchCallback = false,
    seasonEpisodes,
    mapping,
  ) => {
    const effectiveAnimeInfo = animeInfo;
    const isAnimeEpisode = !!effectiveAnimeInfo;
    const anilistId = effectiveAnimeInfo?.anilistId || null;
    const relativeEpisodeNumber = effectiveAnimeInfo
      ? episode.episode_number - effectiveAnimeInfo.startEpisode + 1
      : null;
    const providerEpisodeNumber = seasonEpisodes?.length
      ? episodeNumberForProviders(seasonEpisodes, episode.episode_number)
      : episode.episode_number;

    set({
      selectedEpisode: episode,
      tvShowId,
      seasonNumber,
      seasonEpisodes: seasonEpisodes ?? null,
      providerEpisodeNumber,
      isAnimeEpisode,
      anilistId,
      relativeEpisodeNumber,
      animeSeasonNumber: isAnimeEpisode
        ? (mapping?.animeSeasonNumber ?? null)
        : null,
      animeSegmentStart: effectiveAnimeInfo?.startEpisode ?? null,
      animeSegmentEnd: effectiveAnimeInfo?.endEpisode ?? null,
      mappingConfidence: mapping?.confidence ?? (isAnimeEpisode ? "low" : null),
      isAdultAnime: mapping?.isAdult ?? false,
    });

    if (tvShowId && seasonNumber && episode.episode_number) {
      getSession()
        .then((session) => {
          if (!session?.user?.id) {
            return;
          }

          return fetch("/api/watchlist/progress", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contentId: parseInt(tvShowId),
              mediaType: "tv",
              seasonNumber,
              episodeNumber: episode.episode_number,
            }),
          });
        })
        .catch((error) => {
          console.error("Error tracking watch progress:", error);
        });
    }

    if (!skipWatchCallback) {
      const { watchCallback } = get();
      if (watchCallback) {
        watchCallback();
      }
    }
  },
  clearSelectedEpisode: () => {
    set({
      selectedEpisode: null,
      tvShowId: null,
      seasonNumber: null,
      seasonEpisodes: null,
      providerEpisodeNumber: null,
      isAnimeEpisode: false,
      anilistId: null,
      relativeEpisodeNumber: null,
      animeSeasonNumber: null,
      animeSegmentStart: null,
      animeSegmentEnd: null,
      mappingConfidence: null,
      isAdultAnime: false,
    });
  },
  applyAnimeEpisodeMapping: (mapping) => {
    const { selectedEpisode } = get();
    if (!selectedEpisode) {
      return;
    }

    const relativeEpisodeNumber =
      selectedEpisode.episode_number - mapping.animeInfo.startEpisode + 1;

    set({
      anilistId: mapping.animeInfo.anilistId,
      relativeEpisodeNumber,
      animeSeasonNumber: mapping.animeSeasonNumber ?? null,
      animeSegmentStart: mapping.animeInfo.startEpisode,
      animeSegmentEnd: mapping.animeInfo.endEpisode,
      isAnimeEpisode: true,
      mappingConfidence: mapping.confidence,
      isAdultAnime: mapping.isAdult,
    });
  },
  setDefaultAnilistId: (defaultAnilistId, isAdult = false) =>
    set({
      defaultAnilistId,
      defaultIsAdultAnime: defaultAnilistId ? isAdult === true : false,
    }),
  getEmbedUrl: () => {
    const {
      selectedEpisode,
      tvShowId,
      seasonNumber,
      providerEpisodeNumber,
      isAnimeEpisode,
      anilistId,
      relativeEpisodeNumber,
    } = get();

    if (!selectedEpisode || !tvShowId || !seasonNumber) {
      return null;
    }

    const { selectedServer, vidnestContentType, animePreference } =
      useServerStore.getState();

    if (isScrapeServer(selectedServer)) {
      return null;
    }

    if (selectedServer.id === "vidnest") {
      if (isAnimeEpisode && anilistId && relativeEpisodeNumber) {
        if (vidnestContentType === "anime") {
          return `https://vidnest.fun/anime/${anilistId}/${relativeEpisodeNumber}/${animePreference}`;
        } else if (vidnestContentType === "animepahe") {
          return `https://vidnest.fun/animepahe/${anilistId}/${relativeEpisodeNumber}/${animePreference}`;
        }
      }

      if (vidnestContentType === "tv") {
        return selectedServer.getEpisodeUrl(
          parseInt(tvShowId),
          seasonNumber,
          providerEpisodeNumber ?? selectedEpisode.episode_number,
        );
      }

      if (vidnestContentType === "movie") {
        return selectedServer.getMovieUrl(parseInt(tvShowId));
      }
    }

    if (isAnimeEpisode && anilistId && relativeEpisodeNumber) {
      if (selectedServer.getAnimeUrl) {
        return selectedServer.getAnimeUrl(anilistId, relativeEpisodeNumber);
      }
      if (selectedServer.getAnimePaheUrl) {
        return selectedServer.getAnimePaheUrl(anilistId, relativeEpisodeNumber);
      }
    }

    const url = selectedServer.getEpisodeUrl(
      parseInt(tvShowId),
      seasonNumber,
      providerEpisodeNumber ?? selectedEpisode.episode_number,
    );
    return url;
  },
  getNextEpisodeTarget: () => {
    const { selectedEpisode, seasonNumber, seasonEpisodes } = get();

    if (!selectedEpisode || seasonNumber == null || !seasonEpisodes?.length) {
      return null;
    }

    return findNextEpisodeInSeason(
      selectedEpisode,
      seasonNumber,
      seasonEpisodes,
    );
  },
  getNextEpisodeInfo: () => {
    const target = get().getNextEpisodeTarget();
    if (!target) {
      return null;
    }

    return {
      seasonNumber: target.seasonNumber,
      episodeNumber: target.episode.episode_number,
      providerEpisodeNumber: episodeNumberForProviders(
        target.seasonEpisodes,
        target.episode.episode_number,
      ),
    };
  },
  advanceToNextEpisode: async () => {
    const {
      selectedEpisode,
      seasonNumber,
      tvShowId,
      seasonEpisodes,
      setSelectedEpisode,
      getNextEpisodeTarget,
    } = get();

    if (!selectedEpisode || seasonNumber == null || !tvShowId) {
      return false;
    }

    const advanceEpisode = (
      episode: Episode,
      targetSeason: number,
      episodes: Episode[],
    ) => {
      const {
        anilistId,
        animeSeasonNumber,
        animeSegmentStart,
        animeSegmentEnd,
        mappingConfidence,
        isAdultAnime,
      } = get();

      const stillInSegment =
        anilistId != null &&
        animeSegmentStart != null &&
        animeSegmentEnd != null &&
        episode.episode_number >= animeSegmentStart &&
        episode.episode_number <= animeSegmentEnd;

      const animeInfo = stillInSegment
        ? {
            anilistId,
            startEpisode: animeSegmentStart,
            endEpisode: animeSegmentEnd,
          }
        : undefined;

      setSelectedEpisode(
        episode,
        tvShowId,
        targetSeason,
        animeInfo,
        true,
        episodes,
        animeInfo
          ? {
              confidence: mappingConfidence ?? "high",
              isAdult: isAdultAnime,
              animeSeasonNumber,
            }
          : undefined,
      );
    };

    const inSeasonNext = getNextEpisodeTarget();
    if (inSeasonNext) {
      advanceEpisode(
        inSeasonNext.episode,
        inSeasonNext.seasonNumber,
        inSeasonNext.seasonEpisodes,
      );
      return true;
    }

    let currentSeasonEpisodes = seasonEpisodes;
    if (!currentSeasonEpisodes?.length) {
      const currentSeason = await fetchSeasonDetails(tvShowId, seasonNumber);
      currentSeasonEpisodes = currentSeason?.episodes ?? [];
    }

    if (currentSeasonEpisodes.length > 0) {
      const sorted = [...currentSeasonEpisodes].sort(
        (a, b) => a.episode_number - b.episode_number,
      );
      const currentIndex = sorted.findIndex(
        (episode) =>
          episode.id === selectedEpisode.id ||
          episode.episode_number === selectedEpisode.episode_number,
      );

      if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
        advanceEpisode(sorted[currentIndex + 1]!, seasonNumber, sorted);
        return true;
      }
    }

    const nextSeasonNumber = seasonNumber + 1;
    const nextSeason = await fetchSeasonDetails(tvShowId, nextSeasonNumber);
    const nextSeasonEpisodes = nextSeason?.episodes ?? [];
    if (nextSeasonEpisodes.length === 0) {
      return false;
    }

    const sortedNextSeason = [...nextSeasonEpisodes].sort(
      (a, b) => a.episode_number - b.episode_number,
    );
    advanceEpisode(sortedNextSeason[0]!, nextSeasonNumber, sortedNextSeason);
    return true;
  },
  setWatchCallback: (callback) => {
    set({ watchCallback: callback });
  },
}));
