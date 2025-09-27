import { movieDb, TMDB_API_KEY, TMDB_BASE_URL } from "@/lib/constants";
import { logger } from "@/lib/utils";
import {
  addRomanceFiltering,
  buildFilterParams,
  buildFilterParamsAsync,
  filterRomanceContent,
  filterZeroRevenueMovies,
  getFilterConfig,
} from "@/utils/content-filters";
import {
  Genre,
  GenreSchema,
  Logo,
  LogoSchema,
  MediaItem,
  MediaItemSchema,
  MovieCategory,
  MovieSchema,
  ReleaseDatesResponseSchema,
  TmdbMovieListResponse,
  TmdbResponse,
  TmdbResponseSchema,
  TmdbTvListResponse,
  TVShowCategory,
  TvShowSchema,
} from "@/utils/typings";

interface Params {
  [key: string]: string;
}

interface TmdbGenreResponse {
  genres: Genre[];
}

interface TmdbTvShowDetails {
  number_of_episodes?: number;
  number_of_seasons?: number;
  images?: {
    logos?: Logo[];
  };
}

interface TmdbContentRating {
  iso_3166_1: string;
  rating: string;
}

interface TmdbContentRatingsResponse {
  results: TmdbContentRating[];
}

interface TmdbCreditsResponse {
  crew: Array<{
    job: string;
    [key: string]: unknown;
  }>;
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
  T extends { id: number; genre_ids?: number[] },
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
      logger.warn(
        `Validation failed for item ${item.id}:`,
        result.error.message,
      );
      return enrichedItem as unknown as MediaItem;
    }
  });

  // Apply content filtering as a final step
  return filterRomanceContent(filterZeroRevenueMovies(processedItems));
}

export async function buildMaybeItemsWithCategories<
  T extends { id: number; genre_ids?: number[] },
>(items: T[], type: "movie" | "tv" | "multi"): Promise<MediaItem[]> {
  if (items.length === 0) {
    return [];
  }
  return buildItemsWithCategories(items, type);
}

