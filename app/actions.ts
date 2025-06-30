import { movieDb, TMDB_API_KEY, TMDB_BASE_URL } from "@/lib/constants";
import {
  Logo,
  LogoSchema,
  MediaItem,
  MediaItemSchema,
  MovieCategory,
  MovieSchema,
  ReleaseDatesResponseSchema,
  TmdbResponse,
  TmdbResponseSchema,
  TVShowCategory,
  TvShowSchema,
} from "@/utils/typings";

interface Params {
  [key: string]: string;
}

interface Genre {
  id: number;
  name: string;
}

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  categories?: string[]; // Optional field for the genre names
}

export async function buildItemsWithCategories<
  T extends Record<string, any> & { id: number; genre_ids?: number[] },
>(items: T[], type: "movie" | "tv" | "multi"): Promise<MediaItem[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const genres = await getCategories(type);

  const processedItems = items.map((item) => {
    const itemGenres = genres.filter((genre) =>
      item.genre_ids?.includes(genre.id),
    );
    const categories = itemGenres.map((genre) => genre.name);

    // Combine the item with categories
    const enrichedItem = { ...item, categories };

    // Use the MediaItemSchema to validate and transform
    const result = MediaItemSchema.safeParse(enrichedItem);

    if (result.success) {
      return result.data;
    } else {
      // If validation fails, we'll still return the item as is
      // but with proper type assertion to MediaItem
      console.warn(
        `Validation failed for item ${item.id}:`,
        result.error.message,
      );
      return enrichedItem as unknown as MediaItem;
    }
  });

  return processedItems;
}

export async function buildMaybeItemsWithCategories<
  T extends Record<string, any> & { id: number; genre_ids?: number[] },
>(items: T[], type: "movie" | "tv" | "multi"): Promise<MediaItem[]> {
  if (items.length === 0) {
    return [];
  }
  return buildItemsWithCategories(items, type);
}

export async function getCategories(
  type: "movie" | "tv" | "multi",
): Promise<Genre[]> {
  const genres = await fetchTMDBData(`/genre/${type}/list`);
  return genres.genres;
}

