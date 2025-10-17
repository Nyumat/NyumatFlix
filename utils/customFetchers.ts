import { MediaItem } from "./typings";

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

const STUDIO_IDS = {
  a24: 41077, // A24
  disney: 2, // Walt Disney Pictures
  pixar: 3, // Pixar Animation Studios
  "warner-bros": 174, // Warner Bros. Pictures
  universal: 33, // Universal Pictures
  dreamworks: 521, // DreamWorks Pictures
  "marvel-studios": 420, // Marvel Studios
} as const;

const COLLECTION_IDS = {
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
 * Fetches movies by director using person credits API
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

    results = results.filter((movie: MediaItem & { job?: string }) => {
      return movie.job === "Director";
    });

    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort((a: MediaItem, b: MediaItem) => {
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityB - popularityA;
      });

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
 * Fetches movies by studio
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
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&with_companies=${companyId}&sort_by=popularity.desc&page=${page}&language=en-US&include_adult=false&vote_count.gte=20&vote_average.gte=5.5`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();

    const results = (data.results || []).filter(
      (item: MediaItem) =>
        item.poster_path &&
        (item.vote_count || 0) >= 20 &&
        (item.vote_average || 0) >= 5.5,
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
 * Fetches movies by collection
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

    results = results
      .filter((item: MediaItem) => item.poster_path)
      .sort((a: MediaItem, b: MediaItem) => {
        const popularityA = a.popularity || 0;
        const popularityB = b.popularity || 0;
        return popularityB - popularityA;
      });

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
  const genres = [
    { id: "18", name: "Drama" },
    { id: "35", name: "Comedy" },
    { id: "10765", name: "Sci-Fi & Fantasy" },
    { id: "80", name: "Crime" },
    { id: "10759", name: "Action & Adventure" },
  ];

  const allResults: MediaItem[] = [];
  const seenIds = new Set<number>();

  for (const genre of genres) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_genres=${genre.id}&with_origin_country=US&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=80&vote_average.gte=6.5&without_genres=99,10763,10767&first_air_date.gte=2010-01-01`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          const validResults = data.results.filter((item: MediaItem) => {
            if (!item.poster_path || seenIds.has(item.id)) return false;
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
          allResults.push(...validResults.slice(0, 4));
        }
      }
    } catch (error) {
      console.error(`Error fetching from genre ${genre.name}:`, error);
    }
  }

  allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return {
    results: allResults.slice(0, 20),
    total_pages: 1,
  };
}

/**
 * Fetches classic sitcoms
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

  const sitcoms = (data.results || []).filter((show: MediaItem) => {
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
 * Fetches kids and animated network shows (kids shows)
 */
async function fetchKidsNetworks(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  const networks = [
    { id: "13", name: "Nickelodeon" },
    { id: "44", name: "Disney XD" },
    { id: "54", name: "Disney Channel" },
    { id: "56", name: "Cartoon Network" },
  ];

  const allResults: MediaItem[] = [];
  const seenIds = new Set<number>();

  for (const network of networks) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_networks=${network.id}&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=20&vote_average.gte=5.5`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          const validResults = data.results.filter((item: MediaItem) => {
            if (!item.poster_path || seenIds.has(item.id)) return false;
            if ((item.vote_count || 0) < 20 || (item.vote_average || 0) < 5.5)
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

  allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return {
    results: allResults.slice(0, 20),
    total_pages: 1,
  };
}

/**
 * Fetches network TV hits from multiple traditional broadcast networks (network TV hits)
 */
async function fetchNetworkHits(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  const networks = [
    { id: "6", name: "NBC" },
    { id: "2", name: "ABC" },
    { id: "4", name: "FOX" },
    { id: "16", name: "CBS" },
    { id: "5", name: "The CW" },
    { id: "49", name: "HBO" },
  ];

  const allResults: MediaItem[] = [];
  const seenIds = new Set<number>();

  for (const network of networks) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&with_networks=${network.id}&language=en-US&include_adult=false&sort_by=popularity.desc&page=${page}&vote_count.gte=50&vote_average.gte=6.0`,
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results) {
          const validResults = data.results.filter((item: MediaItem) => {
            if (!item.poster_path || seenIds.has(item.id)) return false;
            if ((item.vote_count || 0) < 50 || (item.vote_average || 0) < 6.0)
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

  allResults.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

  return {
    results: allResults.slice(0, 20),
    total_pages: 1,
  };
}

/**
 * Fetches upcoming movies using the moviedb-promise API directly
 * This bypasses all filtering to ensure we get all upcoming movies for the next 12 months
 * and validates release dates to exclude already released movies
 */
async function fetchUpcomingMovies(
  page: number,
): Promise<{ results: MediaItem[]; total_pages?: number }> {
  try {
    const today = new Date();
    const twelveMonthsFromNow = new Date();
    twelveMonthsFromNow.setMonth(today.getMonth() + 12);

    const todayString = today.toISOString().split("T")[0];
    const twelveMonthsString = twelveMonthsFromNow.toISOString().split("T")[0];

    const response = await fetch(
      `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&primary_release_date.gte=${todayString}&primary_release_date.lte=${twelveMonthsString}&sort_by=popularity.desc&page=${page}&language=en-US&region=US&include_adult=false`,
    );

    if (!response.ok) {
      return { results: [] };
    }

    const data = await response.json();

    if (!data?.results) {
      return { results: [] };
    }

    const moviesWithPosters = data.results.filter(
      (item: { poster_path?: string | null }) => Boolean(item.poster_path),
    ) as MediaItem[];

    const upcomingMovies: MediaItem[] = [];

    for (const movie of moviesWithPosters) {
      const isUpcoming = await validateMovieReleaseDate(movie.id, today);
      if (isUpcoming) {
        upcomingMovies.push(movie);
      }
    }

    return {
      results: upcomingMovies,
      total_pages: data.total_pages,
    };
  } catch (error) {
    console.error("Error fetching upcoming movies:", error);
    return { results: [] };
  }
}

/**
 * Validates that a movie has at least one future release date
 */
async function validateMovieReleaseDate(
  movieId: number,
  currentDate: Date,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/release_dates?api_key=${process.env.TMDB_API_KEY}`,
    );

    if (!response.ok) {
      console.warn(`Failed to fetch release dates for movie ${movieId}`);
      return true;
    }

    const data = await response.json();

    if (!data?.results || !Array.isArray(data.results)) {
      return true;
    }

    for (const countryData of data.results) {
      if (
        countryData.release_dates &&
        Array.isArray(countryData.release_dates)
      ) {
        for (const release of countryData.release_dates) {
          if (release.release_date) {
            const releaseDate = new Date(release.release_date);

            if (releaseDate > currentDate) {
              return true;
            }
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Error validating release date for movie ${movieId}:`, error);
    return true;
  }
}

export const customFetchers = {
  fetchByDirector,
  fetchByStudio,
  fetchByCollection,
  fetchDiverseTV,
  fetchSitcoms,
  fetchNetworkHits,
  fetchKidsNetworks,
  fetchUpcomingMovies,
};

export type CustomFetcherName = keyof typeof customFetchers;
