import { CustomFetcherName } from "@/utils/customFetchers";

export interface ContentRowConfig {
  category: string;
  mediaType: "movie" | "tv";
  customFetcher?: {
    name: CustomFetcherName;
    params?: Record<string, string>;
  };
}

/**
 * Centralized content row configuration that all pages should use.
 * This ensures consistency in fetching parameters across home, movies, and TV pages.
 */
export const CONTENT_ROW_CONFIG: Record<string, ContentRowConfig> = {
  // Standard movie categories
  "popular-movies": { category: "popular", mediaType: "movie" },
  "top-rated-movies": { category: "top_rated", mediaType: "movie" },
  "upcoming-movies": { category: "upcoming", mediaType: "movie" },
  "now-playing-movies": { category: "now_playing", mediaType: "movie" },
  "recent-releases": { category: "recent-releases", mediaType: "movie" },

  // Genre-based movie categories
  "action-movies": { category: "genre-action", mediaType: "movie" },
  "comedy-movies": { category: "genre-comedy", mediaType: "movie" },
  "drama-movies": { category: "genre-drama", mediaType: "movie" },
  "thriller-movies": { category: "genre-thriller", mediaType: "movie" },
  "horror-movies": { category: "genre-horror", mediaType: "movie" },
  "scifi-fantasy-movies": {
    category: "genre-scifi-fantasy",
    mediaType: "movie",
  },
  "romcom-movies": { category: "genre-romcom", mediaType: "movie" },
  "animation-movies": { category: "genre-animation", mediaType: "movie" },

  // Studio categories - using custom fetchers for better control
  "a24-films": {
    category: "studio-a24",
    mediaType: "movie",
    customFetcher: { name: "fetchByStudio", params: { studioKey: "a24" } },
  },
  "disney-magic": {
    category: "studio-disney",
    mediaType: "movie",
    customFetcher: { name: "fetchByStudio", params: { studioKey: "disney" } },
  },
  "pixar-animation": {
    category: "studio-pixar",
    mediaType: "movie",
    customFetcher: { name: "fetchByStudio", params: { studioKey: "pixar" } },
  },
  "warner-bros": {
    category: "studio-warner-bros",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByStudio",
      params: { studioKey: "warner-bros" },
    },
  },
  "universal-films": {
    category: "studio-universal",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByStudio",
      params: { studioKey: "universal" },
    },
  },
  "dreamworks-films": {
    category: "studio-dreamworks",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByStudio",
      params: { studioKey: "dreamworks" },
    },
  },

  // Director categories - using custom fetchers for consistent popularity sorting
  "nolan-films": {
    category: "director-nolan",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "nolan" },
    },
  },
  "tarantino-films": {
    category: "director-tarantino",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "tarantino" },
    },
  },
  "spielberg-films": {
    category: "director-spielberg",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "spielberg" },
    },
  },
  "scorsese-films": {
    category: "director-scorsese",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "scorsese" },
    },
  },
  "fincher-films": {
    category: "director-fincher",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "fincher" },
    },
  },
  "villeneuve-films": {
    category: "director-villeneuve",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "villeneuve" },
    },
  },
  "wright-films": {
    category: "director-wright",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "wright" },
    },
  },
  "anderson-wes-films": {
    category: "director-anderson-wes",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "anderson-wes" },
    },
  },
  "coen-films": {
    category: "director-coen",
    mediaType: "movie",
    customFetcher: { name: "fetchByDirector", params: { directorKey: "coen" } },
  },
  "ridley-scott-films": {
    category: "director-ridley-scott",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "ridley-scott" },
    },
  },
  "cameron-films": {
    category: "director-cameron",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "cameron" },
    },
  },
  "kubrick-films": {
    category: "director-kubrick",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "kubrick" },
    },
  },
  "hitchcock-films": {
    category: "director-hitchcock",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "hitchcock" },
    },
  },
  "ptanderson-films": {
    category: "director-ptanderson",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByDirector",
      params: { directorKey: "ptanderson" },
    },
  },

  // Collection/franchise categories
  "marvel-mcu": {
    category: "collection-marvel-mcu",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "marvel-mcu" },
    },
  },
  "star-wars": {
    category: "collection-star-wars",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "star-wars" },
    },
  },
  "fast-furious": {
    category: "collection-fast-furious",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "fast-furious" },
    },
  },
  "harry-potter": {
    category: "collection-harry-potter",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "harry-potter" },
    },
  },
  "lord-of-rings": {
    category: "collection-lord-of-rings",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "lord-of-rings" },
    },
  },
  "mission-impossible": {
    category: "collection-mission-impossible",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "mission-impossible" },
    },
  },
  "james-bond": {
    category: "collection-james-bond",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "james-bond" },
    },
  },
  "batman-dark-knight": {
    category: "collection-batman-dark-knight",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "batman-dark-knight" },
    },
  },
  "jurassic-park": {
    category: "collection-jurassic-park",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "jurassic-park" },
    },
  },
  transformers: {
    category: "collection-transformers",
    mediaType: "movie",
    customFetcher: {
      name: "fetchByCollection",
      params: { collectionKey: "transformers" },
    },
  },

  // Time-based categories
  "eighties-movies": { category: "year-80s", mediaType: "movie" },
  "nineties-movies": { category: "year-90s", mediaType: "movie" },
  "early-2000s-movies": { category: "year-2000s", mediaType: "movie" },
  "recent-movies": { category: "year-recent", mediaType: "movie" },

  // Curated movie picks
  "hidden-gems": { category: "hidden-gems", mediaType: "movie" },
  "critically-acclaimed": {
    category: "critically-acclaimed",
    mediaType: "movie",
  },
  "award-winners": { category: "award-winners", mediaType: "movie" },
  "cult-classics": { category: "cult-classics", mediaType: "movie" },

  // Standard TV categories
  "popular-tvshows": { category: "tv-popular", mediaType: "tv" },
  "top-rated-tvshows": { category: "tv-top-rated", mediaType: "tv" },
  "on-the-air-tvshows": { category: "tv-on-the-air", mediaType: "tv" },
  "airing-today-tvshows": { category: "tv-airing-today", mediaType: "tv" },

  // TV genres
  "drama-tvshows": { category: "tv-drama", mediaType: "tv" },
  "comedy-tvshows": { category: "tv-comedy", mediaType: "tv" },
  "action-tvshows": { category: "tv-action", mediaType: "tv" },
  "scifi-tvshows": { category: "tv-scifi", mediaType: "tv" },
  "crime-tvshows": { category: "tv-crime", mediaType: "tv" },
  "reality-tvshows": { category: "tv-reality", mediaType: "tv" },
  "animation-tvshows": { category: "tv-animation", mediaType: "tv" },

  // Curated TV content - using custom fetchers for better diversity
  "binge-worthy-series": {
    category: "tv-diverse",
    mediaType: "tv",
    customFetcher: { name: "fetchDiverseTV", params: {} },
  },
  "limited-series": { category: "tv-limited-series", mediaType: "tv" },
  sitcoms: {
    category: "tv-sitcoms",
    mediaType: "tv",
    customFetcher: { name: "fetchSitcoms", params: {} },
  },
  "network-hits": {
    category: "tv-network-hits",
    mediaType: "tv",
    customFetcher: { name: "fetchNetworkHits", params: {} },
  },
  docuseries: { category: "tv-docuseries", mediaType: "tv" },
  "reality-tv": { category: "tv-reality", mediaType: "tv" },

  // International content
  kdrama: { category: "tv-kdrama", mediaType: "tv" },
  "kdrama-romance": { category: "tv-kdrama-romance", mediaType: "tv" },
  "tv-anime": { category: "tv-anime", mediaType: "tv" },
  "tv-british-comedy": { category: "tv-british-comedy", mediaType: "tv" },
};