export const fetchAllData = async () => {
  const [
    popularMovies,
    topRatedMovies,
    popularTVShows,
    topRatedTVShows,
    actionMovies,
    comedyMovies,
    dramaMovies,
    thrillerMovies,
    scifiFantasyMovies,
    romComMovies,
    hiddenGems,
    criticallyAcclaimed,
    eightiesMovies,
    ninetiesMovies,
    earlyTwosMovies,
    recentReleases,
    bingeWorthySeries,
    limitedSeries,
    realityTV,
    docuseries,
    fanFavoriteClassicsForHero,
  ] = await Promise.all([
    fetchTMDBData("/movie/popular", {
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/movie/top_rated", {
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/tv/popular", { language: "en-US", include_adult: "false" }),
    fetchTMDBData("/tv/top_rated", {
      language: "en-US",
      include_adult: "false",
    }),

    // Genre-Based Rows (Movies)
    fetchTMDBData("/discover/movie", {
      with_genres: "28",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "35",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "18",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "53",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "878,14",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "10749,35",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),

    // Curated Picks (Movies)
    fetchTMDBData("/discover/movie", {
      "vote_average.gte": "7.5",
      "vote_count.gte": "500",
      "vote_count.lte": "5000",
      sort_by: "vote_average.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      "vote_average.gte": "8.0",
      "vote_count.gte": "2000",
      sort_by: "vote_average.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),

    // Time-Based Categories (Movies)
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "1980-01-01",
      "primary_release_date.lte": "1989-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "1990-01-01",
      "primary_release_date.lte": "1999-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "2000-01-01",
      "primary_release_date.lte": "2009-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "2023-01-01",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
    }),

    // TV-Specific
    fetchTMDBData("/discover/tv", {
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
    }), // Binge-Worthy Series
    fetchTMDBData("/discover/tv", {
      with_type: "5",
      "vote_average.gte": "7.5",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
    }), // Limited Series
    fetchTMDBData("/discover/tv", {
      with_genres: "10764",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
    }), // Reality TV
    fetchTMDBData("/discover/tv", {
      with_genres: "99",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
    }), // Docuseries
    // Fetch for Fan Favorite Classics Hero Carousel
    fetchTMDBData("/discover/movie", {
      with_genres: "16|10751|12|878|35|28", // Animation, Family, Adventure, Sci-Fi, Comedy, Action
      sort_by: "popularity.desc",
      "vote_average.gte": "7.0",
      "vote_count.gte": "1500",
      include_adult: "false",
      language: "en-US",
      region: "US",
    }),
  ]);

  return {
    popularMovies: popularMovies.results,
    topRatedMovies: topRatedMovies.results,
    popularTVShows: popularTVShows.results,
    topRatedTVShows: topRatedTVShows.results,

    // Genre-Based Rows
    actionMovies: actionMovies.results,
    comedyMovies: comedyMovies.results,
    dramaMovies: dramaMovies.results,
    thrillerMovies: thrillerMovies.results,
    scifiFantasyMovies: scifiFantasyMovies.results,
    romComMovies: romComMovies.results,

    // Curated Picks
    hiddenGems: hiddenGems.results,
    criticallyAcclaimed: criticallyAcclaimed.results,

    // Time-Based Categories
    eightiesMovies: eightiesMovies.results,
    ninetiesMovies: ninetiesMovies.results,
    earlyTwosMovies: earlyTwosMovies.results,
    recentReleases: recentReleases.results,

    // TV-Specific
    bingeWorthySeries: bingeWorthySeries.results,
    limitedSeries: limitedSeries.results,
    realityTV: realityTV.results,
    docuseries: docuseries.results,
    fanFavoriteClassicsForHero: fanFavoriteClassicsForHero.results,
  };
};

export async function fetchTMDBData<T = MediaItem>(
  endpoint: string,
  params: Params = {},
  page: number = 1,
): Promise<TmdbResponse<T>> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  // Always append videos and images for our primary data fetching
  const appendItems = ["videos", "images"];

  // Check if endpoint is for a specific item (e.g. /movie/123 or /tv/123)
  // For list endpoints (e.g. /movie/popular), videos/images are not directly available at the top level for each item in the list.
  // They are typically fetched individually or if the API supports it for lists (TMDB does not for lists in this way).
  // So, only append videos,images if it's a detail endpoint.
  // For now, we will append it generally and rely on individual fetching for lists where needed.
  url.searchParams.append("append_to_response", appendItems.join(","));
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString());

  for (const [key, value] of Object.entries(params)) {
    if (typeof key === "string" && typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  const rawData = await response.json();

  // Use Zod to validate the response
  const result = TmdbResponseSchema.safeParse(rawData);

  if (!result.success) {
    console.warn("TMDB response failed validation:", result.error.message);
    // Fall back to raw data to maintain backward compatibility
    return {
      ...rawData,
      results: rawData.results || [],
    } as TmdbResponse<T>;
  }

  return {
    ...result.data,
    results: (result.data.results || []) as T[],
  };
}

export async function getNumberOfEpisodes(
  tvShowId: number,
): Promise<number | null> {
  const data = await fetchTMDBData(`/tv/${tvShowId}`, {}, 1);
  return data.number_of_episodes;
}

export async function getNumberOfSeasons(
  tvShowId: number,
): Promise<number | null> {
  const data = await fetchTMDBData(`/tv/${tvShowId}`, {}, 1);
  return data.number_of_seasons;
}

/**
 * Determines if a TMDB ID belongs to a movie or TV show.
 * @param {string|number} id - The TMDB ID to check.
 * @returns {Promise<string>} - Returns 'movie', 'tv', or 'unknown'.
 */
export async function determineMediaType(id: string | number) {
  try {
    // First, try to fetch as a movie
    const movieResponse = await fetch(
      `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (movieResponse.ok) {
      return "movie";
    }

    // If not a movie, try to fetch as a TV show
    const tvResponse = await fetch(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (tvResponse.ok) {
      return "tv";
    }

    // If neither worked, return unknown
    return "unknown";
  } catch (error) {
    console.error("Error determining media type:", error);
    return "unknown";
  }
}

/**
 * Fetches details for a given TMDB ID, determining its type first.
 * @param {string|number} id - The TMDB ID to fetch details for.
 * @returns {Promise<Object>} - Returns the media details or null if not found.
 */
export async function fetchMediaDetails(id: string | number) {
  const mediaType = await determineMediaType(id);

  if (mediaType === "unknown") {
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${id}?api_key=${TMDB_API_KEY}`,
    );
    if (response.ok) {
      const data = await response.json();
      return { ...data, mediaType };
    }
    return null;
  } catch (error) {
    console.error("Error fetching media details:", error);
    return null;
  }
}

export async function getMovieGenreList() {
  return await movieDb.genreMovieList();
}

export async function getTVGenreList() {
  return await movieDb.genreTvList();
}

export async function getMovies(type: MovieCategory, page: number) {
  switch (type) {
    case "popular":
      return await movieDb.moviePopular({ language: "en-US", page });
    case "top-rated":
      return await movieDb.movieTopRated({ language: "en-US", page });
    case "now-playing":
      return await movieDb.movieNowPlaying({ language: "en-US", page });
    case "upcoming":
      return await movieDb.upcomingMovies({ language: "en-US", page });
    case "studio-a24":
      return await fetchMoviesByCompany(41077, page); // A24 company ID
    case "studio-disney":
      return await fetchMoviesByCompany(2, page); // Disney company ID
    case "studio-pixar":
      return await fetchMoviesByCompany(3, page); // Pixar company ID
    case "studio-warner-bros":
      return await fetchMoviesByCompany(174, page); // Warner Bros company ID
    case "studio-universal":
      return await fetchMoviesByCompany(33, page); // Universal company ID
    case "studio-dreamworks":
      return await fetchMoviesByCompany(521, page); // DreamWorks company ID
    case "director-nolan":
      return await fetchMoviesByPerson(525, page, "Director"); // Christopher Nolan
    case "director-tarantino":
      return await fetchMoviesByPerson(138, page, "Director"); // Quentin Tarantino
    case "director-spielberg":
      return await fetchMoviesByPerson(488, page, "Director"); // Steven Spielberg
    case "director-scorsese":
      return await fetchMoviesByPerson(1032, page, "Director"); // Martin Scorsese
    case "director-fincher":
      return await fetchMoviesByPerson(7467, page, "Director"); // David Fincher
    default:
      return await movieDb.moviePopular({ language: "en-US", page });
  }
}

export async function getTVShows(type: TVShowCategory, page: number) {
  switch (type) {
    case "popular":
      return await movieDb.tvPopular({ language: "en-US", page });
    case "top-rated":
      return await movieDb.tvTopRated({ language: "en-US", page });
    case "on-the-air":
      return await movieDb.tvOnTheAir({ language: "en-US", page });
    case "airing-today":
      return await movieDb.tvAiringToday({ language: "en-US", page });
    default:
      return await movieDb.tvPopular({ language: "en-US", page });
  }
}

// Update the movie certification function
export async function fetchMovieCertification(
  movieId: number,
): Promise<string | null> {
  try {
    const response = await fetchTMDBData(`/movie/${movieId}/release_dates`);

    // Validate response with Zod schema
    const result = ReleaseDatesResponseSchema.safeParse(response);

    if (!result.success) {
      console.error("Invalid release dates response:", result.error);
      return null;
    }

    const data = result.data;

    // Look for US certifications first (most common for international users)
    const usRelease = data.results?.find(
      (result) => result.iso_3166_1 === "US",
    );
    if (
      usRelease &&
      usRelease.release_dates &&
      usRelease.release_dates.length > 0
    ) {
      // Find theatrical releases first (type 3)
      const theatrical = usRelease.release_dates.find((rd) => rd.type === 3);
      if (theatrical && theatrical.certification) {
        return theatrical.certification;
      }

      // If no theatrical release, return any certification
      for (const release of usRelease.release_dates) {
        if (release.certification) {
          return release.certification;
        }
      }
    }

    // If no US certification, look for any country
    if (data.results) {
      for (const country of data.results) {
        if (country.release_dates && country.release_dates.length > 0) {
          for (const release of country.release_dates) {
            if (release.certification) {
              return release.certification;
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching movie certification:", error);
    return null;
  }
}

// Functions to fetch paginated content for each category
export async function fetchPaginatedMovies(
  endpoint: string,
  params: Params = {},
  page: number = 1,
): Promise<MediaItem[]> {
  try {
    const data = await fetchTMDBData(
      endpoint,
      { ...params, page: page.toString() },
      page,
    );
    return data.results || [];
  } catch (error) {
    console.error(`Error fetching paginated movies from ${endpoint}:`, error);
    return [];
  }
}

export async function fetchPaginatedCategory(
  category: string,
  type: "movie" | "tv",
  page: number = 1,
): Promise<MediaItem[]> {
  try {
    // console.log(`Fetching category: ${category}, type: ${type}, page: ${page}`);

    // Use standard params for all requests
    const baseParams = {
      language: "en-US",
      include_adult: "false",
    };

    // Add region param for movies only (TV shows might be international but in English)
    const params =
      type === "movie" ? { ...baseParams, region: "US" } : baseParams;

    let results: MediaItem[] = [];

    // Popular categories should be standard popular items
    if (category === "popular" && type === "movie") {
      // Use the standard popular endpoint for popular movies
      results = await fetchPaginatedMovies("/movie/popular", params, page);
    } else if (category === "popular" && type === "tv") {
      // Use the standard popular endpoint for popular TV shows
      results = await fetchPaginatedMovies("/tv/popular", params, page);
    }
    // Recent releases - use now_playing for movies and on_the_air for TV shows
    else if (category === "recent" && type === "movie") {
      // Get now playing movies - these are current theatrical releases
      results = await fetchPaginatedMovies("/movie/now_playing", params, page);
    } else if (category === "recent" && type === "tv") {
      // Get current TV shows
      results = await fetchPaginatedMovies("/tv/on_the_air", params, page);
    }
    // Upcoming releases (future releases)
    else if (category === "upcoming" && type === "movie") {
      // Get movies that haven't been released yet - including those multiple years in the future
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

      // Use both date prioritization and popularity to get a good mix
      const dateOrderedResults = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "primary_release_date.gte": today, // Only future releases
          with_release_type: "3|2", // Theatrical or limited releases
          sort_by: "primary_release_date.asc", // Sort by closest release date first
        },
        page,
      );

      const popularityOrderedResults = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "primary_release_date.gte": today, // Only future releases
          sort_by: "popularity.desc", // Sort by popularity to get anticipated releases
        },
        page,
      );

      // Additional post-processing to ensure only future releases
      const futureDateOrdered = dateOrderedResults.filter((movie) => {
        if (!movie.release_date) return false;
        return new Date(movie.release_date) > new Date();
      });

      const futurePopularityOrdered = popularityOrderedResults.filter(
        (movie) => {
          if (!movie.release_date) return false;
          return new Date(movie.release_date) > new Date();
        },
      );

      // Create a merged list prioritizing both upcoming date and popularity
      const mergedResults: MediaItem[] = [];
      let dateIdx = 0;
      let popIdx = 0;

      // Alternate between date-ordered and popularity-ordered results
      while (
        mergedResults.length < 20 &&
        (dateIdx < futureDateOrdered.length ||
          popIdx < futurePopularityOrdered.length)
      ) {
        // Add date-ordered item if available
        if (dateIdx < futureDateOrdered.length) {
          const dateMovie = futureDateOrdered[dateIdx];
          if (!mergedResults.some((m) => m.id === dateMovie.id)) {
            mergedResults.push(dateMovie);
          }
          dateIdx++;
        }

        // Add popularity-ordered item if available
        if (
          popIdx < futurePopularityOrdered.length &&
          mergedResults.length < 20
        ) {
          const popMovie = futurePopularityOrdered[popIdx];
          if (!mergedResults.some((m) => m.id === popMovie.id)) {
            mergedResults.push(popMovie);
          }
          popIdx++;
        }
      }

      // Also try the standard upcoming endpoint for any additional items
      if (mergedResults.length < 20) {
        const upcomingResults = await fetchPaginatedMovies(
          "/movie/upcoming",
          params,
          page,
        );

        // Filter to only include future releases
        const futureUpcoming = upcomingResults.filter((movie) => {
          if (!movie.release_date) return false;
          return new Date(movie.release_date) > new Date();
        });

        // Add any missing results
        for (const movie of futureUpcoming) {
          if (!mergedResults.some((m) => m.id === movie.id)) {
            mergedResults.push(movie);
          }

          // Stop once we have enough
          if (mergedResults.length >= 20) break;
        }
      }

      results = mergedResults;
    }
    // Genre-based rows - just use standard genre filtering
    else if (category === "action") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "28",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "comedy") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "35",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "drama") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "18",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "thriller") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "53",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "scifi_fantasy") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "878,14",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "romcom") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          with_genres: "10749,35",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // Curated picks
    else if (category === "hidden_gems") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "vote_average.gte": "7.5",
          "vote_count.gte": "500",
          "vote_count.lte": "5000",
          sort_by: "vote_average.desc",
        },
        page,
      );
    } else if (category === "critically_acclaimed") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "vote_average.gte": "8.0",
          "vote_count.gte": "2000",
          sort_by: "vote_average.desc",
        },
        page,
      );
    }
    // Time-based categories
    else if (category === "eighties") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "primary_release_date.gte": "1980-01-01",
          "primary_release_date.lte": "1989-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "nineties") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "primary_release_date.gte": "1990-01-01",
          "primary_release_date.lte": "1999-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "early_2000s") {
      results = await fetchPaginatedMovies(
        "/discover/movie",
        {
          ...params,
          "primary_release_date.gte": "2000-01-01",
          "primary_release_date.lte": "2009-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // Studios categories
    else if (category === "studio_a24") {
      const data = await fetchMoviesByCompany(41077, page);
      results = data.results || [];
    } else if (category === "studio_disney") {
      const data = await fetchMoviesByCompany(2, page);
      results = data.results || [];
    } else if (category === "studio_pixar") {
      const data = await fetchMoviesByCompany(3, page);
      results = data.results || [];
    } else if (category === "studio_warner_bros") {
      const data = await fetchMoviesByCompany(174, page);
      results = data.results || [];
    } else if (category === "studio_universal") {
      const data = await fetchMoviesByCompany(33, page);
      results = data.results || [];
    } else if (category === "studio_dreamworks") {
      const data = await fetchMoviesByCompany(521, page);
      results = data.results || [];
    }
    // Director categories
    else if (category === "director_nolan") {
      const data = await fetchMoviesByPerson(525, page, "Director");
      results = data.results || [];
    } else if (category === "director_tarantino") {
      const data = await fetchMoviesByPerson(138, page, "Director");
      results = data.results || [];
    } else if (category === "director_spielberg") {
      const data = await fetchMoviesByPerson(488, page, "Director");
      results = data.results || [];
    } else if (category === "director_scorsese") {
      const data = await fetchMoviesByPerson(1032, page, "Director");
      results = data.results || [];
    } else if (category === "director_fincher") {
      const data = await fetchMoviesByPerson(7467, page, "Director");
      results = data.results || [];
    }
    // Standard categories
    else if (category === "top_rated" && type === "movie") {
      results = await fetchPaginatedMovies("/movie/top_rated", params, page);
    } else if (category === "top_rated" && type === "tv") {
      results = await fetchPaginatedMovies("/tv/top_rated", params, page);
    }
    // TV-specific
    else if (category === "binge_worthy") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "limited_series") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_type: "5",
          "vote_average.gte": "7.5",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "reality") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10764",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "docuseries") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "99",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // New TV categories
    else if (category === "on_the_air" && type === "tv") {
      results = await fetchPaginatedMovies("/tv/on_the_air", params, page);
    } else if (category === "tv_comedy") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "35",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_drama") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "18",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_crime") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "80",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_scifi_fantasy") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10765",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_animation") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "16",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_kids") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10762",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // TV Network categories
    else if (category === "tv_network_hbo") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "49",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_netflix") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "213",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_disney_channel") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "54",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_cartoon_network") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "56",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_nickelodeon") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "13",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_fx") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "88",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_amc") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "174",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_bbc") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "4",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // TV Special categories
    else if (category === "tv_90s_cartoons") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "16",
          "first_air_date.gte": "1990-01-01",
          "first_air_date.lte": "1999-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_anime") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "16",
          with_origin_country: "JP",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_british_comedy") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "35",
          with_origin_country: "GB",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_true_crime") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "80,99",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_sitcoms") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "35",
          "vote_average.gte": "7.5",
          "vote_count.gte": "100",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_limited_series") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_type: "2",
          "vote_average.gte": "7.5",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_medical_dramas") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "18",
          with_keywords: "12279",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_superhero") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10759,10765",
          with_keywords: "9715",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_cooking_shows") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10764",
          with_keywords: "6149",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // TV Time period categories
    else if (category === "tv_90s") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          "first_air_date.gte": "1990-01-01",
          "first_air_date.lte": "1999-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_2000s") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          "first_air_date.gte": "2000-01-01",
          "first_air_date.lte": "2009-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_2010s") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          "first_air_date.gte": "2010-01-01",
          "first_air_date.lte": "2019-12-31",
          sort_by: "popularity.desc",
        },
        page,
      );
    }
    // Additional TV categories from original page
    else if (category === "tv_kdrama") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_origin_country: "KR",
          sort_by: "popularity.desc",
          "vote_count.gte": "50",
        },
        page,
      );
    } else if (category === "tv_mind_bending_scifi") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10765",
          with_keywords: "mind-bending,alternate-reality,time-travel",
          "vote_average.gte": "7.0",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_teen_supernatural") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10765",
          with_keywords: "teen,supernatural",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_disney_xd") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "44",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_period_dramas") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "18",
          with_keywords: "period-drama,historical",
          "vote_count.gte": "50",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_network_hits") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_networks: "6,2,13,21,30,40",
          with_origin_country: "US",
          "vote_count.gte": "100",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_romantic_crime") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "80,18",
          with_keywords: "romance",
          "vote_count.gte": "50",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_family") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "10751",
          with_origin_country: "US",
          "vote_count.gte": "50",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_kdrama_romance") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_origin_country: "KR",
          with_genres: "18,35",
          with_keywords: "romance,love",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_workplace_comedies") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "35",
          with_keywords: "workplace,office",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else if (category === "tv_mystery") {
      results = await fetchPaginatedMovies(
        "/discover/tv",
        {
          ...params,
          with_genres: "9648",
          "vote_count.gte": "100",
          sort_by: "popularity.desc",
        },
        page,
      );
    } else {
      console.warn(`Unknown category: ${category}, type: ${type}`);
      return [];
    }

    // console.log(`Fetched ${results.length} results for category: ${category}, type: ${type}, page: ${page}`,);
    return results;
  } catch (error) {
    console.error(`Error fetching paginated category ${category}:`, error);
    return [];
  }
}

