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

export type SetSelectedServerOptions = {
  userInitiated?: boolean;
};

interface PlaybackModeState {
  selectedServer: VideoServer;
  hasUserSelectedPlaybackServer: boolean;
  setSelectedServer: (
    server: VideoServer,
    options?: SetSelectedServerOptions,
  ) => void;
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
      hasUserSelectedPlaybackServer: false,
      setSelectedServer: (server, options) => {
        set((state) => {
          const userInitiated = options?.userInitiated === true;
          const sameServer = state.selectedServer.id === server.id;
          if (
            sameServer &&
            (!userInitiated || state.hasUserSelectedPlaybackServer)
          ) {
            return state;
          }

          return {
            selectedServer: server,
            hasUserSelectedPlaybackServer:
              state.hasUserSelectedPlaybackServer || userInitiated,
          };
        });
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
