import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  buildVidnestAnimePaheUrl,
  buildVidnestAnimeUrl,
  type VidsrcApi,
  VIDSRC_MIRROR_APIS,
} from "@/lib/providers/embed-urls";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import {
  isScrapeServer,
  usePlaybackModeStore,
} from "@/lib/stores/playback-mode-store";
import {
  setEmbedPrefsGetter,
  videoServers,
  type VideoServer,
} from "@/lib/stores/video-servers";

export type { VideoServer } from "@/lib/stores/video-servers";
export type { VidsrcApi } from "@/lib/providers/embed-urls";
export { VIDSRC_MIRROR_APIS } from "@/lib/providers/embed-urls";
export { videoServers } from "@/lib/stores/video-servers";

export interface ServerOverride {
  serverId: string;
  isAvailable: boolean;
  reason?: string;
}

const isServerOverrideUnavailable = (
  serverId: string,
  serverOverrides: ServerOverride[],
): boolean => {
  const override = serverOverrides.find((entry) => entry.serverId === serverId);
  return Boolean(override && !override.isAvailable);
};

/** Pick a non-scrape embed server when direct scrape sources all fail. */
export function pickFallbackEmbedServer(input: {
  unavailableServerIds: string[];
  serverOverrides: ServerOverride[];
}): VideoServer {
  const isSelectable = (serverId: string, requireAvailability: boolean) => {
    if (isServerOverrideUnavailable(serverId, input.serverOverrides)) {
      return false;
    }
    if (requireAvailability && input.unavailableServerIds.includes(serverId)) {
      return false;
    }
    return true;
  };

  const availableServer = videoServers.find((server) =>
    isSelectable(server.id, true),
  );
  if (availableServer) {
    return availableServer;
  }

  const anyEmbedServer = videoServers.find((server) =>
    isSelectable(server.id, false),
  );
  return anyEmbedServer ?? videoServers[0];
}

export const defaultServerOverrides: ServerOverride[] = [];

export interface ServerAvailabilityInput {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
  anilistId?: number;
  animeEpisodeNumber?: number;
  animePreference?: "sub" | "dub";
}

type ServerHealthResponse = {
  available: boolean;
  state: "available" | "unavailable" | "unknown";
  status: number | null;
};

const availabilityKeyFor = (
  input: ServerAvailabilityInput,
  vidsrcApi: VidsrcApi,
) =>
  [
    input.mediaType,
    input.tmdbId,
    input.seasonNumber ?? "",
    input.episodeNumber ?? "",
    input.anilistId ?? "",
    input.animeEpisodeNumber ?? "",
    input.animePreference ?? "",
    vidsrcApi,
  ].join(":");

interface EmbedServerState {
  serverOverrides: ServerOverride[];
  animePreference: "sub" | "dub";
  vidnestContentType: "movie" | "tv" | "anime" | "animepahe";
  vidsrcApi: VidsrcApi;
  availabilityKey: string | null;
  availableServerIds: string[];
  unavailableServerIds: string[];
  setAnimePreference: (preference: "sub" | "dub") => void;
  setVidnestContentType: (type: "movie" | "tv" | "anime" | "animepahe") => void;
  setVidsrcApi: (api: VidsrcApi) => void;
  prefetchServerAvailability: (input: ServerAvailabilityInput) => Promise<void>;
  getServerById: (id: string) => VideoServer | undefined;
  getFallbackEmbedServer: () => VideoServer;
  setServerOverride: (
    serverId: string,
    isAvailable: boolean,
    reason?: string,
  ) => void;
  removeServerOverride: (serverId: string) => void;
  isServerOverridden: (serverId: string) => boolean;
  getServerOverride: (serverId: string) => ServerOverride | undefined;
  resetServerOverrides: () => void;
  getAnimeUrl: (serverId: string, anilistId: number, episode: number) => string;
  getAnimePaheUrl: (
    serverId: string,
    anilistId: number,
    episode: number,
  ) => string;
}

