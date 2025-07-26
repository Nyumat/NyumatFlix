import { MediaItem } from "./typings";

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
 * Fetches movies/TV shows by director using person credits API
 */
async function fetchByDirector(
  directorKey: keyof typeof DIRECTOR_IDS,
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  const personId = DIRECTOR_IDS[directorKey];
  if (!personId) {
    return { results: [] };
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/person/${personId}/movie_credits?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();
    let results = data.crew || [];

    // Filter for movies where the person was a director
    results = results.filter((movie: MediaItem & { job?: string }) => {
      return movie.job === "Director";
    });

    // Filter out items without posters and sort by popularity (most popular first)
    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort((a: MediaItem, b: MediaItem) => {
        // Sort by popularity (higher popularity first)
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityB - popularityA;
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
    console.error(`Error fetching movies for director ${directorKey}:`, error);
    return { results: [] };
  }
}

/**
 * Fetches movies by studio using company ID
 */
async function fetchByStudio(
  studioKey: keyof typeof STUDIO_IDS,
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
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
): Promise<{ results: MediaItem[]; total_pages?: number }> {
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

    // Filter out items without posters and sort by popularity
    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort((a: MediaItem, b: MediaItem) => {
        // Sort by popularity (higher popularity first)
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityB - popularityA;
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

/**
 * Fetches diverse TV shows from multiple genres
 */
async function fetchDiverseTV(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  // Fetch from multiple genres to ensure diversity
  const genres = [
    { id: "18", name: "Drama" },
    { id: "35", name: "Comedy" },
    { id: "10765", name: "Sci-Fi & Fantasy" },
    { id: "80", name: "Crime" },
    { id: "10759", name: "Action & Adventure" },
  ];

  const allResults: MediaItem[] = [];
  const seenIds = new Set<number>();

  // Fetch from each genre separately
  for (const genre of genres) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=${genre.id}&with_origin_country=US&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=80&vote_average.gte=6.5&without_genres=99,10763,10767&first_air_date.gte=2010-01-01`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          // Filter out duplicates and items without posters
          const validResults = data.results.filter((item: MediaItem) => {
            if (!item.poster_path || seenIds.has(item.id)) return false;
            // Additional filter to exclude talk shows and reality TV
            const showName = item.name?.toLowerCase() || "";
            const showOverview = item.overview?.toLowerCase() || "";
            const excludeKeywords = [
              "talk show",
              "reality",
              "game show",
              "news",
              "interview",
            ];
            const hasExcludedKeywords = excludeKeywords.some(
              (keyword) =>
                showName.includes(keyword) || showOverview.includes(keyword),
            );
            if (hasExcludedKeywords) return false;

            seenIds.add(item.id);
            return true;
          });
          allResults.push(...validResults.slice(0, 4)); // Take top 4 from each genre
        }
      }
    } catch (error) {
      console.error(`Error fetching from genre ${genre.name}:`, error);
    }
  }

  // Sort by popularity and return
  allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return {
    results: allResults.slice(0, 20), // Return top 20
    total_pages: 1, // Since we're combining multiple sources
  };
}

/**
 * Fetches classic sitcoms with filtering
 */
async function fetchSitcoms(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
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
      (keyword) => showName.includes(keyword) || showOverview.includes(keyword),
    );

    return !hasExcludedKeywords && show.poster_path;
  });

  return {
    results: sitcoms,
    total_pages: data.total_pages,
  };
}

/**
 * Fetches network TV hits from multiple networks
 */
async function fetchNetworkHits(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  const networks = [
    { id: "213", name: "Netflix" },
    { id: "49", name: "HBO" },
    { id: "1024", name: "Amazon Prime Video" },
    { id: "2739", name: "Disney+" },
    { id: "453", name: "Hulu" },
    { id: "2552", name: "Apple TV+" },
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
            if ((item.vote_count || 0) < 100 || (item.vote_average || 0) < 7.0)
              return false;
            seenIds.add(item.id);
            return true;
          });
          allResults.push(...validResults);
        }
      }
    } catch (error) {
      console.error(`Error fetching from network ${network.name}:`, error);
    }
  }

  // Sort by popularity and return
  allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return {
    results: allResults.slice(0, 20), // Return top 20
    total_pages: 1, // Since we're combining multiple sources
  };
}

// Export all custom fetchers
export const customFetchers = {
  fetchByDirector,
  fetchByStudio,
  fetchByCollection,
  fetchDiverseTV,
  fetchSitcoms,
  fetchNetworkHits,
};

export type CustomFetcherName = keyof typeof customFetchers;
