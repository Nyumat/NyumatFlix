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
}

export interface ServerOverride {
  serverId: string;
  isAvailable: boolean;
  reason?: string; // Optional reason for the override (e.g., "Server down", "Maintenance")
}
// Old -> vidsrc.xyz - vsrc.su
// New: vsembed.ru - vsembed.su
export const videoServers: VideoServer[] = [
  {
    id: "vidsrc",
    name: "VidSrc",
    baseUrl: "https://vsembed.ru",
    getMovieUrl: (tmdbId) => `https://vsembed.ru/embed/movie?tmdb=${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vsembed.ru/embed/tv?tmdb=${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vsembed.ru/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
  },
  // {
  //   id: "superembed",
  //   name: "SuperEmbed",
  //   baseUrl: "https://multiembed.mov",
  //   getMovieUrl: (tmdbId) =>
  //     `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
  //   getTvUrl: (tmdbId) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
  //   getEpisodeUrl: (tmdbId, season, episode) =>
  //     `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
  // },
  // {
  //   id: "autoembed",
  //   name: "AutoEmbed",
  //   baseUrl: "https://player.autoembed.cc",
  //   getMovieUrl: (tmdbId) =>
  //     `https://player.autoembed.cc/embed/movie/${tmdbId}`,
  //   getTvUrl: (tmdbId) => `https://player.autoembed.cc/embed/tv/${tmdbId}`,
  //   getEpisodeUrl: (tmdbId, season, episode) =>
  //     `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
  // },
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
    getAnimeUrl: (anilistId, episode) => {
      const state = useServerStore.getState();
      const preference = state.animePreference;
      return `https://vidnest.fun/anime/${anilistId}/${episode}/${preference}`;
    },
    getAnimePaheUrl: (anilistId, episode) => {
      const state = useServerStore.getState();
      const preference = state.animePreference;
      return `https://vidnest.fun/animepahe/${anilistId}/${episode}/${preference}`;
    },
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
  {
    id: "vidfast",
    name: "VidFast",
    baseUrl: "https://vidfast.pro",
    getMovieUrl: (tmdbId) =>
      `https://vidfast.pro/movie/${tmdbId}?autoPlay=true`,
    getTvUrl: (tmdbId) => `https://vidfast.pro/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}?autoPlay=true&nextButton=true&autoNext=true`,
  },
  {
    id: "videasy",
    name: "VidEasy",
    baseUrl: "https://player.videasy.net",
    getMovieUrl: (tmdbId) => `https://player.videasy.net/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://player.videasy.net/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`,
    getAnimeUrl: (anilistId, episode) => {
      const state = useServerStore.getState();
      const dubParam = state.animePreference === "dub" ? "?dub=true" : "";
      return `https://player.videasy.net/anime/${anilistId}/${episode}${dubParam}`;
    },
  },
  // {
  //   id: "vixsrc",
  //   name: "VixSrc",
  //   baseUrl: "https://vixsrc.to",
  //   getMovieUrl: (tmdbId) => `https://vixsrc.to/movie/${tmdbId}?autoplay=true`,
  //   getTvUrl: (tmdbId) => `https://vixsrc.to/tv/${tmdbId}/1/1`,
  //   getEpisodeUrl: (tmdbId, season, episode) =>
  //     `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}?autoplay=true`,
  // },
  {
    id: "vidking",
    name: "VidKing",
    baseUrl: "https://www.vidking.net",
    getMovieUrl: (tmdbId) =>
      `https://www.vidking.net/embed/movie/${tmdbId}?color=9146ff&autoPlay=true`,
    getTvUrl: (tmdbId) =>
      `https://www.vidking.net/embed/tv/${tmdbId}/1/1?color=9146ff&autoPlay=true&nextEpisode=true&episodeSelector=true`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://www.vidking.net/embed/tv/${tmdbId}/${season}/${episode}?color=9146ff&autoPlay=true&nextEpisode=true&episodeSelector=true`,
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
  getAvailableServer: (tmdbId: number, type: "movie" | "tv") => VideoServer;
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
      vidnestContentType: "movie" as "movie" | "tv" | "anime" | "animepahe",
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
      getAvailableServer: (tmdbId, type) => {
        const { serverOverrides } = get();
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
