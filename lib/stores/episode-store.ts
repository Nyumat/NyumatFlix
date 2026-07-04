import { Episode } from "@/lib/domain/typings";
import { getSession } from "next-auth/react";
import { create } from "zustand";
import { useServerStore } from "./server-store";

interface EpisodeState {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
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
  ) => void;
  clearSelectedEpisode: () => void;
  setDefaultAnilistId: (anilistId: number | null) => void;
  getEmbedUrl: () => string | null;
  setWatchCallback: (callback: (() => void) | null) => void;
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  selectedEpisode: null,
  tvShowId: null,
  seasonNumber: null,
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

    set({
      selectedEpisode: episode,
      tvShowId,
      seasonNumber,
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
      isAnimeEpisode,
      anilistId,
      relativeEpisodeNumber,
    } = get();

    if (!selectedEpisode || !tvShowId || !seasonNumber) {
      return null;
    }

    const { selectedServer, vidnestContentType, animePreference } =
      useServerStore.getState();

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
          selectedEpisode.episode_number,
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
      selectedEpisode.episode_number,
    );
    return url;
  },
  setWatchCallback: (callback) => {
    set({ watchCallback: callback });
  },
}));
