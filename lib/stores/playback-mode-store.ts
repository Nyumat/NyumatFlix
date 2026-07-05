import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  resolveVideoServerById,
  type VideoServer,
} from "@/lib/stores/video-servers";

/** Direct HLS scraping mode — not an iframe embed server. */
export const scrapeServer: VideoServer = {
  id: "scrape",
  name: "Scrape",
  baseUrl: "",
  getMovieUrl: () => "",
  getTvUrl: () => "",
  getEpisodeUrl: () => "",
};

export function isScrapeServer(server: Pick<VideoServer, "id">): boolean {
  return server.id === "scrape";
}

interface PlaybackModeState {
  selectedServer: VideoServer;
  setSelectedServer: (server: VideoServer) => void;
}

const resolveStoredServer = (serverId: string): VideoServer => {
  if (serverId === scrapeServer.id) {
    return scrapeServer;
  }
  return resolveVideoServerById(serverId) ?? scrapeServer;
};

export const usePlaybackModeStore = create<PlaybackModeState>()(
  persist(
    (set) => ({
      selectedServer: scrapeServer,
      setSelectedServer: (server) => {
        set((state) =>
          state.selectedServer.id === server.id
            ? state
            : { selectedServer: server },
        );
      },
    }),
    {
      name: "playback-mode-storage",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (str) {
            try {
              const parsed = JSON.parse(str);
              if (parsed.state?.selectedServerId) {
                parsed.state.selectedServer = resolveStoredServer(
                  parsed.state.selectedServerId as string,
                );
              }
              return parsed;
            } catch {
              return null;
            }
          }

          // Migrate selected server from legacy combined storage key.
          const legacy = localStorage.getItem("video-server-storage");
          if (!legacy) return null;
          try {
            const parsed = JSON.parse(legacy);
            const serverId = parsed.state?.selectedServerId as
              | string
              | undefined;
            if (!serverId) return null;
            return {
              state: {
                selectedServer: resolveStoredServer(serverId),
              },
              version: parsed.version,
            };
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              selectedServerId: value.state.selectedServer.id,
              selectedServer: undefined,
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
