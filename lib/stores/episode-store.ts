import { create } from "zustand";
import { Episode } from "@/utils/typings";
import { useServerStore } from "./server-store";

interface EpisodeState {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
  watchCallback: (() => void) | null;
  setSelectedEpisode: (
    episode: Episode,
    tvShowId: string,
    seasonNumber: number,
  ) => void;
  clearSelectedEpisode: () => void;
  getEmbedUrl: () => string | null;
  setWatchCallback: (callback: () => void) => void;
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  selectedEpisode: null,
  tvShowId: null,
  seasonNumber: null,
  watchCallback: null,
  setSelectedEpisode: (episode, tvShowId, seasonNumber) => {
    set({
      selectedEpisode: episode,
      tvShowId,
      seasonNumber,
    });
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
    });
  },
  getEmbedUrl: () => {
    const { selectedEpisode, tvShowId, seasonNumber } = get();
    if (selectedEpisode && tvShowId && seasonNumber) {
      const { selectedServer } = useServerStore.getState();
      const url = selectedServer.getEpisodeUrl(
        parseInt(tvShowId),
        seasonNumber,
        selectedEpisode.episode_number,
      );
      return url;
    }
    return null;
  },
  setWatchCallback: (callback) => {
    set({ watchCallback: callback });
  },
}));