/**
 * Get content row configuration by ID
 */
export function getContentRowConfig(rowId: string): ContentRowConfig | null {
  return CONTENT_ROW_CONFIG[rowId] || null;
}

/**
 * Check if a row uses a custom fetcher
 */
export function hasCustomFetcher(rowId: string): boolean {
  const config = getContentRowConfig(rowId);
  return Boolean(config?.customFetcher);
}

/**
 * Get all available row IDs
 */
export function getAllRowIds(): string[] {
  return Object.keys(CONTENT_ROW_CONFIG);
}

/**
 * Get all movie row IDs
 */
export function getMovieRowIds(): string[] {
  return Object.entries(CONTENT_ROW_CONFIG)
    .filter(([_, config]) => config.mediaType === "movie")
    .map(([rowId]) => rowId);
}

/**
 * Get all TV row IDs
 */
export function getTVRowIds(): string[] {
  return Object.entries(CONTENT_ROW_CONFIG)
    .filter(([_, config]) => config.mediaType === "tv")
    .map(([rowId]) => rowId);
}

/**
 * Get all director-based row IDs
 */
export function getDirectorRowIds(): string[] {
  return Object.entries(CONTENT_ROW_CONFIG)
    .filter(([_, config]) => config.customFetcher?.name === "fetchByDirector")
    .map(([rowId]) => rowId);
}

/**
 * Get all studio-based row IDs
 */
export function getStudioRowIds(): string[] {
  return Object.entries(CONTENT_ROW_CONFIG)
    .filter(([_, config]) => config.customFetcher?.name === "fetchByStudio")
    .map(([rowId]) => rowId);
}
