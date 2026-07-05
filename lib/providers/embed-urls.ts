export const EMBED_ACCENT_COLOR = "9146ff";

export type VidsrcApi = "1" | "2" | "3" | "4";

export const VIDSRC_MIRROR_APIS: {
  value: VidsrcApi;
  label: string;
  description: string;
}[] = [
  { value: "1", label: "Multi Server", description: "API 1" },
  { value: "2", label: "Multi Language", description: "API 2" },
  { value: "3", label: "Multi Embeds", description: "API 3" },
  { value: "4", label: "Premium", description: "API 4" },
];

export type EmbedUrlPrefs = {
  vidsrcApi: VidsrcApi;
  animePreference: "sub" | "dub";
};

export const buildVidsrcMirrorMovieUrl = (
  tmdbId: number,
  prefs: EmbedUrlPrefs,
): string =>
  `https://vidsrc.wtf/${prefs.vidsrcApi}/movie/${tmdbId}?color=${EMBED_ACCENT_COLOR}`;

export const buildVidsrcMirrorTvUrl = (
  tmdbId: number,
  prefs: EmbedUrlPrefs,
): string =>
  `https://vidsrc.wtf/${prefs.vidsrcApi}/tv/${tmdbId}/1/1?color=${EMBED_ACCENT_COLOR}`;

export const buildVidsrcMirrorEpisodeUrl = (
  tmdbId: number,
  season: number,
  episode: number,
  prefs: EmbedUrlPrefs,
): string =>
  `https://vidsrc.wtf/${prefs.vidsrcApi}/tv/${tmdbId}/${season}/${episode}?color=${EMBED_ACCENT_COLOR}`;

export const buildVidnestAnimeUrl = (
  anilistId: number,
  episode: number,
  prefs: EmbedUrlPrefs,
): string =>
  `https://vidnest.fun/anime/${anilistId}/${episode}/${prefs.animePreference}`;

export const buildVidnestAnimePaheUrl = (
  anilistId: number,
  episode: number,
  prefs: EmbedUrlPrefs,
): string =>
  `https://vidnest.fun/animepahe/${anilistId}/${episode}/${prefs.animePreference}`;

export const buildVideasyAnimeUrl = (
  anilistId: number,
  episode: number,
  prefs: EmbedUrlPrefs,
): string => {
  const dubParam = prefs.animePreference === "dub" ? "?dub=true" : "";
  return `https://player.videasy.net/anime/${anilistId}/${episode}${dubParam}`;
};

export const buildVidnestContentUrl = (
  tmdbId: number,
  contentType: "movie" | "tv" | "anime" | "animepahe",
  prefs: EmbedUrlPrefs,
  season?: number,
  episode?: number,
  anilistId?: number,
): string => {
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
        return buildVidnestAnimeUrl(anilistId, episode, prefs);
      }
      return "";
    case "animepahe":
      if (anilistId && episode) {
        return buildVidnestAnimePaheUrl(anilistId, episode, prefs);
      }
      return "";
    default:
      return "";
  }
};
