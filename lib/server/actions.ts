import "server-only";

import { movieDb, TMDB_API_KEY, TMDB_BASE_URL } from "@/lib/constants";
import { filterZeroRevenueMovies } from "@/lib/movie-revenue-filter";
import { addRomanceFiltering, filterRomanceContent } from "@/lib/romance-media";
import { redactTmdbUrl, tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { logger } from "@/lib/utils";
import {
  mapItemsToCanonicalCardsValue,
  mapMediaListToCanonicalCardsValue,
  mapMediaToCanonicalCardValue,
  mapMovieToCanonicalCardValue,
  mapPersonToCanonicalCardValue,
  mapTvShowToCanonicalCardValue,
  type MappableMediaItem,
} from "@/lib/cards/mappers";
import {
  Genre,
  GenreSchema,
  Logo,
  LogoSchema,
  CanonicalMediaCard,
  CanonicalMovieCard,
  CanonicalPersonCard,
  CanonicalTvCard,
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
} from "@/lib/domain/typings";
import type { PersonDetails } from "@/tmdb/models";
import type { Person as TmdbPerson } from "moviedb-promise/dist/request-types";
import { cache } from "react";

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

const emptyTmdbResponse = <T>(): TmdbResponse<T> => ({
  page: 1,
  results: [],
  total_pages: 0,
  total_results: 0,
});

const isNetworkFetchError = (error: unknown): boolean => {
  if (!(error instanceof TypeError)) {
    return false;
  }

  return error.message === "fetch failed";
};

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
    const enrichedItem = { ...item, categories };
    const result = MediaItemSchema.safeParse(enrichedItem);

    if (result.success) {
      return result.data;
    }

    logger.warn(`Validation failed for item ${item.id}:`, result.error.message);
    return enrichedItem as unknown as MediaItem;
  });

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

export async function mapMovieToCanonicalCard(
  movie: MappableMediaItem,
): Promise<CanonicalMovieCard> {
  return mapMovieToCanonicalCardValue(movie);
}

export async function mapTvShowToCanonicalCard(
  show: MappableMediaItem,
): Promise<CanonicalTvCard> {
  return mapTvShowToCanonicalCardValue(show);
}

export async function mapPersonToCanonicalCard(
  person: MappableMediaItem,
): Promise<CanonicalPersonCard> {
  return mapPersonToCanonicalCardValue(person);
}

export async function mapMediaToCanonicalCard(
  item: MappableMediaItem,
  fallbackType?: "movie" | "tv",
): Promise<CanonicalMediaCard> {
  return mapMediaToCanonicalCardValue(item, fallbackType);
}

export async function mapMediaListToCanonicalCards(
  items: MappableMediaItem[],
  fallbackType?: "movie" | "tv",
): Promise<CanonicalMediaCard[]> {
  return mapMediaListToCanonicalCardsValue(items, fallbackType);
}

export async function mapItemsToCanonicalCards(
  items: MappableMediaItem[],
  fallbackType?: "movie" | "tv",
) {
  return mapItemsToCanonicalCardsValue(items, fallbackType);
}

