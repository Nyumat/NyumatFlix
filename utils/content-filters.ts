import { MediaItem } from "./typings";

// Cache for keyword IDs to avoid repeated API calls
const keywordIdCache = new Map<string, string>();

// TMDB Person IDs for directors
const DIRECTOR_IDS = {
  nolan: 525, // Christopher Nolan
  tarantino: 138, // Quentin Tarantino
  spielberg: 488, // Steven Spielberg
  scorsese: 1032, // Martin Scorsese
  fincher: 7467, // David Fincher
  villeneuve: 27571, // Denis Villeneuve
  wright: 5524, // Edgar Wright
  "anderson-wes": 5655, // Wes Anderson
  coen: 1283, // Coen Brothers (Joel Coen)
  "ridley-scott": 578, // Ridley Scott
  cameron: 2710, // James Cameron
  kubrick: 240, // Stanley Kubrick
  hitchcock: 2636, // Alfred Hitchcock
  ptanderson: 7026, // Paul Thomas Anderson
} as const;

// TMDB Company IDs for studios
const STUDIO_IDS = {
  a24: 41077, // A24
  disney: 2, // Walt Disney Pictures
  pixar: 3, // Pixar Animation Studios
  "warner-bros": 174, // Warner Bros. Pictures
  universal: 33, // Universal Pictures
  dreamworks: 521, // DreamWorks Pictures
} as const;

// TMDB Collection IDs for movie franchises
const COLLECTION_IDS = {
  "marvel-mcu": 86311, // Marvel Cinematic Universe
  "star-wars": 10, // Star Wars Collection
  "fast-furious": 9485, // The Fast and the Furious Collection
  "harry-potter": 1241, // Harry Potter Collection
  "lord-of-rings": 119, // The Lord of the Rings Collection
  "mission-impossible": 87359, // Mission: Impossible Collection
  "james-bond": 645, // James Bond Collection
  "batman-dark-knight": 263, // The Dark Knight Collection
  "jurassic-park": 328, // Jurassic Park Collection
  transformers: 8650, // Transformers Collection
} as const;

/**
 * Resolves keyword strings to TMDB keyword IDs using the search API
 * @param keywords Comma-separated keyword strings
 * @returns Pipe-separated keyword IDs for TMDB API
 */
async function resolveKeywordIds(keywords: string): Promise<string> {
  const keywordList = keywords.split(",").map((k) => k.trim());
  const resolvedIds: string[] = [];

  for (const keyword of keywordList) {
    // Check cache first
    if (keywordIdCache.has(keyword)) {
      const cachedId = keywordIdCache.get(keyword);
      if (cachedId) {
        resolvedIds.push(cachedId);
      }
      continue;
    }

    try {
      // Search for the keyword using TMDB API
      const response = await fetch(
        `https://api.themoviedb.org/3/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(keyword)}`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Take the first (most relevant) result
          const keywordId = data.results[0].id.toString();
          keywordIdCache.set(keyword, keywordId);
          resolvedIds.push(keywordId);
        } else {
          console.warn(`No keyword ID found for "${keyword}"`);
        }
      } else {
        console.warn(
          `Failed to search for keyword "${keyword}": ${response.status}`,
        );
      }
    } catch (error) {
      console.error(`Error searching for keyword "${keyword}":`, error);
    }
  }

  // Return pipe-separated IDs (OR logic) instead of comma-separated (AND logic)
  return resolvedIds.join("|");
}

/**
 * Fetches movies/TV shows by director using person credits API
 */
