import {
  buildVideasyAnimeUrl,
  buildVidnestAnimePaheUrl,
  buildVidnestAnimeUrl,
  buildVidnestContentUrl,
  buildVidsrcMirrorEpisodeUrl,
  buildVidsrcMirrorMovieUrl,
  buildVidsrcMirrorTvUrl,
  type EmbedUrlPrefs,
} from "@/lib/providers/embed-urls";

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

let embedPrefsGetter: () => EmbedUrlPrefs = () => ({
  vidsrcApi: "1",
  animePreference: "sub",
});

export const setEmbedPrefsGetter = (getter: () => EmbedUrlPrefs) => {
  embedPrefsGetter = getter;
};

const prefs = () => embedPrefsGetter();

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
  {
    id: "vidsrc-mirror",
    name: "VidSrc Mirror",
    baseUrl: "https://vidsrc.wtf",
    getMovieUrl: (tmdbId) => buildVidsrcMirrorMovieUrl(tmdbId, prefs()),
    getTvUrl: (tmdbId) => buildVidsrcMirrorTvUrl(tmdbId, prefs()),
    getEpisodeUrl: (tmdbId, season, episode) =>
      buildVidsrcMirrorEpisodeUrl(tmdbId, season, episode, prefs()),
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
    id: "2embed",
    name: "2Embed",
    baseUrl: "https://www.2embed.cc",
    getMovieUrl: (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://www.2embed.cc/embedtvfull/${tmdbId}`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
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
      buildVidnestAnimeUrl(anilistId, episode, prefs()),
    getAnimePaheUrl: (anilistId, episode) =>
      buildVidnestAnimePaheUrl(anilistId, episode, prefs()),
    getVidnestUrl: (tmdbId, contentType, season, episode, anilistId) =>
      buildVidnestContentUrl(
        tmdbId,
        contentType,
        prefs(),
        season,
        episode,
        anilistId,
      ),
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
    getAnimeUrl: (anilistId, episode) =>
      buildVideasyAnimeUrl(anilistId, episode, prefs()),
  },
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
  {
    id: "vixsrc",
    name: "VixSrc",
    baseUrl: "https://vixsrc.to",
    getMovieUrl: (tmdbId) => `https://vixsrc.to/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vixsrc.to/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidlink",
    name: "VidLink",
    baseUrl: "https://vidlink.pro",
    getMovieUrl: (tmdbId) => `https://vidlink.pro/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vidlink.pro/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidcore",
    name: "VidCore",
    baseUrl: "https://www.vidcore.org",
    getMovieUrl: (tmdbId) => `https://www.vidcore.org/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://www.vidcore.org/embed/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://www.vidcore.org/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "1embed",
    name: "1Embed",
    baseUrl: "https://1embed.cc",
    getMovieUrl: (tmdbId) => `https://1embed.cc/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://1embed.cc/embed/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://1embed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidlux",
    name: "VidLux",
    baseUrl: "https://vidlux.xyz",
    getMovieUrl: (tmdbId) => `https://vidlux.xyz/embed/movie/${tmdbId}`,
    getTvUrl: (tmdbId) => `https://vidlux.xyz/embed/tv/${tmdbId}/1/1`,
    getEpisodeUrl: (tmdbId, season, episode) =>
      `https://vidlux.xyz/embed/tv/${tmdbId}/${season}/${episode}`,
  },
];

export const resolveVideoServerById = (id: string): VideoServer | undefined =>
  videoServers.find((server) => server.id === id);