export async function fetchAndEnrichMediaItems<
  T extends { id: number } & Partial<MediaItem>,
>(items: T[], mediaType?: "movie" | "tv"): Promise<T[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      // Determine media type if not provided.
      // This is a fallback, ideally the type is known when calling this function.
      const type = mediaType || (await determineMediaType(item.id));

      if (type === "unknown") {
        return item; // Return original item if type can't be determined
      }

      try {
        // Fetch full details for the item, which will include videos and images
        // due to the modification in fetchTMDBData
        const detailedData = await fetchTMDBData(`/${type}/${item.id}`);

        let englishLogo: Logo | undefined = undefined;
        if (detailedData.images && detailedData.images.logos) {
          // Find English logo if available
          const logos = detailedData.images.logos;
          const englishLogoData: Logo | undefined = logos.find(
            (logo: Logo) => logo.iso_639_1 === "en",
          );

          if (englishLogoData) {
            // Validate with Zod schema
            const logoResult = LogoSchema.safeParse(englishLogoData);
            if (logoResult.success) {
              englishLogo = logoResult.data;
            }
          }
        }

        // Create enriched item with all the details
        const enrichedItem = {
          ...item,
          ...detailedData,
          logo: englishLogo,
        };

        // Use appropriate schema based on media type
        if (type === "movie") {
          const result = MovieSchema.safeParse(enrichedItem);
          if (result.success) {
            return result.data as unknown as T;
          }
        } else if (type === "tv") {
          const result = TvShowSchema.safeParse(enrichedItem);
          if (result.success) {
            return result.data as unknown as T;
          }
        }

        // If validation fails, return with type assertion
        return enrichedItem as T;
      } catch (error) {
        console.error(
          `Error fetching details for ${type} ID ${item.id}:`,
          error,
        );
        return item; // Return original item on error
      }
    }),
  );
  return enrichedItems;
}