async function fetchByDirector(
  directorKey: keyof typeof DIRECTOR_IDS,
  mediaType: "movie" | "tv",
  page: number,
) {
  const personId = DIRECTOR_IDS[directorKey];
  if (!personId) {
    return { results: [] };
  }

  try {
    const endpoint =
      mediaType === "movie"
        ? `/person/${personId}/movie_credits`
        : `/person/${personId}/tv_credits`;

    const response = await fetch(
      `https://api.themoviedb.org/3${endpoint}?api_key=${process.env.TMDB_API_KEY}`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();
    let results = mediaType === "movie" ? data.crew || [] : data.crew || [];

    // Filter for director role only
    results = results.filter(
      (item: MediaItem & { job?: string }) => item.job === "Director",
    );

    // Sort by popularity and filter out items without posters
    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort(
        (a: MediaItem, b: MediaItem) =>
          (b.popularity || 0) - (a.popularity || 0),
      );

    // Paginate results (20 per page)
    const startIndex = (page - 1) * 20;
    const endIndex = startIndex + 20;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      results: paginatedResults,
      total_pages: Math.ceil(results.length / 20),
    };
  } catch (error) {
    console.error(
      `Error fetching ${mediaType} for director ${directorKey}:`,
      error,
    );
    return { results: [] };
  }
}

/**
 * Fetches movies by studio using company ID
 */
