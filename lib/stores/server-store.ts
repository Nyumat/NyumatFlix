import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface VideoServer {
  id: string;
  name: string;
  baseUrl: string;
  getMovieUrl: (tmdbId: number) => string;
  getTvUrl: (tmdbId: number) => string;
  getEpisodeUrl: (tmdbId: number, season: number, episode: number) => string;
  checkAvailability?: (type: "movie" | "tv") => Promise<number[]>;
  checkIndividualAvailability?: (
    tmdbId: number,
    type: "movie" | "tv",
    season?: number,
    episode?: number,
  ) => Promise<boolean>;
}

export interface ServerOverride {
  serverId: string;
  isAvailable: boolean;
  reason?: string; // Optional reason for the override (e.g., "Server down", "Maintenance")
}

export const videoServers: VideoServer[] = [
  {
    id: "vidsrc",
    name: "VidSrc",
    baseUrl: "https://vidsrc.xyz",
    getMovieUrl: (tmdbId) => `https://vidsrc.xyz/embed/movie?tmdb=${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vidsrc.xyz/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
    // VidSrc doesn't have availability checking, assume always available
  },
  {
    id: "superembed",
    name: "SuperEmbed",
    baseUrl: "https://multiembed.mov",
    getMovieUrl: (tmdbId) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
    getTvUrl: (tmdbId) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
    // SuperEmbed regular player doesn't have availability checking, assume always available
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    baseUrl: "https://player.autoembed.cc",
    getMovieUrl: (tmdbId) => `https://player.autoembed.cc/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://player.autoembed.cc/embed/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
    // AutoEmbed doesn't have availability checking, assume always available
  },
  {
    id: "111movies",
    name: "111Movies",
    baseUrl: "https://111movies.com",
    getMovieUrl: (tmdbId) => `https://111movies.com/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://111movies.com/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://111movies.com/tv/${tmdbId}/${season}/${episode}`,
    // 111Movies doesn't have availability checking, assume always available
  },
];

export const defaultServerOverrides: ServerOverride[] = [];

interface ServerState {
  selectedServer: VideoServer;
  serverOverrides: ServerOverride[];
  setSelectedServer: (server: VideoServer) => void;
  getServerById: (id: string) => VideoServer | undefined;
  getAvailableServer: (
    tmdbId: number,
    type: "movie" | "tv",
    availabilityData?: {
      [serverId: string]: {
        movies: number[];
        tv: number[];
        isLoading: boolean;
      };
    },
  ) => VideoServer;
  setServerOverride: (
    serverId: string,
    isAvailable: boolean,
    reason?: string,
  ) => void;
  removeServerOverride: (serverId: string) => void;
  isServerOverridden: (serverId: string) => boolean;
  getServerOverride: (serverId: string) => ServerOverride | undefined;
  resetServerOverrides: () => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      selectedServer: videoServers[0], // Default to VidSrc
      serverOverrides: defaultServerOverrides,
      setSelectedServer: (server) => {
        set({ selectedServer: server });
      },
      getServerById: (id) => {
        return videoServers.find((server) => server.id === id);
      },
      getAvailableServer: (tmdbId, type, availabilityData) => {
        const { serverOverrides } = get();

        // If no availability data provided, return current selected server if it's not overridden as unavailable
        if (!availabilityData) {
          const currentServer = get().selectedServer;
          const override = serverOverrides.find(
            (o) => o.serverId === currentServer.id,
          );
          if (override && !override.isAvailable) {
            // Current server is manually marked as unavailable, find alternative
            for (const server of videoServers) {
              const serverOverride = serverOverrides.find(
                (o) => o.serverId === server.id,
              );
              if (!serverOverride || serverOverride.isAvailable) {
                return server;
              }
            }
          }
          return currentServer;
        }

        // Check current selected server first
        const currentServer = get().selectedServer;
        const currentServerOverride = serverOverrides.find(
          (o) => o.serverId === currentServer.id,
        );

        // If current server is manually marked as unavailable, skip it
        if (currentServerOverride && !currentServerOverride.isAvailable) {
          // Skip to finding alternative server
        } else {
          const currentServerData = availabilityData[currentServer.id];
          if (currentServerData && !currentServerData.isLoading) {
            const isCurrentAvailable =
              currentServerData[type]?.includes(tmdbId);
            if (isCurrentAvailable) {
              return currentServer;
            }
          }
        }

        // Find first available server, considering manual overrides
        for (const server of videoServers) {
          const serverOverride = serverOverrides.find(
            (o) => o.serverId === server.id,
          );

          // If server is manually marked as unavailable, skip it
          if (serverOverride && !serverOverride.isAvailable) {
            continue;
          }

          const serverData = availabilityData[server.id];
          if (!serverData || serverData.isLoading) continue;

          // If server has no availability checking, consider it available
          if (
            !server.checkAvailability &&
            !server.checkIndividualAvailability
          ) {
            return server;
          }

          // Check if content is available on this server
          if (serverData[type]?.includes(tmdbId)) {
            return server;
          }
        }

        // If no available server found, return VidSrc as fallback (if not overridden as unavailable)
        const vidsrcOverride = serverOverrides.find(
          (o) => o.serverId === "vidsrc",
        );
        if (!vidsrcOverride || vidsrcOverride.isAvailable) {
          return videoServers[0];
        }

        // If VidSrc is also unavailable, return any available server
        for (const server of videoServers) {
          const serverOverride = serverOverrides.find(
            (o) => o.serverId === server.id,
          );
          if (!serverOverride || serverOverride.isAvailable) {
            return server;
          }
        }

        // Fallback to VidSrc even if marked unavailable
        return videoServers[0];
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
    }),
    {
      name: "video-server-storage",
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            const parsed = JSON.parse(str);
            // Reconstruct the server object with methods
            if (parsed.state && parsed.state.selectedServerId) {
              const server = videoServers.find(
                (s) => s.id === parsed.state.selectedServerId,
              );
              if (server) {
                parsed.state.selectedServer = server;
              } else {
                parsed.state.selectedServer = videoServers[0];
              }
            }
            return parsed;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          // Only store the server ID, not the full object
          const toStore = {
            ...value,
            state: {
              ...value.state,
              selectedServerId: value.state.selectedServer.id,
              selectedServer: undefined, // Don't store the full server object
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