// New function to fetch movies by production company
export async function fetchMoviesByCompany(
  companyId: number,
  page: number = 1,
  releaseDateBefore?: string,
) {
  try {
    const params: Params = {
      with_companies: companyId.toString(),
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      page: page.toString(),
    };

    // Add date filtering if provided
    if (releaseDateBefore) {
      params["primary_release_date.lte"] = releaseDateBefore;
    }

    const data = await fetchTMDBData("/discover/movie", params, page);

    return {
      page: data.page,
      results: data.results,
      total_pages: data.total_pages,
      total_results: data.total_results,
    };
  } catch (error) {
    console.error(`Error fetching movies for company ${companyId}:`, error);
    return { page, results: [], total_pages: 0, total_results: 0 };
  }
}

// New function to fetch movies by person
export async function fetchMoviesByPerson(
  personId: number,
  page: number = 1,
  job?: string,
  releaseDateBefore?: string,
) {
  try {
    const params: Params = {
      with_people: personId.toString(),
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      page: page.toString(),
    };

    // Add date filtering if provided
    if (releaseDateBefore) {
      params["primary_release_date.lte"] = releaseDateBefore;
    }

    const data = await fetchTMDBData("/discover/movie", params, page);

    let results = data.results || [];

    // If job is specified, we need to verify each person's role
    if (job && results.length > 0) {
      // Get the person's credits
      const creditsData = await fetchTMDBData(
        `/person/${personId}/movie_credits`,
      );
      const creditsList = creditsData.crew || [];

      // Filter the movie IDs where the person has the specified job
      const moviesWithSpecifiedJob = new Set(
        creditsList
          .filter((credit: { job: string }) => credit.job === job)
          .map((credit: { id: number }) => credit.id),
      );

      // Filter our results to only include movies where the person had the specified job
      results = results.filter((movie: MediaItem) =>
        moviesWithSpecifiedJob.has(movie.id),
      );
    }

    return {
      page: data.page,
      results: results,
      total_pages: data.total_pages,
      total_results: data.total_results,
    };
  } catch (error) {
    console.error(`Error fetching movies for person ${personId}:`, error);
    return { page, results: [], total_pages: 0, total_results: 0 };
  }
}