export async function getCategories(
  type: "movie" | "tv" | "multi",
): Promise<Genre[]> {
  if (type === "multi") {
    // For multi type, combine movie and TV genres
    const [movieGenres, tvGenres] = await Promise.all([
      fetchTMDBData(`/genre/movie/list`),
      fetchTMDBData(`/genre/tv/list`),
    ]);

    // Combine and deduplicate genres by ID
    const movieGenresResponse = movieGenres as unknown as TmdbGenreResponse;
    const tvGenresResponse = tvGenres as unknown as TmdbGenreResponse;
    const movieGenresData = GenreSchema.array().parse(
      movieGenresResponse.genres || [],
    );
    const tvGenresData = GenreSchema.array().parse(
      tvGenresResponse.genres || [],
    );
    const allGenres = [...movieGenresData, ...tvGenresData];
    const uniqueGenres = allGenres.filter(
      (genre, index, self) =>
        index === self.findIndex((g) => g.id === genre.id),
    );

    return uniqueGenres;
  }

  const genres = await fetchTMDBData(`/genre/${type}/list`);
  const genresResponse = genres as unknown as TmdbGenreResponse;
  return GenreSchema.array().parse(genresResponse.genres || []);
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
      without_genres: "10749",
    }),
    fetchTMDBData("/movie/top_rated", {
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/tv/popular", {
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/tv/top_rated", {
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),

    // Genre-Based Rows (Movies)
    fetchTMDBData("/discover/movie", {
      with_genres: "28",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "35",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "18",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "53",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      with_genres: "878,14",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
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
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      "vote_average.gte": "8.0",
      "vote_count.gte": "2000",
      sort_by: "vote_average.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),

    // Time-Based Categories (Movies)
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "1980-01-01",
      "primary_release_date.lte": "1989-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "1990-01-01",
      "primary_release_date.lte": "1999-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "2000-01-01",
      "primary_release_date.lte": "2009-12-31",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),
    fetchTMDBData("/discover/movie", {
      "primary_release_date.gte": "2023-01-01",
      sort_by: "popularity.desc",
      region: "US",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }),

    // TV-Specific
    fetchTMDBData("/discover/tv", {
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }), // Binge-Worthy Series
    fetchTMDBData("/discover/tv", {
      with_type: "5",
      "vote_average.gte": "7.5",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }), // Limited Series
    fetchTMDBData("/discover/tv", {
      with_genres: "10764",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }), // Reality TV
    fetchTMDBData("/discover/tv", {
      with_genres: "99",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }), // Docuseries
    // Fetch for Fan Favorite Classics Hero Carousel
    fetchTMDBData("/discover/movie", {
      with_genres: "16|10751|12|878|35|28|10765", // Animation, Family, Adventure, Sci-Fi, Comedy, Action, Sci-Fi & Fantasy
      sort_by: "popularity.desc",
      "vote_average.gte": "7.0",
      "vote_count.gte": "1500",
      include_adult: "false",
      language: "en-US",
      region: "US",
      without_genres: "10749",
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

  // Apply romance filtering to params unless this is specifically a romance query
  const isRomanceQuery =
    params.with_genres?.includes("10749") || endpoint.includes("romance");
  const filteredParams = isRomanceQuery ? params : addRomanceFiltering(params);

  for (const [key, value] of Object.entries(filteredParams)) {
    if (typeof key === "string" && typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    logger.error(
      `TMDB API error: ${response.status} ${response.statusText} ${response.body} ${response.headers} ${response.url}`,
    );
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  const rawData = await response.json();

  // Use Zod to validate the response
  const result = TmdbResponseSchema.safeParse(rawData);

  if (!result.success) {
    logger.warn("TMDB response failed validation:", result.error.message);
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
  const tvShowData = data as TmdbTvShowDetails;
  return tvShowData.number_of_episodes || null;
}

export async function getNumberOfSeasons(
  tvShowId: number,
): Promise<number | null> {
  const data = await fetchTMDBData(`/tv/${tvShowId}`, {}, 1);
  const tvShowData = data as TmdbTvShowDetails;
  return tvShowData.number_of_seasons || null;
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

    // If not a movie, try to fetch as a TV show
    const tvResponse = await fetch(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`,
    );

    const movieResponseData = await movieResponse.json();
    const tvResponseData = await tvResponse.json();
    if (movieResponseData.media_type === "movie") {
      return "movie";
    }
    if (tvResponseData.media_type === "tv") {
      return "tv";
    }

    // If neither worked, return unknown
    return "unknown";
  } catch (error) {
    logger.error("Error determining media type:", error);
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
    logger.error("Error fetching media details:", error);
    return null;
  }
}

export async function getMovieGenreList() {
  return await movieDb.genreMovieList();
}

export async function getTVGenreList() {
  return await movieDb.genreTvList();
}

// Type for combined credits items (cast or crew)
interface CreditItem {
  order?: number;
  character?: string;
  job?: string;
  department?: string;
  popularity?: number;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  [key: string]: unknown;
}

/**
 * Calculates a role importance score for sorting actor filmography
 * Higher scores indicate more important/significant roles
 */
function calculateRoleImportanceScore(item: CreditItem): number {
  let score = 0;

  // Base score from movie/TV popularity (0-100 scale)
  const popularity = item.popularity || 0;
  score += Math.min(popularity * 0.1, 10); // Cap at 10 points

  // Billing order bonus (lower order = higher billing = more important)
  if (item.order !== undefined && item.order !== null) {
    // Lead roles (order 0-2) get significant bonus
    if (item.order <= 2) {
      score += 50; // Major lead role
    } else if (item.order <= 5) {
      score += 30; // Supporting role
    } else if (item.order <= 10) {
      score += 15; // Minor role
    } else {
      score += 5; // Small role
    }
  }

  // Character name analysis (lead characters often have names, extras don't)
  if (item.character && item.character.trim()) {
    const character = item.character.toLowerCase();

    // Bonus for named characters (not just "Extra" or "Background")
    if (
      !character.includes("extra") &&
      !character.includes("background") &&
      !character.includes("uncredited") &&
      !character.includes("voice") &&
      character.length > 2
    ) {
      score += 10;
    }

    // Special bonus for protagonist-type character names
    if (
      character.includes("protagonist") ||
      character.includes("hero") ||
      character.includes("main")
    ) {
      score += 20;
    }
  }

  // Crew role importance (Directors, Producers, Writers are very important)
  if (item.job) {
    const job = item.job.toLowerCase();
    if (job.includes("director")) {
      score += 40; // Director is very important
    } else if (job.includes("producer") || job.includes("executive producer")) {
      score += 35; // Producer is very important
    } else if (job.includes("writer") || job.includes("screenplay")) {
      score += 30; // Writer is important
    } else if (job.includes("creator") || job.includes("showrunner")) {
      score += 45; // Creator/Showrunner is most important for TV
    } else if (job.includes("executive")) {
      score += 25; // Executive roles are important
    }
  }

  // Department importance
  if (item.department) {
    const dept = item.department.toLowerCase();
    if (dept === "directing") {
      score += 20;
    } else if (dept === "production") {
      score += 15;
    } else if (dept === "writing") {
      score += 15;
    } else if (dept === "creators") {
      score += 25;
    }
  }

  // Recency bonus (more recent work gets slight boost)
  if (item.release_date || item.first_air_date) {
    const releaseDate = item.release_date || item.first_air_date;
    if (releaseDate) {
      const releaseYear = new Date(releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const yearsAgo = currentYear - releaseYear;

      if (yearsAgo <= 2) {
        score += 5; // Very recent
      } else if (yearsAgo <= 5) {
        score += 3; // Recent
      } else if (yearsAgo <= 10) {
        score += 1; // Somewhat recent
      }
    }
  }

  // Vote average bonus (well-received projects get boost)
  if (item.vote_average && item.vote_average > 0) {
    if (item.vote_average >= 8) {
      score += 8; // Excellent
    } else if (item.vote_average >= 7) {
      score += 5; // Very good
    } else if (item.vote_average >= 6) {
      score += 2; // Good
    }
  }

  return score;
}

// New function to fetch person filmography (movies and TV) - following your existing pattern
export async function fetchPersonFilmography(
  personId: number,
  page: number = 1,
) {
  try {
    // Use moviedb-promise to get combined credits directly
    const creditsData = await movieDb.personCombinedCredits({
      id: personId,
      language: "en-US",
    });

    // Combine cast and crew credits
    const creditsList = [
      ...(creditsData.cast || []),
      ...(creditsData.crew || []),
    ];

    // Filter out items without posters and deduplicate by ID
    const uniqueCredits = creditsList.filter(
      (item) => item.poster_path && item.id,
    );

    // Deduplicate by media ID to avoid showing the same movie/show multiple times
    const deduplicatedCredits = uniqueCredits.reduce(
      (acc, current) => {
        const existingIndex = acc.findIndex((item) => item.id === current.id);
        if (existingIndex === -1) {
          acc.push(current);
        } else {
          // If we find a duplicate, keep the one with higher importance score
          const existingScore = calculateRoleImportanceScore(
            acc[existingIndex],
          );
          const currentScore = calculateRoleImportanceScore(current);
          if (currentScore > existingScore) {
            acc[existingIndex] = current;
          }
        }
        return acc;
      },
      [] as typeof uniqueCredits,
    );

    // Sort by role importance
    const results = deduplicatedCredits.sort((a, b) => {
      // Calculate role importance score for each item
      const scoreA = calculateRoleImportanceScore(a);
      const scoreB = calculateRoleImportanceScore(b);
      return scoreB - scoreA; // Higher score = more important role
    });

    // Paginate results (20 per page)
    const startIndex = (page - 1) * 20;
    const endIndex = startIndex + 20;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      page,
      results: paginatedResults,
      total_pages: Math.ceil(results.length / 20),
      total_results: results.length,
    };
  } catch (error) {
    logger.error(`Error fetching filmography for person ${personId}:`, error);
    return { page, results: [], total_pages: 0, total_results: 0 };
  }
}

// Get person details
export async function getPersonDetails(personId: number) {
  try {
    return await movieDb.personInfo({
      id: personId,
      language: "en-US",
    });
  } catch (error) {
    logger.error(`Error fetching person details for ${personId}:`, error);
    return null;
  }
}

export async function getMovies(
  type: MovieCategory,
  page: number,
): Promise<TmdbMovieListResponse | null> {
  switch (type) {
    case "popular":
      return await movieDb.moviePopular({ language: "en-US", page });
    case "top-rated":
      return await movieDb.movieTopRated({ language: "en-US", page });
    case "now-playing":
      return await movieDb.movieNowPlaying({ language: "en-US", page });
    case "upcoming":
      return await movieDb.upcomingMovies({
        language: "en-US",
        page,
        region: "US",
      });
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

export async function getTVShows(
  type: TVShowCategory,
  page: number,
): Promise<TmdbTvListResponse | null> {
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
      logger.error("Invalid release dates response:", result.error);
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
    logger.error("Error fetching movie certification:", error);
    return null;
  }
}

// New function to fetch TV show certification
export async function fetchTVShowCertification(
  tvShowId: number,
): Promise<string | null> {
  try {
    const response = await fetchTMDBData(`/tv/${tvShowId}/content_ratings`);

    if (!response || !response.results) {
      return null;
    }

    const ratingsResponse = response as TmdbContentRatingsResponse;

    // Look for US content rating first
    const usRating = ratingsResponse.results?.find(
      (rating) => rating.iso_3166_1 === "US",
    );

    if (usRating && usRating.rating) {
      return usRating.rating;
    }

    // If no US rating, look for any available rating
    for (const rating of ratingsResponse.results || []) {
      if (rating.rating) {
        return rating.rating;
      }
    }

    return null;
  } catch (error) {
    logger.error("Error fetching TV show certification:", error);
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
    logger.error(`Error fetching paginated movies from ${endpoint}:`, error);
    return [];
  }
}

export async function fetchPaginatedCategory(
  category: string,
  type: "movie" | "tv",
  page: number = 1,
): Promise<MediaItem[]> {
  try {
    // Check if this filter has a custom fetch function first
    const filter = getFilterConfig(category);
    if (filter?.fetchConfig.customFetch) {
      const result = await filter.fetchConfig.customFetch(page);
      return result.results || [];
    }

    // Check if the filter has keyword strings that need resolution
    const hasKeywordStrings =
      filter?.fetchConfig.params?.with_keywords &&
      !filter.fetchConfig.params.with_keywords.match(/^\d+(\|\d+)*$/);

    // Use async version if keywords need resolution, otherwise use sync version
    const filterConfig = hasKeywordStrings
      ? await buildFilterParamsAsync(category)
      : buildFilterParams(category);

    // If we have a valid filter configuration, use it
    if (filterConfig.endpoint && Object.keys(filterConfig.params).length > 0) {
      // Add page parameter
      const params = {
        ...filterConfig.params,
        page: page.toString(),
      };

      const results = await fetchPaginatedMovies(
        filterConfig.endpoint,
        params,
        page,
      );

      return results;
    }

    // Otherwise fall back to the original logic
    // Use standard params for all requests
    const baseParams = {
      language: "en-US",
      include_adult: "false",
    };

    // Add region param for movies only (TV shows might be international but in English)
    const params =
      type === "movie" ? { ...baseParams, region: "US" } : baseParams;

    let results: MediaItem[] = [];

    // Handle standard categories
    if (category === "popular") {
      results = await fetchPaginatedMovies(`/${type}/popular`, params, page);
    } else if (category === "top_rated") {
      results = await fetchPaginatedMovies(`/${type}/top_rated`, params, page);
    } else if (category === "upcoming" && type === "movie") {
      results = await fetchPaginatedMovies("/movie/upcoming", params, page);
    } else if (category === "now_playing" && type === "movie") {
      results = await fetchPaginatedMovies("/movie/now_playing", params, page);
    } else if (category === "on_the_air" && type === "tv") {
      results = await fetchPaginatedMovies("/tv/on_the_air", params, page);
    } else {
      // For other categories, use discover endpoint with basic parameters
      results = await fetchPaginatedMovies(
        `/discover/${type}`,
        {
          ...params,
          sort_by: "popularity.desc",
        },
        page,
      );
    }

    return results;
  } catch (error) {
    logger.error(`Error fetching paginated category ${category}:`, error);
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
        const detailedTvShowData = detailedData as TmdbTvShowDetails;
        if (detailedTvShowData.images && detailedTvShowData.images.logos) {
          // Find English logo if available
          const logos = detailedTvShowData.images.logos;
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

        // Fetch content rating for this item
        let contentRating: string | null = null;
        try {
          if (type === "movie") {
            contentRating = await fetchMovieCertification(item.id);
          } else if (type === "tv") {
            contentRating = await fetchTVShowCertification(item.id);
          }
        } catch (error) {
          logger.error(
            `Error fetching content rating for ${type} ID ${item.id}:`,
            error,
          );
          // Continue without rating rather than failing
        }

        // Create enriched item with all the details including content rating
        const enrichedItem = {
          ...item,
          ...detailedData,
          logo: englishLogo,
          content_rating: contentRating,
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
        logger.error(
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
    logger.error(`Error fetching movies for company ${companyId}:`, error);
    return { page, results: [], total_pages: 0, total_results: 0 };
  }
}

// New function to fetch movies by person
export async function fetchMoviesByPerson(
  personId: number,
  page: number = 1,
  job?: string,
) {
  try {
    // Get the person's credits directly - this is more accurate for specific directors
    const creditsData = await fetchTMDBData(
      `/person/${personId}/movie_credits`,
    );
    const creditsResponse = creditsData as unknown as TmdbCreditsResponse;
    let creditsList = creditsResponse.crew || [];

    // Filter for movies where the person has the specified job (if provided)
    if (job) {
      creditsList = creditsList.filter(
        (credit: { job: string }) => credit.job === job,
      );
    }

    // Filter out items without posters and sort by popularity (most popular first)
    const results = creditsList
      .filter((item) => (item as unknown as MediaItem).poster_path)
      .sort((a, b) => {
        // Sort by popularity (higher popularity first)
        const popularityA = (a as unknown as MediaItem).popularity || 0;
        const popularityB = (b as unknown as MediaItem).popularity || 0;
        return popularityB - popularityA;
      });

    // Paginate results (20 per page)
    const startIndex = (page - 1) * 20;
    const endIndex = startIndex + 20;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      page,
      results: paginatedResults,
      total_pages: Math.ceil(results.length / 20),
      total_results: results.length,
    };
  } catch (error) {
    logger.error(`Error fetching movies for person ${personId}:`, error);
    return { page, results: [], total_pages: 0, total_results: 0 };
  }
}

export async function getPaginatedContentByCategory(
  category: MovieCategory | TVShowCategory,
  type: "movie" | "tv",
  page: number = 1,
): Promise<{ results: MediaItem[]; totalPages: number; totalResults: number }> {
  try {
    const endpoint = await getCategoryEndpoint(category, type, page);
    if (!endpoint) {
      logger.warn(`Unknown category: ${category}, type: ${type}`);
      return { results: [], totalPages: 0, totalResults: 0 };
    }

    const results = await fetchPaginatedData<MediaItem>(endpoint);

    return {
      results: results.results || [],
      totalPages: results.total_pages || 0,
      totalResults: results.total_results || 0,
    };
  } catch (error) {
    logger.error(`Error fetching paginated category ${category}`, error);
    return { results: [], totalPages: 0, totalResults: 0 };
  }
}

/**
 * Maps category and type to TMDB API endpoint
 */
async function getCategoryEndpoint(
  category: string,
  type: "movie" | "tv",
  page: number = 1,
): Promise<string | null> {
  const baseParams = {
    language: "en-US",
    include_adult: "false",
    page: page.toString(),
  };

  // Add region param for movies only
  const params =
    type === "movie" ? { ...baseParams, region: "US" } : baseParams;
  const paramString = new URLSearchParams(params).toString();

  // Map categories to endpoints - use the constant already defined
  if (category === "popular") {
    return `${TMDB_BASE_URL}/${type}/popular?${paramString}`;
  } else if (category === "top_rated") {
    return `${TMDB_BASE_URL}/${type}/top_rated?${paramString}`;
  } else if (category === "upcoming" && type === "movie") {
    return `${TMDB_BASE_URL}/movie/upcoming?${paramString}`;
  } else if (category === "now_playing" && type === "movie") {
    return `${TMDB_BASE_URL}/movie/now_playing?${paramString}`;
  } else if (category === "on_the_air" && type === "tv") {
    return `${TMDB_BASE_URL}/tv/on_the_air?${paramString}`;
  }

  // For other categories, we'll use the existing fetchPaginatedCategory function
  return null;
}

/**
 * Generic function to fetch paginated data from a URL
 */
async function fetchPaginatedData<T>(url: string): Promise<TmdbResponse<T>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch data: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data as TmdbResponse<T>;
  } catch (error) {
    logger.error(`Error fetching paginated data from ${url}:`, error);
    return {
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    } as TmdbResponse<T>;
  }
}