async function fetchByStudio(studioKey: keyof typeof STUDIO_IDS, page: number) {
  const companyId = STUDIO_IDS[studioKey];
  if (!companyId) {
    return { results: [] };
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_companies=${companyId}&sort_by=popularity.desc&page=${page}&language=en-US&include_adult=false&vote_count.gte=50&vote_average.gte=6.0`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();

    // Filter out items without posters and ensure higher quality for mainstream content
    const results = (data.results || []).filter(
      (item: MediaItem) =>
        item.poster_path &&
        (item.vote_count || 0) >= 50 &&
        (item.vote_average || 0) >= 6.0,
    );

    return {
      results,
      total_pages: data.total_pages,
    };
  } catch (error) {
    console.error(`Error fetching movies for studio ${studioKey}:`, error);
    return { results: [] };
  }
}

/**
 * Fetches movies by collection using collection ID
 */
async function fetchByCollection(
  collectionKey: keyof typeof COLLECTION_IDS,
  page: number,
) {
  const collectionId = COLLECTION_IDS[collectionKey];
  if (!collectionId) {
    return { results: [] };
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();
    let results = data.parts || [];

    // Filter out items without posters and sort by release date
    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort((a: MediaItem, b: MediaItem) => {
        const dateA = new Date(a.release_date || "").getTime();
        const dateB = new Date(b.release_date || "").getTime();
        return dateB - dateA; // Most recent first
      });

    // Paginate results (20 per page)
    const startIndex = (page - 1) * 20;
    const endIndex = startIndex + 20;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      results: paginatedResults,
      total_pages: Math.ceil(results.length / 20),
    };
  } catch (error) {
    console.error(
      `Error fetching movies for collection ${collectionKey}:`,
      error,
    );
    return { results: [] };
  }
}

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
      params: {
        region: "US",
      },
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
        without_genres: "16,99,10770", // Exclude animation, documentaries, and TV movies
        "vote_count.gte": "200",
        "vote_average.gte": "6.2",
        "runtime.gte": "90", // Ensure proper feature length
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
        without_genres: "16,99,10770,27", // Exclude animation, documentaries, TV movies, and horror
        "vote_count.gte": "100",
        "vote_average.gte": "6.0",
        "runtime.gte": "80",
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
        without_genres: "99,10770,16", // Exclude documentaries, TV movies, and animation
        "vote_count.gte": "150",
        "vote_average.gte": "6.8",
        "runtime.gte": "90",
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
        without_genres: "99,10770,16", // Exclude documentaries, TV movies, and animation
        "vote_count.gte": "150",
        "vote_average.gte": "6.3",
        "runtime.gte": "90",
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
        without_genres: "99,10770,16,10751", // Exclude documentaries, TV movies, animation, and family
        "vote_count.gte": "100",
        "vote_average.gte": "5.8",
        "runtime.gte": "80",
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
        with_genres: "878|14", // Use OR logic for sci-fi OR fantasy
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "150",
        "vote_average.gte": "6.2",
        "runtime.gte": "90",
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
        with_genres: "10749,35", // Must have both romance AND comedy
        without_genres: "16,99,10770,27", // Exclude animation, documentaries, TV movies, and horror
        "vote_count.gte": "80",
        "vote_average.gte": "6.0",
        "runtime.gte": "80",
      },
    },
  },
  "genre-romance": {
    id: "genre-romance",
    title: "Romance Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "10749",
        without_genres: "16,99,10770,27", // Exclude animation, documentaries, TV movies, and horror
        "vote_count.gte": "100",
        "vote_average.gte": "6.0",
        "runtime.gte": "85",
      },
    },
  },
  "genre-crime": {
    id: "genre-crime",
    title: "Crime Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "80",
        without_genres: "16,99,10770", // Exclude animation, documentaries, and TV movies
        "vote_count.gte": "150",
        "vote_average.gte": "6.5",
        "runtime.gte": "90",
      },
    },
  },
  "genre-mystery": {
    id: "genre-mystery",
    title: "Mystery Movies",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        with_genres: "9648",
        without_genres: "16,99,10770", // Exclude animation, documentaries, and TV movies
        "vote_count.gte": "100",
        "vote_average.gte": "6.3",
        "runtime.gte": "90",
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
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "100",
        "vote_average.gte": "6.0",
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
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "150",
        "vote_average.gte": "6.0",
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
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "200",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2010s": {
    id: "year-2010s",
    title: "2010s Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2010-01-01",
        "primary_release_date.lte": "2019-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "300",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2020": {
    id: "year-2020",
    title: "2020 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2020-01-01",
        "primary_release_date.lte": "2020-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "200",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2021": {
    id: "year-2021",
    title: "2021 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2021-01-01",
        "primary_release_date.lte": "2021-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "150",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2022": {
    id: "year-2022",
    title: "2022 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2022-01-01",
        "primary_release_date.lte": "2022-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "150",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2023": {
    id: "year-2023",
    title: "2023 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2023-01-01",
        "primary_release_date.lte": "2023-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "100",
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2024": {
    id: "year-2024",
    title: "2024 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2024-01-01",
        "primary_release_date.lte": "2024-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "50", // Lower threshold for newer movies
        "vote_average.gte": "6.0",
      },
    },
  },
  "year-2025": {
    id: "year-2025",
    title: "2025 Movies",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2025-01-01",
        "primary_release_date.lte": "2025-12-31",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "10", // Very low threshold for upcoming movies
        "vote_average.gte": "5.5", // Lower quality threshold for upcoming movies
      },
    },
  },
  "recent-releases": {
    id: "recent-releases",
    title: "Recent Releases",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "primary_release_date.gte": "2025-01-01",
        "primary_release_date.lte": `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`,
        without_genres: "99,10770", // Exclude documentaries and TV movies
        "vote_count.gte": "10", // Very low threshold for upcoming movies
        "vote_average.gte": "5.5", // Lower quality threshold for upcoming movies
      },
    },
  },

  // Studio filters
  "studio-a24": {
    id: "studio-a24",
    title: "A24 Films",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("a24", page),
    },
  },
  "studio-pixar": {
    id: "studio-pixar",
    title: "Pixar Animation Studios",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("pixar", page),
    },
  },
  "studio-disney": {
    id: "studio-disney",
    title: "Disney Movies",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("disney", page),
    },
  },
  "studio-warner-bros": {
    id: "studio-warner-bros",
    title: "Warner Bros. Pictures",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("warner-bros", page),
    },
  },
  "studio-universal": {
    id: "studio-universal",
    title: "Universal Pictures",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("universal", page),
    },
  },
  "studio-dreamworks": {
    id: "studio-dreamworks",
    title: "DreamWorks Pictures",
    type: "studio",
    fetchConfig: {
      customFetch: async (page: number) => fetchByStudio("dreamworks", page),
    },
  },

  // Director filters
  "director-nolan": {
    id: "director-nolan",
    title: "Christopher Nolan Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("nolan", "movie", page),
    },
  },
  "director-tarantino": {
    id: "director-tarantino",
    title: "Quentin Tarantino Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("tarantino", "movie", page),
    },
  },
  "director-spielberg": {
    id: "director-spielberg",
    title: "Steven Spielberg Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("spielberg", "movie", page),
    },
  },
  "director-scorsese": {
    id: "director-scorsese",
    title: "Martin Scorsese Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("scorsese", "movie", page),
    },
  },
  "director-fincher": {
    id: "director-fincher",
    title: "David Fincher Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("fincher", "movie", page),
    },
  },
  "director-villeneuve": {
    id: "director-villeneuve",
    title: "Denis Villeneuve Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("villeneuve", "movie", page),
    },
  },
  "director-wright": {
    id: "director-wright",
    title: "Edgar Wright Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("wright", "movie", page),
    },
  },
  "director-wes-anderson": {
    id: "director-wes-anderson",
    title: "Wes Anderson Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("anderson-wes", "movie", page),
    },
  },
  "director-coen": {
    id: "director-coen",
    title: "Coen Brothers Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("coen", "movie", page),
    },
  },
  "director-ridley-scott": {
    id: "director-ridley-scott",
    title: "Ridley Scott Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("ridley-scott", "movie", page),
    },
  },
  "director-cameron": {
    id: "director-cameron",
    title: "James Cameron Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("cameron", "movie", page),
    },
  },
  "director-kubrick": {
    id: "director-kubrick",
    title: "Stanley Kubrick Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("kubrick", "movie", page),
    },
  },
  "director-hitchcock": {
    id: "director-hitchcock",
    title: "Alfred Hitchcock Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("hitchcock", "movie", page),
    },
  },
  "director-pta": {
    id: "director-pta",
    title: "Paul Thomas Anderson Films",
    type: "director",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByDirector("ptanderson", "movie", page),
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
        "vote_average.gte": "7.8",
        "vote_count.gte": "1500",
        without_genres: "99,10770,16", // Exclude documentaries, TV movies, and animation
        sort_by: "vote_average.desc",
        "runtime.gte": "90",
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
        "vote_average.gte": "7.3",
        "vote_count.gte": "500",
        "vote_count.lte": "5000",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        sort_by: "vote_average.desc",
        "runtime.gte": "85",
      },
    },
  },
  "blockbuster-hits": {
    id: "blockbuster-hits",
    title: "Blockbuster Hits",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_count.gte": "3000",
        "vote_average.gte": "6.5",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        sort_by: "revenue.desc",
        "runtime.gte": "100",
      },
    },
  },
  "award-winners": {
    id: "award-winners",
    title: "Award Winners",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_average.gte": "7.5",
        "vote_count.gte": "1000",
        without_genres: "99,10770", // Exclude documentaries and TV movies
        with_keywords: "162846|207320|159067", // Oscar winner, Golden Globe, BAFTA
        sort_by: "vote_average.desc",
      },
    },
  },
  "cult-classics": {
    id: "cult-classics",
    title: "Cult Classics",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_average.gte": "7.0",
        "vote_count.gte": "800",
        "primary_release_date.lte": "2010-12-31", // Older films
        without_genres: "99,10770", // Exclude documentaries and TV movies
        sort_by: "vote_average.desc",
      },
    },
  },
  "indie-films": {
    id: "indie-films",
    title: "Independent Films",
    type: "special",
    fetchConfig: {
      endpoint: "/discover/movie",
      params: {
        "vote_average.gte": "6.8",
        "vote_count.gte": "200",
        "vote_count.lte": "2000",
        without_genres: "99,10770,16", // Exclude documentaries, TV movies, and animation
        with_companies: "41077|1556|23243|10146", // A24, Miramax, IFC Films, Focus Features
        sort_by: "vote_average.desc",
      },
    },
  },

  // Collection/Franchise filters
  "marvel-mcu": {
    id: "marvel-mcu",
    title: "Marvel Cinematic Universe",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("marvel-mcu", page),
    },
  },
  "star-wars": {
    id: "star-wars",
    title: "Star Wars Saga",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) => fetchByCollection("star-wars", page),
    },
  },
  "fast-furious": {
    id: "fast-furious",
    title: "Fast & Furious",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("fast-furious", page),
    },
  },
  "harry-potter": {
    id: "harry-potter",
    title: "Harry Potter Collection",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("harry-potter", page),
    },
  },
  "lord-of-rings": {
    id: "lord-of-rings",
    title: "Lord of the Rings",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("lord-of-rings", page),
    },
  },
  "mission-impossible": {
    id: "mission-impossible",
    title: "Mission: Impossible",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("mission-impossible", page),
    },
  },
  "james-bond": {
    id: "james-bond",
    title: "James Bond Films",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("james-bond", page),
    },
  },
  "batman-dark-knight": {
    id: "batman-dark-knight",
    title: "The Dark Knight Trilogy",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("batman-dark-knight", page),
    },
  },
  "jurassic-park": {
    id: "jurassic-park",
    title: "Jurassic Park Collection",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("jurassic-park", page),
    },
  },
  transformers: {
    id: "transformers",
    title: "Transformers Collection",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) =>
        fetchByCollection("transformers", page),
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
  "tv-upcoming": {
    id: "tv-upcoming",
    title: "Upcoming TV Shows",
    type: "category",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": new Date().toISOString().split("T")[0],
        sort_by: "first_air_date.asc",
      },
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
        with_origin_country: "US",
        "vote_count.gte": "100", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_origin_country: "US",
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.2", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_origin_country: "US",
        "vote_count.gte": "120", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763,16", // Exclude news, documentaries, and animation
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_genres: "80|9648", // Crime OR Mystery
        with_origin_country: "US",
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.2", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "80", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763,10765", // Exclude news, documentaries, and sci-fi/fantasy
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "60", // Increased for mainstream hits
        "vote_average.gte": "6.5", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
      },
    },
  },
  "tv-genre-action": {
    id: "tv-genre-action",
    title: "Action & Adventure",
    type: "genre",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        with_genres: "10759",
        with_origin_country: "US",
        "vote_count.gte": "120", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "200", // Increased for mainstream hits
        "vote_average.gte": "7.8", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763,10764", // Exclude news, documentaries, and reality
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "100", // Significantly increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard for popular shows
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "80", // Increased for mainstream hits
        "vote_average.gte": "7.2", // Higher quality standard for classics
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "80", // Increased for mainstream hits
        "vote_average.gte": "6.8", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "100", // Increased for mainstream hits
        "vote_average.gte": "7.5", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.5", // Maintain high quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "200", // Increased for mainstream hits
        "vote_average.gte": "7.8", // Maintain high quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_origin_country: "US",
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_origin_country: "US",
        "vote_count.gte": "200", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_origin_country: "US",
        "vote_count.gte": "250", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
      },
    },
  },
  "tv-year-2020": {
    id: "tv-year-2020",
    title: "2020 TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2020-01-01",
        "first_air_date.lte": "2020-12-31",
        with_origin_country: "US",
        "vote_count.gte": "100",
        "vote_average.gte": "6.5",
        without_genres: "99,10763", // Exclude news and documentaries
      },
    },
  },
  "tv-year-2021": {
    id: "tv-year-2021",
    title: "2021 TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2021-01-01",
        "first_air_date.lte": "2021-12-31",
        with_origin_country: "US",
        "vote_count.gte": "80",
        "vote_average.gte": "6.5",
        without_genres: "99,10763", // Exclude news and documentaries
      },
    },
  },
  "tv-year-2022": {
    id: "tv-year-2022",
    title: "2022 TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2022-01-01",
        "first_air_date.lte": "2022-12-31",
        with_origin_country: "US",
        "vote_count.gte": "80",
        "vote_average.gte": "6.5",
        without_genres: "99,10763", // Exclude news and documentaries
      },
    },
  },
  "tv-year-2023": {
    id: "tv-year-2023",
    title: "2023 TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2023-01-01",
        "first_air_date.lte": "2023-12-31",
        with_origin_country: "US",
        "vote_count.gte": "50",
        "vote_average.gte": "6.5",
        without_genres: "99,10763", // Exclude news and documentaries
      },
    },
  },
  "tv-year-2024": {
    id: "tv-year-2024",
    title: "2024 TV Shows",
    type: "year",
    fetchConfig: {
      endpoint: "/discover/tv",
      params: {
        "first_air_date.gte": "2024-01-01",
        "first_air_date.lte": "2024-12-31",
        with_origin_country: "US",
        "vote_count.gte": "30", // Lower threshold for very new shows
        "vote_average.gte": "6.5",
        without_genres: "99,10763", // Exclude news and documentaries
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
        with_genres: "18", // Drama
        with_keywords: "period-drama",
        "vote_count.gte": "30",
        "first_air_date.lte": "2024-12-31",
      },
    },
  },
  "tv-network-hits": {
    id: "tv-network-hits",
    title: "Network TV Hits",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) => {
        // Define major US networks
        const networks = [
          { id: "6", name: "ABC" },
          { id: "2", name: "CBS" },
          { id: "13", name: "Nickelodeon" },
          { id: "21", name: "NBC" },
          { id: "30", name: "USA Network" },
          { id: "40", name: "Comedy Central" },
          { id: "49", name: "HBO" },
          { id: "54", name: "Disney Channel" },
          { id: "56", name: "Cartoon Network" },
          { id: "88", name: "FX" },
          { id: "174", name: "AMC" },
        ];

        const allResults: MediaItem[] = [];
        const seenIds = new Set<number>();

        // Fetch from each network separately
        for (const network of networks) {
          try {
            const response = await fetch(
              `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_networks=${network.id}&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=100&vote_average.gte=7.0`,
            );

            if (response.ok) {
              const data = await response.json();
              if (data.results) {
                // Filter out duplicates and items without posters, prioritize highly rated content
                const validResults = data.results.filter((item: MediaItem) => {
                  if (!item.poster_path || seenIds.has(item.id)) return false;
                  // Additional quality filter for mainstream content
                  if (
                    (item.vote_count || 0) < 100 ||
                    (item.vote_average || 0) < 7.0
                  )
                    return false;
                  seenIds.add(item.id);
                  return true;
                });
                allResults.push(...validResults);
              }
            }
          } catch (error) {
            console.error(
              `Error fetching from network ${network.name}:`,
              error,
            );
          }
        }

        // Sort by popularity and return
        allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        return {
          results: allResults.slice(0, 20), // Return top 20
          total_pages: 1, // Since we're combining multiple sources
        };
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
        "vote_count.gte": "80", // Increased for mainstream hits
        "vote_average.gte": "6.8", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_genres: "18", // Drama (removing comedy to be more specific)
        with_keywords: "romance",
        "vote_count.gte": "20", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        sort_by: "popularity.desc", // Prioritize popular content
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
        with_genres: "35", // Comedy
        with_keywords: "workplace",
        without_genres: "16", // Exclude Animation
        "vote_count.gte": "50", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        sort_by: "popularity.desc", // Prioritize popular content
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
        "vote_count.gte": "150", // Increased for mainstream hits
        "vote_average.gte": "7.0", // Higher quality standard
        without_genres: "99,10763", // Exclude news and documentaries
        sort_by: "popularity.desc", // Prioritize popular content
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
      customFetch: async (page: number) => {
        const response = await fetch(
          `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=35&without_genres=16,18,80,10759,10765,9648&with_origin_country=US&vote_average.gte=7.0&vote_count.gte=50&first_air_date.gte=1970-01-01&first_air_date.lte=2020-12-31&sort_by=popularity.desc&page=${page}`,
        );

        if (!response.ok) {
          return { results: [] };
        }

        const data = await response.json();

        // Additional filtering to exclude shows that are primarily dramas
        const sitcoms = (data.results || []).filter((show: MediaItem) => {
          // Exclude shows with these keywords that indicate they're not traditional sitcoms
          const excludeKeywords = [
            "police",
            "detective",
            "crime",
            "medical",
            "hospital",
            "vampire",
            "supernatural",
            "warehouse",
            "investigation",
          ];
          const showName = show.name?.toLowerCase() || "";
          const showOverview = show.overview?.toLowerCase() || "";

          // Check if the show contains any excluded keywords
          const hasExcludedKeywords = excludeKeywords.some(
            (keyword) =>
              showName.includes(keyword) || showOverview.includes(keyword),
          );

          return !hasExcludedKeywords && show.poster_path;
        });

        return {
          results: sitcoms,
          total_pages: data.total_pages,
        };
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
  "tv-animated-adventures": {
    id: "tv-animated-adventures",
    title: "Animated Adventures",
    type: "special",
    fetchConfig: {
      customFetch: async (page: number) => {
        const response = await fetch(
          `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=16&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=50&vote_average.gte=6.5&without_genres=99,10763`,
        );

        if (!response.ok) {
          return { results: [] };
        }

        const data = await response.json();

        // Filter to shows that have adventure/fantasy elements in their genre_ids or keywords
        const adventureShows = (data.results || []).filter(
          (show: MediaItem) => {
            // Look for sci-fi, fantasy, adventure, or action elements in genre_ids
            const genreIds = show.genre_ids || [];
            const hasAdventureElements = genreIds.some(
              (id: number) => [10759, 10765, 28].includes(id), // Action & Adventure, Sci-Fi & Fantasy, Action
            );

            // Also check if name/overview suggests adventure content
            const showName = show.name?.toLowerCase() || "";
            const showOverview = show.overview?.toLowerCase() || "";
            const adventureKeywords = [
              "adventure",
              "magical",
              "fantasy",
              "space",
              "time",
              "powers",
              "superhero",
              "quest",
              "battle",
            ];

            const hasAdventureKeywords = adventureKeywords.some(
              (keyword) =>
                showName.includes(keyword) || showOverview.includes(keyword),
            );

            return (
              (hasAdventureElements || hasAdventureKeywords) && show.poster_path
            );
          },
        );

        return {
          results: adventureShows,
          total_pages: data.total_pages,
        };
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

// Async helper function to build filter params with keyword resolution
export async function buildFilterParamsAsync(filterId: string): Promise<{
  endpoint: string;
  params: Record<string, string>;
}> {
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

  const params = {
    ...baseParams,
    ...(filter.fetchConfig.params || {}),
  };

  // If the filter has keyword strings, resolve them to IDs
  if (params.with_keywords && !params.with_keywords.match(/^\d+(\|\d+)*$/)) {
    // This is a string-based keyword, resolve it to IDs
    const resolvedKeywords = await resolveKeywordIds(params.with_keywords);
    if (resolvedKeywords) {
      params.with_keywords = resolvedKeywords;
    } else {
      // If no keywords found, remove the parameter to avoid empty results
      delete params.with_keywords;
    }
  }

  return {
    endpoint: filter.fetchConfig.endpoint || "/discover/movie",
    params,
  };
}

// Helper function to generate filter ID from year
export function generateYearFilterId(
  year: string,
  mediaType: "movie" | "tv" = "movie",
): string {
  if (mediaType === "tv") {
    return `tv-year-${year}`;
  }
  return `year-${year}`;
}

// Helper function to create year filter params for any year
export function createYearFilterParams(
  year: string,
  mediaType: "movie" | "tv" = "movie",
): {
  endpoint: string;
  params: Record<string, string>;
} {
  const dateField =
    mediaType === "tv" ? "first_air_date" : "primary_release_date";

  return {
    endpoint: `/discover/${mediaType}`,
    params: {
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
      [`${dateField}.gte`]: `${year}-01-01`,
      [`${dateField}.lte`]: `${year}-12-31`,
    },
  };
}

// Helper function to get filter title
export function getFilterTitle(
  filterId: string,
  year?: string,
  mediaType: "movie" | "tv" = "movie",
): string {
  // Handle year filters
  if (year) {
    return mediaType === "tv" ? `${year} TV Shows` : `${year} Movies`;
  }

  // Handle predefined filters
  const filter = getFilterConfig(filterId);
  if (filter) {
    return filter.title;
  }

  // Handle special cases
  if (filterId === "upcoming") {
    return mediaType === "tv" ? "Upcoming TV Shows" : "Upcoming Movies";
  }

  // Default fallback
  return mediaType === "tv" ? "TV Shows" : "Movies";
}
