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
    id: "embedsu",
    name: "Embed.su",
    baseUrl: "https://embed.su",
    getMovieUrl: (tmdbId) => `https://embed.su/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://embed.su/embed/tv/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}`,
    checkIndividualAvailability: async (tmdbId, type) => {
      try {
        const response = await fetch(
          `/api/embed-su-availability?type=${type}&tmdbId=${tmdbId}`,
        );
        if (!response.ok) {
          console.warn(
            `Embed.su availability API returned ${response.status} for ${type} TMDB ${tmdbId}`,
          );
          return false;
        }
        const data = await response.json();
        return data.available === true;
      } catch (error) {
        console.error(
          `Error checking ${type} availability for Embed.su TMDB ${tmdbId}:`,
          error,
        );
        return false;
      }
    },
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
  {
    id: "filmku",
    name: "FilmKu",
    baseUrl: "https://filmku.stream",
    getMovieUrl: (tmdbId) => `https://filmku.stream/embed/movie?tmdb=${tmdbId}`,
    getTvUrl: (tmdbId) => `https://filmku.stream/embed/series?tmdb=${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://filmku.stream/embed/series?tmdb=${tmdbId}&sea=${season}&epi=${episode}`,
    checkIndividualAvailability: async (tmdbId, type, season, episode) => {
      try {
        // Use our API route to keep TMDB API key secure
        let url = `/api/filmku-availability?tmdbId=${tmdbId}&type=${type}`;
        if (season !== undefined && episode !== undefined) {
          url += `&season=${season}&episode=${episode}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          console.warn(
            `FilmKu availability API returned ${response.status} for TMDB ${tmdbId}`,
          );
          return false;
        }

        const data = await response.json();
        return data.available === true;
      } catch (error) {
        console.error(
          `Error checking FilmKu availability for TMDB ${tmdbId}:`,
          error,
        );
        return false;
      }
    },
  },
];

interface ServerState {
  selectedServer: VideoServer;
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
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      selectedServer: videoServers[0], // Default to VidSrc
      setSelectedServer: (server) => {
        set({ selectedServer: server });
      },
      getServerById: (id) => {
        return videoServers.find((server) => server.id === id);
      },
      getAvailableServer: (tmdbId, type, availabilityData) => {
        // If no availability data provided, return current selected server
        if (!availabilityData) {
          return get().selectedServer;
        }

        // Check current selected server first
        const currentServer = get().selectedServer;
        const currentServerData = availabilityData[currentServer.id];

        if (currentServerData && !currentServerData.isLoading) {
          const isCurrentAvailable = currentServerData[type]?.includes(tmdbId);
          if (isCurrentAvailable) {
            return currentServer;
          }
        }

        // Find first available server
        for (const server of videoServers) {
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

        // If no available server found, return VidSrc as fallback
        return videoServers[0];
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
