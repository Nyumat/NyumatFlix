import { Episode } from "@/utils/typings";
import { create } from "zustand";
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
    console.log("🎯 Episode Selected:", {
      episode: {
        id: episode.id,
        name: episode.name,
        episode_number: episode.episode_number,
      },
      tvShowId,
      seasonNumber,
    });

    set({
      selectedEpisode: episode,
      tvShowId,
      seasonNumber,
    });

    // Trigger the watch callback if it exists
    const { watchCallback } = get();
    if (watchCallback) {
      console.log("🎬 Triggering watch callback for episode");
      watchCallback();
    }
  },
  clearSelectedEpisode: () => {
    console.log("🧹 Clearing selected episode");
    set({
      selectedEpisode: null,
      tvShowId: null,
      seasonNumber: null,
    });
  },
  getEmbedUrl: () => {
    const { selectedEpisode, tvShowId, seasonNumber } = get();
    console.log("🔗 Getting embed URL:", {
      hasSelectedEpisode: !!selectedEpisode,
      hasTvShowId: !!tvShowId,
      hasSeasonNumber: !!seasonNumber,
    });

    if (selectedEpisode && tvShowId && seasonNumber) {
      const { selectedServer } = useServerStore.getState();
      const url = selectedServer.getEpisodeUrl(
        parseInt(tvShowId),
        seasonNumber,
        selectedEpisode.episode_number,
      );

      console.log("🎬 Generated episode URL:", {
        server: selectedServer.name,
        tvShowId: parseInt(tvShowId),
        seasonNumber,
        episodeNumber: selectedEpisode.episode_number,
        url,
      });

      return url;
    }

    console.log("❌ Cannot generate episode URL - missing data");
    return null;
  },
  setWatchCallback: (callback) => {
    set({ watchCallback: callback });
  },
}));