export const getCategories = cache(async function getCategories(
  type: "movie" | "tv" | "multi",
): Promise<Genre[]> {
  if (type === "multi") {
    const [movieGenres, tvGenres] = await Promise.all([
      fetchTMDBData(`/genre/movie/list`),
      fetchTMDBData(`/genre/tv/list`),
    ]);

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
});

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
    limitedSeries,
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

    fetchTMDBData("/discover/tv", {
      with_type: "5",
      "vote_average.gte": "7.5",
      sort_by: "popularity.desc",
      language: "en-US",
      include_adult: "false",
      without_genres: "10749",
    }), // Limited Series
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

    actionMovies: actionMovies.results,
    comedyMovies: comedyMovies.results,
    dramaMovies: dramaMovies.results,
    thrillerMovies: thrillerMovies.results,
    scifiFantasyMovies: scifiFantasyMovies.results,
    romComMovies: romComMovies.results,

    hiddenGems: hiddenGems.results,
    criticallyAcclaimed: criticallyAcclaimed.results,

    eightiesMovies: eightiesMovies.results,
    ninetiesMovies: ninetiesMovies.results,
    earlyTwosMovies: earlyTwosMovies.results,
    recentReleases: recentReleases.results,

    limitedSeries: limitedSeries.results,
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
  const appendItems = ["videos", "images", "external_ids"];

  const isDetailEndpoint = /\/(?:movie|tv)\/\d+(?:\/|$)/.test(endpoint);
  if (isDetailEndpoint) {
    url.searchParams.append("append_to_response", appendItems.join(","));
  }
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString());

  const isRomanceQuery =
    params.with_genres?.includes("10749") || endpoint.includes("romance");
  const filteredParams = isRomanceQuery ? params : addRomanceFiltering(params);

  for (const [key, value] of Object.entries(filteredParams)) {
    if (typeof key === "string" && typeof value === "string") {
      url.searchParams.append(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(
      url.toString(),
      tmdbFetchInit({
        endpoint: url.toString(),
        params: url.searchParams,
        revalidate: 3600,
      }),
    );
  } catch (error) {
    if (isNetworkFetchError(error)) {
      return emptyTmdbResponse<T>();
    }
    throw error;
  }

  if (!response.ok) {
    logger.error(
      `TMDB API error: ${response.status} ${response.statusText} ${response.body} ${response.headers} ${redactTmdbUrl(response.url)}`,
    );
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }

  const rawData = await response.json();

  const result = TmdbResponseSchema.safeParse(rawData);

  if (!result.success) {
    logger.warn("TMDB response failed validation:", result.error.message);
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

export async function determineMediaType(id: string | number) {
  try {
    const movieResponse = await fetch(
      `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`,
    );

    if (movieResponse.ok) {
      const movieData = await movieResponse.json();
      if (!movieData.success === false) {
        return "movie";
      }
    }

    const tvResponse = await fetch(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`,
    );

    if (tvResponse.ok) {
      const tvData = await tvResponse.json();
      if (!tvData.success === false) {
        return "tv";
      }
    }

    return "unknown";
  } catch (error) {
    logger.error("Error determining media type:", error);
    return "unknown";
  }
}

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

interface CreditItem {
  id?: number | string;
  media_type?: string;
  genre_ids?: number[];
  order?: number;
  character?: string;
  job?: string;
  department?: string;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  [key: string]: unknown;
}

const NOISY_TV_GENRE_IDS = new Set([10763, 10764, 10767]);

function getCreditItemKey(item: CreditItem) {
  const mediaType =
    item.media_type ?? (typeof item.title === "string" ? "movie" : "tv");
  return `${mediaType}-${String(item.id)}`;
}

function calculateRoleImportanceScore(item: CreditItem): number {
  let score = 0;

  const popularity = item.popularity || 0;
  score += Math.min(popularity * 0.1, 10); // Cap at 10 points

  if (item.order !== undefined && item.order !== null) {
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

  if (item.character && item.character.trim()) {
    const character = item.character.toLowerCase();

    if (
      !character.includes("extra") &&
      !character.includes("background") &&
      !character.includes("uncredited") &&
      !character.includes("voice") &&
      character.length > 2
    ) {
      score += 10;
    }

    if (
      character.includes("protagonist") ||
      character.includes("hero") ||
      character.includes("main")
    ) {
      score += 20;
    }
  }

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

function calculateFilmographyPopularityScore(item: CreditItem): number {
  const popularity = item.popularity || 0;
  const voteCount = item.vote_count || 0;
  const voteConfidence = Math.log10(voteCount + 1) * 25;
  const isNoisyTvFormat =
    item.media_type === "tv" &&
    item.genre_ids?.some((genreId) => NOISY_TV_GENRE_IDS.has(genreId));

  let score = popularity + voteConfidence;

  if (voteCount < 25) {
    score *= 0.55;
  } else if (voteCount < 100) {
    score *= 0.75;
  }

  if (isNoisyTvFormat) {
    score *= 0.35;
  }

  return score;
}

export async function fetchPersonFilmography(
  personId: number,
  page: number = 1,
) {
  try {
    const creditsData = await movieDb.personCombinedCredits({
      id: personId,
      language: "en-US",
    });

    const creditsList = [
      ...(creditsData.cast || []),
      ...(creditsData.crew || []),
    ];

    const uniqueCredits = creditsList.filter(
      (item) => item.poster_path && item.id,
    );

    const deduplicatedCredits = uniqueCredits.reduce(
      (acc, current) => {
        const currentKey = getCreditItemKey(current);
        const existingIndex = acc.findIndex(
          (item) => getCreditItemKey(item) === currentKey,
        );
        if (existingIndex === -1) {
          acc.push(current);
        } else {
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

    const results = deduplicatedCredits.sort((a, b) => {
      const scoreA = calculateFilmographyPopularityScore(a);
      const scoreB = calculateFilmographyPopularityScore(b);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      return (b.vote_count || 0) - (a.vote_count || 0);
    });

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

const toPersonDetails = (person: TmdbPerson): PersonDetails | null => {
  if (person.id == null || !person.name) {
    return null;
  }

  return {
    adult: person.adult ?? false,
    also_known_as: person.also_known_as ?? [],
    birthday: person.birthday ?? "",
    biography: person.biography ?? "",
    ...(person.deathday ? { deathday: person.deathday } : {}),
    gender: person.gender ?? 0,
    ...(person.homepage ? { homepage: person.homepage } : {}),
    id: person.id,
    imdb_id: person.imdb_id ?? "",
    known_for_department: person.known_for_department ?? "",
    name: person.name,
    place_of_birth: person.place_of_birth ?? "",
    popularity: person.popularity ?? 0,
    profile_path: person.profile_path ?? "",
  };
};

export async function getPersonDetails(
  personId: number,
): Promise<PersonDetails | null> {
  try {
    const person = await movieDb.personInfo({
      id: personId,
      language: "en-US",
    });
    return toPersonDetails(person);
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

export async function fetchMovieCertification(
  movieId: number,
): Promise<string | null> {
  try {
    const response = await fetchTMDBData(`/movie/${movieId}/release_dates`);

    const result = ReleaseDatesResponseSchema.safeParse(response);

    if (!result.success) {
      logger.error("Invalid release dates response:", result.error);
      return null;
    }

    const data = result.data;

    const usRelease = data.results?.find(
      (result) => result.iso_3166_1 === "US",
    );
    if (
      usRelease &&
      usRelease.release_dates &&
      usRelease.release_dates.length > 0
    ) {
      const theatrical = usRelease.release_dates.find((rd) => rd.type === 3);
      if (theatrical && theatrical.certification) {
        return theatrical.certification;
      }

      for (const release of usRelease.release_dates) {
        if (release.certification) {
          return release.certification;
        }
      }
    }

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

export async function fetchTVShowCertification(
  tvShowId: number,
): Promise<string | null> {
  try {
    const response = await fetchTMDBData(`/tv/${tvShowId}/content_ratings`);

    if (!response || !response.results) {
      return null;
    }

    const ratingsResponse = response as TmdbContentRatingsResponse;

    const usRating = ratingsResponse.results?.find(
      (rating) => rating.iso_3166_1 === "US",
    );

    if (usRating && usRating.rating) {
      return usRating.rating;
    }

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

const LOGO_ENRICH_CHUNK = 8;

export async function enrichMediaItemsWithLogos<
  T extends { id: number } & Partial<MediaItem>,
>(items: T[], mediaType: "movie" | "tv"): Promise<T[]> {
  if (!items.length) {
    return items;
  }

  const out: T[] = [];

  for (let i = 0; i < items.length; i += LOGO_ENRICH_CHUNK) {
    const slice = items.slice(i, i + LOGO_ENRICH_CHUNK);
    const batch = await Promise.all(
      slice.map(async (item) => {
        try {
          const detailedData = await fetchTMDBData<{ logos?: unknown[] }>(
            `/${mediaType}/${item.id}/images`,
          );
          const logos = detailedData.logos;
          let logo: Logo | undefined;
          if (Array.isArray(logos) && logos.length > 0) {
            const pick =
              logos.find((candidate) => {
                if (
                  typeof candidate !== "object" ||
                  candidate === null ||
                  !("iso_639_1" in candidate)
                ) {
                  return false;
                }
                return candidate.iso_639_1 === "en";
              }) ?? logos[0];
            const logoResult = LogoSchema.safeParse(pick);
            if (logoResult.success) {
              logo = logoResult.data;
            }
          }
          return { ...item, logo } as T;
        } catch (error) {
          if (isNetworkFetchError(error)) {
            return item;
          }
          logger.error(
            `enrichMediaItemsWithLogos failed for ${mediaType} ${item.id}:`,
            error,
          );
          return item;
        }
      }),
    );
    out.push(...batch);
  }

  return out;
}

export async function enrichAboveFoldMediaItemsWithLogos<
  T extends { id: number } & Partial<MediaItem>,
>(items: T[], mediaType: "movie" | "tv", aboveFoldCount: number): Promise<T[]> {
  if (!items.length || aboveFoldCount <= 0) {
    return items;
  }

  if (items.length <= aboveFoldCount) {
    return enrichMediaItemsWithLogos(items, mediaType);
  }

  const aboveFoldItems = items.slice(0, aboveFoldCount);
  const belowFoldItems = items.slice(aboveFoldCount);
  const enrichedAboveFold = await enrichMediaItemsWithLogos(
    aboveFoldItems,
    mediaType,
  );
  return [...enrichedAboveFold, ...belowFoldItems];
}

export async function fetchAndEnrichMediaItems<
  T extends { id: number } & Partial<MediaItem>,
>(items: T[], mediaType?: "movie" | "tv"): Promise<T[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const type = mediaType || (await determineMediaType(item.id));

      if (type === "unknown") {
        return item; // Return original item if type can't be determined
      }

      try {
        const detailedData = await fetchTMDBData(`/${type}/${item.id}`);

        let englishLogo: Logo | undefined = undefined;
        const detailedTvShowData = detailedData as TmdbTvShowDetails;
        if (detailedTvShowData.images && detailedTvShowData.images.logos) {
          const logos = detailedTvShowData.images.logos;
          const englishLogoData: Logo | undefined = logos.find(
            (logo: Logo) => logo.iso_639_1 === "en",
          );

          if (englishLogoData) {
            const logoResult = LogoSchema.safeParse(englishLogoData);
            if (logoResult.success) {
              englishLogo = logoResult.data;
            }
          }
        }

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
        }

        const enrichedItem = {
          ...item,
          ...detailedData,
          logo: englishLogo,
          content_rating: contentRating,
        };

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

export async function enrichItemsWithContentRatings<
  T extends { id: number } & Partial<MediaItem>,
>(items: T[], mediaType: "movie" | "tv"): Promise<T[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      try {
        let contentRating: string | null = null;
        if (mediaType === "movie") {
          contentRating = await fetchMovieCertification(item.id);
        } else if (mediaType === "tv") {
          contentRating = await fetchTVShowCertification(item.id);
        }

        return {
          ...item,
          content_rating: contentRating,
        } as T;
      } catch (error) {
        logger.error(
          `Error fetching content rating for ${mediaType} ID ${item.id}:`,
          error,
        );
        return item; // Return original item on error
      }
    }),
  );

  return enrichedItems;
}

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

export async function fetchMoviesByPerson(
  personId: number,
  page: number = 1,
  job?: string,
) {
  try {
    const creditsData = await fetchTMDBData(
      `/person/${personId}/movie_credits`,
    );
    const creditsResponse = creditsData as unknown as TmdbCreditsResponse;
    let creditsList = creditsResponse.crew || [];

    if (job) {
      creditsList = creditsList.filter(
        (credit: { job: string }) => credit.job === job,
      );
    }

    const results = creditsList
      .filter((item) => (item as unknown as MediaItem).poster_path)
      .sort((a, b) => {
        const popularityA = (a as unknown as MediaItem).popularity || 0;
        const popularityB = (b as unknown as MediaItem).popularity || 0;
        return popularityB - popularityA;
      });

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

  const params =
    type === "movie" ? { ...baseParams, region: "US" } : baseParams;
  const paramString = new URLSearchParams(params).toString();

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
