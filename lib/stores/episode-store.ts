import { Episode } from "@/lib/domain/typings";
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { episodeNumberForProviders } from "@/lib/tv-provider-episode";
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
  // anime stuff
  isAnimeEpisode: boolean;
  anilistId: number | null;
  relativeEpisodeNumber: number | null;
  defaultAnilistId: number | null;
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
  ) => void;
  clearSelectedEpisode: () => void;
  setDefaultAnilistId: (anilistId: number | null) => void;
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
  defaultAnilistId: null,
  watchCallback: null,
  setSelectedEpisode: (
    episode,
    tvShowId,
    seasonNumber,
    animeInfo,
    skipWatchCallback = false,
    seasonEpisodes,
  ) => {
    const effectiveAnimeInfo =
      animeInfo ??
      (get().defaultAnilistId
        ? {
            anilistId: get().defaultAnilistId!,
            startEpisode: 1,
            endEpisode: Number.MAX_SAFE_INTEGER,
          }
        : undefined);
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
    });

    // Track watch progress
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
    });
  },
  setDefaultAnilistId: (defaultAnilistId) => set({ defaultAnilistId }),
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

    // For vidnest server, handle different content types
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

    // For non-vidnest servers or default tv episodes
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
      setSelectedEpisode(
        episode,
        tvShowId,
        targetSeason,
        undefined,
        true,
        episodes,
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
