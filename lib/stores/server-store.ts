import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface VideoServer {
  id: string;
  name: string;
  baseUrl: string;
  getMovieUrl: (tmdbId: number) => string;
  getTvUrl: (tmdbId: number) => string;
  getEpisodeUrl: (tmdbId: number, season: number, episode: number) => string;
  getAnimeUrl?: (anilistId: number, episode: number) => string;
  getAnimePaheUrl?: (anilistId: number, episode: number) => string;
  getVidnestUrl?: (
    tmdbId: number,
    contentType: "movie" | "tv" | "anime" | "animepahe",
    season?: number,
    episode?: number,
    anilistId?: number,
  ) => string;
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
// Old -> vidsrc.xyz
// New: vidsrc-embed.ru - vidsrc-embed.su - vidsrcme.su - vsrc.su
export const videoServers: VideoServer[] = [
  {
    id: "vidsrc",
    name: "VidSrc",
    baseUrl: "https://vsrc.su",
    getMovieUrl: (tmdbId) => `https://vsrc.su/embed/movie?tmdb=${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vsrc.su/embed/tv?tmdb=${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vsrc.su/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
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
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    baseUrl: "https://player.autoembed.cc",
    getMovieUrl: (tmdbId) =>
      `https://player.autoembed.cc/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://player.autoembed.cc/embed/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "111movies",
    name: "111Movies",
    baseUrl: "https://111movies.com",
    getMovieUrl: (tmdbId) => `https://111movies.com/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://111movies.com/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://111movies.com/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidnest",
    name: "VidNest",
    baseUrl: "https://vidnest.fun",
    getMovieUrl: (tmdbId) => `https://vidnest.fun/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vidnest.fun/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`,
    getAnimeUrl: (anilistId, episode) =>
      `https://vidnest.fun/anime/${anilistId}/${episode}/sub`,
    getAnimePaheUrl: (anilistId, episode) =>
      `https://vidnest.fun/animepahe/${anilistId}/${episode}/sub`,
    getVidnestUrl: (tmdbId, contentType, season, episode, anilistId) => {
      const state = useServerStore.getState();
      const preference = state.animePreference;
      switch (contentType) {
        case "movie":
          return `https://vidnest.fun/movie/${tmdbId}`;
        case "tv":
          if (season && episode) {
            return `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`;
          }
          return `https://vidnest.fun/tv/${tmdbId}`;
        case "anime":
          if (anilistId && episode) {
            return `https://vidnest.fun/anime/${anilistId}/${episode}/${preference}`;
          }
          return "";
        case "animepahe":
          if (anilistId && episode) {
            return `https://vidnest.fun/animepahe/${anilistId}/${episode}/${preference}`;
          }
          return "";
        default:
          return "";
      }
    },
  },
];

export const defaultServerOverrides: ServerOverride[] = [];

interface ServerState {
  selectedServer: VideoServer;
  serverOverrides: ServerOverride[];
  animePreference: "sub" | "dub";
  vidnestContentType: "movie" | "tv" | "anime" | "animepahe";
  setSelectedServer: (server: VideoServer) => void;
  setAnimePreference: (preference: "sub" | "dub") => void;
  setVidnestContentType: (type: "movie" | "tv" | "anime" | "animepahe") => void;
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
  getAnimeUrl: (serverId: string, anilistId: number, episode: number) => string;
  getAnimePaheUrl: (
    serverId: string,
    anilistId: number,
    episode: number,
  ) => string;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      selectedServer: videoServers[0],
      serverOverrides: defaultServerOverrides,
      animePreference: "sub" as "sub" | "dub",
      vidnestContentType: "movie" as "movie" | "tv" | "anime",
      setSelectedServer: (server) => {
        set({ selectedServer: server });
      },
      setAnimePreference: (preference) => {
        set({ animePreference: preference });
      },
      setVidnestContentType: (type) => {
        set({ vidnestContentType: type });
      },
      getServerById: (id) => {
        return videoServers.find((server) => server.id === id);
      },
      getAvailableServer: (tmdbId, type, availabilityData) => {
        const { serverOverrides } = get();

        if (!availabilityData) {
          const currentServer = get().selectedServer;
          const override = serverOverrides.find(
            (o) => o.serverId === currentServer.id,
          );
          if (override && !override.isAvailable) {
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

        const currentServer = get().selectedServer;
        const currentServerOverride = serverOverrides.find(
          (o) => o.serverId === currentServer.id,
        );

        if (currentServerOverride && !currentServerOverride.isAvailable) {
          // Current server is manually overridden as unavailable, skip availability check
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

        for (const server of videoServers) {
          const serverOverride = serverOverrides.find(
            (o) => o.serverId === server.id,
          );

          if (serverOverride && !serverOverride.isAvailable) {
            continue;
          }

          const serverData = availabilityData[server.id];
          if (!serverData || serverData.isLoading) continue;

          if (
            !server.checkAvailability &&
            !server.checkIndividualAvailability
          ) {
            return server;
          }

          if (serverData[type]?.includes(tmdbId)) {
            return server;
          }
        }

        const vidsrcOverride = serverOverrides.find(
          (o) => o.serverId === "vidsrc",
        );
        if (!vidsrcOverride || vidsrcOverride.isAvailable) {
          return videoServers[0];
        }

        for (const server of videoServers) {
          const serverOverride = serverOverrides.find(
            (o) => o.serverId === server.id,
          );
          if (!serverOverride || serverOverride.isAvailable) {
            return server;
          }
        }

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
      getAnimeUrl: (serverId, anilistId, episode) => {
        const server = videoServers.find((s) => s.id === serverId);
        if (!server || !server.getAnimeUrl) return "";
        if (serverId === "vidnest") {
          const preference = get().animePreference;
          return `https://vidnest.fun/anime/${anilistId}/${episode}/${preference}`;
        }
        return server.getAnimeUrl(anilistId, episode);
      },
      getAnimePaheUrl: (serverId, anilistId, episode) => {
        const server = videoServers.find((s) => s.id === serverId);
        if (!server || !server.getAnimePaheUrl) return "";
        if (serverId === "vidnest") {
          const preference = get().animePreference;
          return `https://vidnest.fun/animepahe/${anilistId}/${episode}/${preference}`;
        }
        return server.getAnimePaheUrl(anilistId, episode);
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
