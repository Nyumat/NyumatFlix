import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  resolveVideoServerById,
  type VideoServer,
  videoServers,
} from "@/lib/stores/video-servers";

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

const defaultServer = videoServers[0];

if (!defaultServer) {
  throw new Error("At least one iframe video server must be configured");
}

interface PlaybackModeState {
  selectedServer: VideoServer;
  setSelectedServer: (server: VideoServer) => void;
}

const resolveStoredServer = (serverId: string): VideoServer => {
  if (serverId === scrapeServer.id) {
    return scrapeServer;
  }
  return resolveVideoServerById(serverId) ?? defaultServer;
};

export const usePlaybackModeStore = create<PlaybackModeState>()(
  persist(
    (set) => ({
      selectedServer: defaultServer,
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
