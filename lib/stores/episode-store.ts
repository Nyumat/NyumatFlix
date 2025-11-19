import { Episode } from "@/utils/typings";
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
  ) => void;
  clearSelectedEpisode: () => void;
  getEmbedUrl: () => string | null;
  setWatchCallback: (callback: () => void) => void;
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  selectedEpisode: null,
  tvShowId: null,
  seasonNumber: null,
  isAnimeEpisode: false,
  anilistId: null,
  relativeEpisodeNumber: null,
  watchCallback: null,
  setSelectedEpisode: (episode, tvShowId, seasonNumber, animeInfo) => {
    const isAnimeEpisode = !!animeInfo;
    const anilistId = animeInfo?.anilistId || null;
    const relativeEpisodeNumber = animeInfo
      ? episode.episode_number - animeInfo.startEpisode + 1
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
      fetch("/api/watchlist/progress", {
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
      }).catch((error) => {
        console.error("Error tracking watch progress:", error);
      });
    }

    const { watchCallback } = get();
    if (watchCallback) {
      watchCallback();
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
