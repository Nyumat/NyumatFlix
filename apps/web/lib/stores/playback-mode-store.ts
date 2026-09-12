import { create } from "zustand";

import {
  resolveVideoServerById,
  type VideoServer,
  videoServers,
} from "@/lib/stores/video-servers";
import { patchUserSettings } from "@/lib/user/patch-user-settings";

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
  policyGenerationAtChoice?: string | null;
};

interface PlaybackModeState {
  selectedServer: VideoServer;
  hasUserSelectedPlaybackServer: boolean;
  policyGenerationAtChoice: string | null;
  setSelectedServer: (
    server: VideoServer,
    options?: SetSelectedServerOptions,
  ) => void;
}

export const usePlaybackModeStore = create<PlaybackModeState>()((set) => ({
  selectedServer: defaultServer,
  hasUserSelectedPlaybackServer: false,
  policyGenerationAtChoice: null,
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

      const next = {
        selectedServer: server,
        hasUserSelectedPlaybackServer:
          state.hasUserSelectedPlaybackServer || userInitiated,
        policyGenerationAtChoice:
          options?.policyGenerationAtChoice ?? state.policyGenerationAtChoice,
      };

      if (userInitiated) {
        void patchUserSettings({
          selectedServerId: server.id,
          userSelectedPlaybackServer: true,
          policyGenerationAtChoice: next.policyGenerationAtChoice,
        });
      }

      return next;
    });
  },
}));

export const resolveStoredServer = (serverId: string): VideoServer => {
  if (serverId === scrapeServer.id) {
    return scrapeServer;
  }
  return resolveVideoServerById(serverId) ?? defaultServer;
};