export const useEmbedServerStore = create<EmbedServerState>()(
  persist(
    (set, get) => ({
      serverOverrides: defaultServerOverrides,
      animePreference: "sub" as "sub" | "dub",
      vidnestContentType: "movie" as "movie" | "tv" | "anime" | "animepahe",
      vidsrcApi: "1" as VidsrcApi,
      availabilityKey: null,
      availableServerIds: [],
      unavailableServerIds: [],
      setAnimePreference: (preference) => {
        set({ animePreference: preference });
      },
      setVidnestContentType: (type) => {
        set({ vidnestContentType: type });
      },
      setVidsrcApi: (api) => {
        set({ vidsrcApi: api });
      },
      prefetchServerAvailability: async (input) => {
        if (useAppSettingsStore.getState().noAdsMode) {
          set({
            availabilityKey: null,
            availableServerIds: [],
            unavailableServerIds: [],
          });
          return;
        }

        const availabilityKey = availabilityKeyFor(input, get().vidsrcApi);
        if (get().availabilityKey === availabilityKey) return;

        set({
          availabilityKey,
          availableServerIds: [],
          unavailableServerIds: [],
        });

        const results = await Promise.all(
          videoServers.map(async (server) => {
            const url =
              server.id === "vidnest" &&
              input.anilistId &&
              input.animeEpisodeNumber
                ? `https://vidnest.fun/anime/${input.anilistId}/${input.animeEpisodeNumber}/${input.animePreference ?? "sub"}`
                : input.mediaType === "tv" &&
                    input.seasonNumber &&
                    input.episodeNumber
                  ? server.getEpisodeUrl(
                      input.tmdbId,
                      input.seasonNumber,
                      input.episodeNumber,
                    )
                  : input.mediaType === "tv"
                    ? server.getTvUrl(input.tmdbId)
                    : server.getMovieUrl(input.tmdbId);

            try {
              const response = await fetch("/api/servers/health", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
              });
              if (!response.ok) {
                return {
                  server,
                  state: "unknown" as const,
                  unavailable: false,
                };
              }

              const health = (await response.json()) as ServerHealthResponse;
              return {
                server,
                state: health.state,
                unavailable: health.state === "unavailable",
              };
            } catch {
              return {
                server,
                state: "unknown" as const,
                unavailable: false,
              };
            }
          }),
        );

        if (get().availabilityKey !== availabilityKey) return;

        const unavailableServerIds = results
          .filter(({ unavailable }) => unavailable)
          .map(({ server }) => server.id);
        const availableServerIds = results
          .filter(({ state }) => state === "available")
          .map(({ server }) => server.id);

        const playbackState = usePlaybackModeStore.getState();
        const selectedServer = playbackState.selectedServer;
        const fallbackServer = results.find(
          ({ server, state }) =>
            state === "available" &&
            !get().serverOverrides.some(
              (override) =>
                override.serverId === server.id && !override.isAvailable,
            ),
        )?.server;

        const nextServer =
          useAppSettingsStore.getState().noAdsMode ||
          isScrapeServer(selectedServer) ||
          !unavailableServerIds.includes(selectedServer.id)
            ? selectedServer
            : fallbackServer || selectedServer;

        if (nextServer.id !== selectedServer.id) {
          playbackState.setSelectedServer(nextServer);
        }

        set({
          availableServerIds,
          unavailableServerIds,
        });
      },
      getServerById: (id) => videoServers.find((server) => server.id === id),
      getFallbackEmbedServer: () => {
        const { unavailableServerIds, serverOverrides } = get();
        return pickFallbackEmbedServer({
          unavailableServerIds,
          serverOverrides,
        });
      },
      setServerOverride: (serverId, isAvailable, reason) => {
        set((state) => ({
          serverOverrides: [
            ...state.serverOverrides.filter((o) => o.serverId !== serverId),
            { serverId, isAvailable, reason },
          ],
        }));
      },
      removeServerOverride: (serverId) => {
        set((state) => ({
          serverOverrides: state.serverOverrides.filter(
            (o) => o.serverId !== serverId,
          ),
        }));
      },
      isServerOverridden: (serverId) => {
        const { serverOverrides } = get();
        return serverOverrides.some((o) => o.serverId === serverId);
      },
      getServerOverride: (serverId) => {
        const { serverOverrides } = get();
        return serverOverrides.find((o) => o.serverId === serverId);
      },
      resetServerOverrides: () => {
        set({ serverOverrides: defaultServerOverrides });
      },
      getAnimeUrl: (serverId, anilistId, episode) => {
        const server = videoServers.find((s) => s.id === serverId);
        if (!server?.getAnimeUrl) return "";
        if (serverId === "vidnest") {
          const { animePreference } = get();
          return buildVidnestAnimeUrl(anilistId, episode, {
            vidsrcApi: get().vidsrcApi,
            animePreference,
          });
        }
        return server.getAnimeUrl(anilistId, episode);
      },
      getAnimePaheUrl: (serverId, anilistId, episode) => {
        const server = videoServers.find((s) => s.id === serverId);
        if (!server?.getAnimePaheUrl) return "";
        if (serverId === "vidnest") {
          const { animePreference } = get();
          return buildVidnestAnimePaheUrl(anilistId, episode, {
            vidsrcApi: get().vidsrcApi,
            animePreference,
          });
        }
        return server.getAnimePaheUrl(anilistId, episode);
      },
    }),
    {
      name: "embed-server-storage",
      partialize: (state) => ({
        serverOverrides: state.serverOverrides,
        animePreference: state.animePreference,
        vidnestContentType: state.vidnestContentType,
        vidsrcApi: state.vidsrcApi,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (str) {
            try {
              return JSON.parse(str);
            } catch {
              return null;
            }
          }

          const legacy = localStorage.getItem("video-server-storage");
          if (!legacy) return null;
          try {
            const parsed = JSON.parse(legacy);
            if (!parsed.state) return null;
            return {
              ...parsed,
              state: {
                serverOverrides: parsed.state.serverOverrides,
                animePreference: parsed.state.animePreference,
                vidnestContentType: parsed.state.vidnestContentType,
                vidsrcApi: parsed.state.vidsrcApi,
              },
            };
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);

setEmbedPrefsGetter(() => {
  const { vidsrcApi, animePreference } = useEmbedServerStore.getState();
  return { vidsrcApi, animePreference };
});
