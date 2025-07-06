import { MediaItem } from "./typings";

export interface ContentFilter {
  id: string;
  title: string;
  type: "category" | "genre" | "year" | "studio" | "director" | "special";
  fetchConfig: {
    endpoint?: string;
    params?: Record<string, string>;
    customFetch?: (
      page: number,
    ) => Promise<{ results: MediaItem[]; total_pages?: number }>;
  };
}

// Define all content filters with their configurations
export const CONTENT_FILTERS: Record<string, ContentFilter> = {
  // Standard categories
  popular: {
    id: "popular",
    title: "Popular Movies",
    type: "category",
    fetchConfig: {
      endpoint: "/movie/popular",
    },
  },
  "top-rated": {
    id: "top-rated",
    title: "Top Rated Movies",
    type: "category",
    fetchConfig: {
      endpoint: "/movie/top_rated",
    },
  },
  "now-playing": {
    id: "now-playing",
    title: "Now Playing",
    type: "category",
    fetchConfig: {
      endpoint: "/movie/now_playing",
    },
  },
  upcoming: {
    id: "upcoming",
    title: "Upcoming Movies",
    type: "category",
    fetchConfig: {
      endpoint: "/movie/upcoming",
    },
  },

  // Genre filters
  "genre-action": {
    id: "genre-action",
    title: "Action Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "28",
      },
    },
  },
  "genre-comedy": {
    id: "genre-comedy",
    title: "Comedy Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "35",
      },
    },
  },
  "genre-drama": {
    id: "genre-drama",
    title: "Drama Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "18",
      },
    },
  },
  "genre-thriller": {
    id: "genre-thriller",
    title: "Thriller Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "53",
      },
    },
  },
  "genre-horror": {
    id: "genre-horror",
    title: "Horror Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "27",
      },
    },
  },
  "genre-scifi-fantasy": {
    id: "genre-scifi-fantasy",
    title: "Sci-Fi & Fantasy Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "878,14",
      },
    },
  },
  "genre-romcom": {
    id: "genre-romcom",
    title: "Romantic Comedies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "10749,35",
      },
    },
  },

  // Year filters
  "year-80s": {
    id: "year-80s",
    title: "80s Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "1980-01-01",
        "primary_release_date.lte": "1989-12-31",
      },
    },
  },
  "year-90s": {
    id: "year-90s",
    title: "90s Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "1990-01-01",
        "primary_release_date.lte": "1999-12-31",
      },
    },
  },
  "year-2000s": {
    id: "year-2000s",
    title: "Early 2000s Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2000-01-01",
        "primary_release_date.lte": "2009-12-31",
      },
    },
  },

  // Studio filters
  "studio-a24": {
    id: "studio-a24",
    title: "A24 Films",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "41077",
      },
    },
  },
  "studio-pixar": {
    id: "studio-pixar",
    title: "Pixar Animation Studios",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "3",
      },
    },
  },
  "studio-disney": {
    id: "studio-disney",
    title: "Disney Movies",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "2",
      },
    },
  },
  "studio-warner-bros": {
    id: "studio-warner-bros",
    title: "Warner Bros. Pictures",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "174",
      },
    },
  },
  "studio-universal": {
    id: "studio-universal",
    title: "Universal Pictures",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "33",
      },
    },
  },
  "studio-dreamworks": {
    id: "studio-dreamworks",
    title: "DreamWorks Pictures",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_companies: "521",
      },
    },
  },

  // Director filters
  "director-nolan": {
    id: "director-nolan",
    title: "Christopher Nolan Films",
    type: "director",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_crew: "525",
      },
    },
  },
  "director-tarantino": {
    id: "director-tarantino",
    title: "Quentin Tarantino Films",
    type: "director",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_crew: "138",
      },
    },
  },
  "director-spielberg": {
    id: "director-spielberg",
    title: "Steven Spielberg Films",
    type: "director",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_crew: "488",
      },
    },
  },
  "director-scorsese": {
    id: "director-scorsese",
    title: "Martin Scorsese Films",
    type: "director",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_crew: "1032",
      },
    },
  },
  "director-fincher": {
    id: "director-fincher",
    title: "David Fincher Films",
    type: "director",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_crew: "7467",
      },
    },
  },

  // Special filters
  "critically-acclaimed": {
    id: "critically-acclaimed",
    title: "Critically Acclaimed Movies",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_average.gte": "8.0",
        "vote_count.gte": "2000",
        sort_by: "vote_average.desc",
      },
    },
  },
  "hidden-gems": {
    id: "hidden-gems",
    title: "Hidden Gems",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_average.gte": "7.5",
        "vote_count.gte": "500",
        "vote_count.lte": "5000",
        sort_by: "vote_average.desc",
      },
    },
  },

  // TV Show filters
  "tv-popular": {
    id: "tv-popular",
    title: "Popular TV Shows",
    type: "category",
    fetchConfig: {
      endpoint: "/tv/popular",
    },
  },
  "tv-top-rated": {
    id: "tv-top-rated",
    title: "Top Rated TV Shows",
    type: "category",
    fetchConfig: {
      endpoint: "/tv/top_rated",
    },
  },
  "tv-on-the-air": {
    id: "tv-on-the-air",
    title: "Currently Airing",
    type: "category",
    fetchConfig: {
      endpoint: "/tv/on_the_air",
    },
  },
  "tv-airing-today": {
    id: "tv-airing-today",
    title: "Airing Today",
    type: "category",
    fetchConfig: {
      endpoint: "/tv/airing_today",
    },
  },

  // TV Genre filters
  "tv-genre-comedy": {
    id: "tv-genre-comedy",
    title: "Comedy Shows",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "35",
      },
    },
  },
  "tv-genre-drama": {
    id: "tv-genre-drama",
    title: "Drama Series",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "18",
      },
    },
  },
  "tv-genre-scifi-fantasy": {
    id: "tv-genre-scifi-fantasy",
    title: "Sci-Fi & Fantasy Shows",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10765",
      },
    },
  },
  "tv-genre-crime": {
    id: "tv-genre-crime",
    title: "Crime & Mystery",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "80",
      },
    },
  },
  "tv-genre-animation": {
    id: "tv-genre-animation",
    title: "Animated Series",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "16",
      },
    },
  },
  "tv-genre-kids": {
    id: "tv-genre-kids",
    title: "Kids & Family",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10762",
      },
    },
  },

  // TV Network filters
  "tv-network-hbo": {
    id: "tv-network-hbo",
    title: "HBO Originals",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "49", // HBO
      },
    },
  },
  "tv-network-netflix": {
    id: "tv-network-netflix",
    title: "Netflix Originals",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "213", // Netflix
      },
    },
  },
  "tv-network-disney-channel": {
    id: "tv-network-disney-channel",
    title: "Disney Channel Shows",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "54", // Disney Channel
      },
    },
  },
  "tv-network-cartoon-network": {
    id: "tv-network-cartoon-network",
    title: "Cartoon Network",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "56", // Cartoon Network
      },
    },
  },
  "tv-network-nickelodeon": {
    id: "tv-network-nickelodeon",
    title: "Nickelodeon Shows",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "13", // Nickelodeon
      },
    },
  },
  "tv-network-bbc": {
    id: "tv-network-bbc",
    title: "BBC Productions",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "4", // BBC One
      },
    },
  },
  "tv-network-fx": {
    id: "tv-network-fx",
    title: "FX Originals",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "88", // FX
      },
    },
  },
  "tv-network-amc": {
    id: "tv-network-amc",
    title: "AMC Shows",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "174", // AMC
      },
    },
  },

  // TV Time period filters
  "tv-year-90s": {
    id: "tv-year-90s",
    title: "90s TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "1990-01-01",
        "first_air_date.lte": "1999-12-31",
      },
    },
  },
  "tv-year-2000s": {
    id: "tv-year-2000s",
    title: "2000s TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2000-01-01",
        "first_air_date.lte": "2009-12-31",
      },
    },
  },
  "tv-year-2010s": {
    id: "tv-year-2010s",
    title: "2010s TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2010-01-01",
        "first_air_date.lte": "2019-12-31",
      },
    },
  },

  // TV Special categories
  "tv-90s-cartoons": {
    id: "tv-90s-cartoons",
    title: "90s Cartoons",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "16", // Animation
        "first_air_date.gte": "1990-01-01",
        "first_air_date.lte": "1999-12-31",
      },
    },
  },
  "tv-kdrama": {
    id: "tv-kdrama",
    title: "Popular K-Dramas",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_origin_country: "KR",
        with_genres: "18",
        sort_by: "popularity.desc",
        "vote_count.gte": "5",
      },
    },
  },
  "tv-mind-bending-scifi": {
    id: "tv-mind-bending-scifi",
    title: "Mind-Bending Sci-Fi",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10765",
        with_keywords: "mind-bending,alternate-reality,time-travel",
        "vote_average.gte": "7.0",
      },
    },
  },
  "tv-teen-supernatural": {
    id: "tv-teen-supernatural",
    title: "Teen Supernatural Dramas",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10765",
        with_keywords: "teen,supernatural",
      },
    },
  },
  "tv-network-disney-xd": {
    id: "tv-network-disney-xd",
    title: "Disney XD",
    type: "studio",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "44", // Disney XD
      },
    },
  },
  "tv-period-dramas": {
    id: "tv-period-dramas",
    title: "Period Piece Dramas",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "18",
        with_keywords: "period-drama,historical",
        "vote_count.gte": "50",
      },
    },
  },
  "tv-network-hits": {
    id: "tv-network-hits",
    title: "Network TV Hits",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_networks: "6,2,13,21,30,40", // ABC, CBS, Nickelodeon, NBC, USA Network, Comedy Central
        with_origin_country: "US",
        "vote_count.gte": "100",
      },
    },
  },
  "tv-romantic-crime": {
    id: "tv-romantic-crime",
    title: "Romantic Crime Dramas",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "80,18",
        with_keywords: "romance",
        "vote_count.gte": "50",
      },
    },
  },
  "tv-family": {
    id: "tv-family",
    title: "Family Favorites",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10751",
        with_origin_country: "US",
        "vote_count.gte": "50",
      },
    },
  },
  "tv-kdrama-romance": {
    id: "tv-kdrama-romance",
    title: "K-Drama Romances",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_origin_country: "KR",
        with_genres: "18,35",
        with_keywords: "romance,love",
      },
    },
  },
  "tv-workplace-comedies": {
    id: "tv-workplace-comedies",
    title: "Workplace Comedies",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "35",
        with_keywords: "workplace,office",
      },
    },
  },
  "tv-mystery": {
    id: "tv-mystery",
    title: "Mystery Shows",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "9648",
        "vote_count.gte": "100",
      },
    },
  },
  "tv-anime": {
    id: "tv-anime",
    title: "Anime Series",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "16", // Animation
        with_origin_country: "JP",
      },
    },
  },
  "tv-british-comedy": {
    id: "tv-british-comedy",
    title: "British Comedy",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "35", // Comedy
        with_origin_country: "GB",
      },
    },
  },
  "tv-true-crime": {
    id: "tv-true-crime",
    title: "True Crime Series",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "80,99", // Crime & Documentary
      },
    },
  },
  "tv-sitcoms": {
    id: "tv-sitcoms",
    title: "Classic Sitcoms",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "35", // Comedy
        "vote_average.gte": "7.5",
        "vote_count.gte": "100",
      },
    },
  },
  "tv-limited-series": {
    id: "tv-limited-series",
    title: "Limited Series",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_type: "2", // Miniseries
        "vote_average.gte": "7.5",
      },
    },
  },
  "tv-reality": {
    id: "tv-reality",
    title: "Reality TV",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10764",
      },
    },
  },
  "tv-docuseries": {
    id: "tv-docuseries",
    title: "Docuseries",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "99",
      },
    },
  },
  "tv-talk-shows": {
    id: "tv-talk-shows",
    title: "Talk Shows",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10767",
      },
    },
  },
  "tv-game-shows": {
    id: "tv-game-shows",
    title: "Game Shows",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10764", // Reality
        with_keywords: "9730", // Game show keyword
      },
    },
  },
  "tv-superhero": {
    id: "tv-superhero",
    title: "Superhero Shows",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10759,10765", // Action & Adventure, Sci-Fi & Fantasy
        with_keywords: "9715", // Superhero keyword
      },
    },
  },
  "tv-medical-dramas": {
    id: "tv-medical-dramas",
    title: "Medical Dramas",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "18", // Drama
        with_keywords: "12279", // Medical keyword
      },
    },
  },
  "tv-cooking-shows": {
    id: "tv-cooking-shows",
    title: "Cooking Shows",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10764", // Reality
        with_keywords: "6149", // Cooking keyword
      },
    },
  },
};

// Helper function to get filter configuration
export function getFilterConfig(filterId: string): ContentFilter | null {
  return CONTENT_FILTERS[filterId] || null;
}

// Helper function to build filter params
export function buildFilterParams(filterId: string): {
  endpoint: string;
  params: Record<string, string>;
} {
  const filter = getFilterConfig(filterId);
  if (!filter) {
    return {
      endpoint: "/discover/movie",
      params: {},
    };
  }

  const baseParams: Record<string, string> = {
    language: "en-US",
    include_adult: "false",
    sort_by: "popularity.desc",
  };

  return {
    endpoint: filter.fetchConfig.endpoint || "/discover/movie",
    params: {
      ...baseParams,
      ...(filter.fetchConfig.params || {}),
    },
  };
}
