import { CustomFetcherName, customFetchers } from "./customFetchers";
import {
  FilterDefinition,
  FiltersSchema,
  RowConfiguration,
} from "./filterSchema";
import filtersData from "./filters.json";
import { MediaItem } from "./typings";

/**
 * Generates a human-readable title from a row ID
 * @param rowId The row ID to convert to a title
 * @returns Human-readable title string
 */
export function generateRowTitle(rowId: string): string {
  return rowId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(/Tvshows/g, "TV Shows")
    .replace(/Tv /g, "TV ");
}

/**
 * Generates a URL href from a row configuration
 * @param config The row configuration containing category information
 * @param mediaType The media type (movie or tv)
 * @returns URL href string
 */
export function generateRowHref(
  config: { category: string },
  mediaType: string,
): string {
  const { category } = config;

  if (category.startsWith("genre-")) {
    const genreMap: Record<string, string> = {
      "genre-action": "28",
      "genre-comedy": "35",
      "genre-drama": "18",
      "genre-thriller": "53",
      "genre-scifi-fantasy": "878,14",
      "genre-romcom": "10749,35",
      "genre-horror": "27",
      "genre-crime": "80",
      "genre-mystery": "9648",
      "genre-romance": "10749",
    };
    return `/${mediaType}s/browse?genre=${genreMap[category] || category.replace("genre-", "")}`;
  } else if (category.startsWith("director-")) {
    return `/${mediaType}s/browse?type=${category}`;
  } else if (category.startsWith("studio-")) {
    return `/${mediaType}s/browse?type=${category}`;
  } else if (category.startsWith("year-")) {
    const yearMap: Record<string, string> = {
      "year-80s": "1980-1989",
      "year-90s": "1990-1999",
      "year-2000s": "2000-2009",
      "year-2010s": "2010-2019",
    };
    return `/${mediaType}s/browse?year=${yearMap[category] || category.replace("year-", "")}`;
  } else if (
    ["upcoming", "popular", "top-rated", "now-playing"].includes(category)
  ) {
    return category === "popular"
      ? `/${mediaType}s/browse`
      : `/${mediaType}s/browse?type=${category}`;
  } else {
    return `/${mediaType}s/browse?filter=${category.replace(/^(critically-|hidden-|blockbuster-|award-|cult-|indie-)/, "")}`;
  }
}

// Cache for keyword IDs to avoid repeated API calls
const keywordIdCache = new Map<string, string>();

// Romance filtering constants
const ROMANCE_GENRE_ID = 10749;
const HIGH_RATING_THRESHOLD = 7.5;
const HIGH_POPULARITY_THRESHOLD = 1000;

/**
 * Determines if a romance item should be allowed based on its rating and popularity
 * @param item Media item to check
 * @returns true if the romance content should be allowed (highly rated and popular)
 */
export function shouldAllowRomanceContent(item: {
  genre_ids?: number[];
  genres?: { id: number }[];
  vote_average?: number;
  vote_count?: number;
}): boolean {
  // Check if item contains romance genre
  const hasRomanceGenre =
    item.genre_ids?.includes(ROMANCE_GENRE_ID) ||
    item.genres?.some((genre) => genre.id === ROMANCE_GENRE_ID);

  if (!hasRomanceGenre) {
    return true; // Not romance, allow it
  }

  // For romance content, check if it's highly rated and popular
  const isHighlyRated = (item.vote_average || 0) >= HIGH_RATING_THRESHOLD;
  const isPopular = (item.vote_count || 0) >= HIGH_POPULARITY_THRESHOLD;

  return isHighlyRated && isPopular;
}

/**
 * Adds romance filtering to API parameters
 * @param params Existing API parameters
 * @returns Updated parameters with romance filtering
 */
export function addRomanceFiltering(
  params: Record<string, string>,
): Record<string, string> {
  const updatedParams = { ...params };

  // If there's already a without_genres parameter, append romance ID
  if (updatedParams.without_genres) {
    const existingGenres = updatedParams.without_genres.split(",");
    if (!existingGenres.includes(ROMANCE_GENRE_ID.toString())) {
      updatedParams.without_genres = `${updatedParams.without_genres},${ROMANCE_GENRE_ID}`;
    }
  } else {
    // Add romance exclusion
    updatedParams.without_genres = ROMANCE_GENRE_ID.toString();
  }

  return updatedParams;
}

/**
 * Filters an array of media items to exclude romance content unless highly rated and popular
 * @param items Array of media items to filter
 * @returns Filtered array with romance content restrictions
 */
export function filterRomanceContent<
  T extends {
    genre_ids?: number[];
    genres?: { id: number }[];
    vote_average?: number;
    vote_count?: number;
  },
>(items: T[]): T[] {
  return items.filter(shouldAllowRomanceContent);
}

/**
 * Determines if a movie should be filtered out due to zero revenue
 * @param item Media item to check
 * @returns true if the item should be kept (not filtered out)
 */
export function shouldKeepZeroRevenueMovie(item: {
  media_type?: string;
  status?: string;
  revenue?: number;
  release_date?: string;
}): boolean {
  // Only filter movies, not TV shows
  if (item.media_type === "tv" || (!item.media_type && !item.status)) {
    return true;
  }

  // If it's an upcoming movie (any non-released status), keep it
  if (item.status && item.status !== "Released") {
    return true;
  }

  // If revenue data is missing or undefined, keep it (different from explicitly 0)
  if (item.revenue === undefined || item.revenue === null) {
    return true;
  }

  // If revenue is 0 and it's a released movie, filter it out
  if (item.revenue === 0 && item.status === "Released") {
    return false;
  }

  // Keep everything else
  return true;
}

/**
 * Filters an array of media items to exclude released movies with zero revenue
 * @param items Array of media items to filter
 * @returns Filtered array without released movies that have zero revenue
 */
export function filterZeroRevenueMovies<
  T extends {
    media_type?: string;
    status?: string;
    revenue?: number;
    release_date?: string;
  },
>(items: T[]): T[] {
  return items.filter(shouldKeepZeroRevenueMovie);
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
 * Processes filter parameters and replaces special placeholders
 */
function processFilterParams(
  params: Record<string, string>,
): Record<string, string> {
  const processedParams = { ...params };

  // Add default parameters
  const defaultParams: Record<string, string> = {
    language: "en-US",
    include_adult: "false",
    sort_by: "popularity.desc",
  };

  const baseParams = {
    ...defaultParams,
    ...processedParams,
  };

  // Apply romance filtering unless this is specifically a romance filter
  if (!params.with_genres?.includes("10749")) {
    return addRomanceFiltering(baseParams);
  }

  return baseParams;
}

function resolveDynamicParamValue(value: string): string {
  if (value === "{{TODAY}}") {
    return new Date().toISOString().split("T")[0];
  }

  if (value === "{{THREE_MONTHS_FROM_NOW}}") {
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    return future.toISOString().split("T")[0];
  }

  return value;
}

function resolveDynamicParams(
  params: Record<string, string>,
): Record<string, string> {
  const resolvedParams: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    resolvedParams[key] = resolveDynamicParamValue(value);
  }

  return resolvedParams;
}

/**
 * Converts a FilterDefinition to a ContentFilter
 */
function convertFilterDefinition(
  filterDef: FilterDefinition,
  type: "category" | "genre" | "year" | "studio" | "director" | "special",
): ContentFilter {
  const contentFilter: ContentFilter = {
    id: filterDef.id,
    title: filterDef.title,
    type,
    fetchConfig: {},
  };

  // Handle custom fetchers
  if (filterDef.customFetcher) {
    const fetcherName = filterDef.customFetcher as CustomFetcherName;

    if (fetcherName in customFetchers) {
      // Create a wrapper function that handles the custom parameters
      contentFilter.fetchConfig.customFetch = async (page: number) => {
        const params = filterDef.customParams;

        // Call the appropriate fetcher with the right parameters
        if (fetcherName === "fetchByDirector" && params?.directorKey) {
          return customFetchers.fetchByDirector(
            params.directorKey as "nolan",
            page,
          );
        } else if (fetcherName === "fetchByStudio" && params?.studioKey) {
          return customFetchers.fetchByStudio(
            params.studioKey as "a24" | "marvel-studios",
            page,
          );
        } else if (fetcherName === "fetchDiverseTV") {
          return customFetchers.fetchDiverseTV(page);
        } else if (fetcherName === "fetchSitcoms") {
          return customFetchers.fetchSitcoms(page);
        } else if (fetcherName === "fetchNetworkHits") {
          return customFetchers.fetchNetworkHits(page);
        } else if (fetcherName === "fetchUpcomingMovies") {
          return customFetchers.fetchUpcomingMovies(page);
        }

        return { results: [] };
      };
    }
  } else if (filterDef.params) {
    // Handle standard endpoint-based filters
    const processedParams = processFilterParams(filterDef.params);
    const { endpoint, ...params } = processedParams;

    contentFilter.fetchConfig.endpoint = endpoint || "/discover/movie";
    contentFilter.fetchConfig.params = params;
  }

  return contentFilter;
}

/**
 * Loads and validates filters from JSON, then converts them to ContentFilters
 */
function loadFilters(): Record<string, ContentFilter> {
  try {
    // Validate the JSON structure with Zod
    const validatedFilters = FiltersSchema.parse(filtersData);
    const contentFilters: Record<string, ContentFilter> = {};

    // Process movie filters
    const movieTypes = [
      "category",
      "genre",
      "year",
      "studio",
      "director",
      "special",
    ] as const;
    for (const type of movieTypes) {
      const filters = validatedFilters.movie[type];
      if (filters) {
        for (const filter of filters) {
          contentFilters[filter.id] = convertFilterDefinition(filter, type);
        }
      }
    }

    // Process TV filters
    const tvTypes = [
      "category",
      "genre",
      "year",
      "studio",
      "director",
      "special",
    ] as const;
    for (const type of tvTypes) {
      const filters = validatedFilters.tv[type];
      if (filters) {
        for (const filter of filters) {
          contentFilters[filter.id] = convertFilterDefinition(filter, type);
        }
      }
    }

    return contentFilters;
  } catch (error) {
    console.error("Error loading filters from JSON:", error);
    return {};
  }
}

// Cache for loaded filters to avoid repeated parsing
let cachedFilters: Record<string, ContentFilter> | null = null;

// Lazy load and export the content filters
function getContentFilters(): Record<string, ContentFilter> {
  if (cachedFilters === null) {
    cachedFilters = loadFilters();
  }
  return cachedFilters;
}

/**
 * Gets a filter configuration by ID
 */
export function getFilterConfig(filterId: string): ContentFilter | undefined {
  return getContentFilters()[filterId];
}

/**
 * Gets all filter IDs
 */
export function getFilterIds(): string[] {
  return Object.keys(getContentFilters());
}

/**
 * Gets filters by type
 */
export function getFiltersByType(
  type: "category" | "genre" | "year" | "studio" | "director" | "special",
): ContentFilter[] {
  return Object.values(getContentFilters()).filter(
    (filter) => filter.type === type,
  );
}

/**
 * Gets filters by media type
 */
export function getFiltersByMediaType(
  mediaType: "movie" | "tv",
): ContentFilter[] {
  // Load the original JSON data to check mediaType since ContentFilter doesn't include it
  const validatedFilters = FiltersSchema.parse(filtersData);
  const matchingIds = new Set<string>();

  if (mediaType === "movie") {
    const movieTypes = [
      "category",
      "genre",
      "year",
      "studio",
      "director",
      "special",
    ] as const;
    for (const type of movieTypes) {
      const filters = validatedFilters.movie[type];
      if (filters) {
        for (const filter of filters) {
          matchingIds.add(filter.id);
        }
      }
    }
  } else {
    const tvTypes = [
      "category",
      "genre",
      "year",
      "studio",
      "director",
      "special",
    ] as const;
    for (const type of tvTypes) {
      const filters = validatedFilters.tv[type];
      if (filters) {
        for (const filter of filters) {
          matchingIds.add(filter.id);
        }
      }
    }
  }

  return Object.values(getContentFilters()).filter((filter) =>
    matchingIds.has(filter.id),
  );
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

  const params = {
    ...baseParams,
    ...(filter.fetchConfig.params || {}),
  };

  return {
    endpoint: filter.fetchConfig.endpoint || "/discover/movie",
    params: resolveDynamicParams(params),
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
    params: resolveDynamicParams(params),
  };
}

export function createYearFilterParams(
  year: string,
  mediaType: "movie" | "tv" = "movie",
): {
  endpoint: string;
  params: Record<string, string>;
} {
  const dateField =
    mediaType === "tv" ? "first_air_date" : "primary_release_date";

  if (year.includes("-")) {
    const [startYear, endYear] = year.split("-");
    return {
      endpoint: `/discover/${mediaType}`,
      params: {
        language: "en-US",
        include_adult: "false",
        sort_by: "popularity.desc",
        [`${dateField}.gte`]: `${startYear}-01-01`,
        [`${dateField}.lte`]: `${endYear}-12-31`,
        without_genres: "10749",
      },
    };
  }

  return {
    endpoint: `/discover/${mediaType}`,
    params: {
      language: "en-US",
      include_adult: "false",
      sort_by: "popularity.desc",
      [`${dateField}.gte`]: `${year}-01-01`,
      [`${dateField}.lte`]: `${year}-12-31`,
      without_genres: "10749",
    },
  };
}

/**
 * Gets the title of a filter by ID, or generates a title for year/genre filters
 */
export function getFilterTitle(
  filterId: string,
  year?: string,
  mediaType: "movie" | "tv" = "movie",
): string {
  // If filterId is provided and exists, use it
  if (filterId) {
    const filter = getFilterConfig(filterId);
    if (filter) {
      return filter.title;
    }
  }

  // Handle year-based titles
  if (year) {
    const contentType = mediaType === "tv" ? "TV Shows" : "Movies";
    if (year.includes("-")) {
      const [startYear] = year.split("-");
      return `${startYear}s ${contentType}`;
    }
    return `${year} ${contentType}`;
  }

  return "Unknown Filter";
}

/**
 * Generates a year filter ID from a year string and media type
 */
export function generateYearFilterId(
  year: string,
  _mediaType: "movie" | "tv",
): string {
  return `year-${year}`;
}

// Row configuration functions using JSON data

/**
 * Gets row configuration by ID from JSON
 */
export function getRowConfig(rowId: string): RowConfiguration | null {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    return validatedFilters.rowConfigurations[rowId] || null;
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return null;
  }
}

/**
 * Gets all available row IDs from JSON
 */
export function getAllRowIds(): string[] {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    return Object.keys(validatedFilters.rowConfigurations);
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return [];
  }
}

/**
 * Gets row IDs filtered by media type
 */
export function getRowIdsByMediaType(mediaType: "movie" | "tv"): string[] {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    return Object.entries(validatedFilters.rowConfigurations)
      .filter(([_, config]) => config.mediaType === mediaType)
      .map(([rowId]) => rowId);
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return [];
  }
}

/**
 * Checks if a row is for international content
 */
export function isInternationalRow(rowId: string): boolean {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    const rowConfig = validatedFilters.rowConfigurations[rowId];
    return (
      rowConfig?.international === true ||
      Object.keys(validatedFilters.internationalRowFilters).includes(rowId)
    );
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return false;
  }
}

/**
 * Gets the origin country for international content filtering
 */
export function getInternationalOriginCountry(rowId: string): string | null {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    return validatedFilters.internationalRowFilters[rowId] || null;
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return null;
  }
}

/**
 * Gets recommended rows for a specific page type
 */
export function getRecommendedRowsForPage(
  pageType: "home" | "movies" | "tv",
): string[] {
  try {
    const validatedFilters = FiltersSchema.parse(filtersData);
    return validatedFilters.pageRowRecommendations[pageType] || [];
  } catch (error) {
    console.error("Error parsing filters JSON:", error);
    return [];
  }
}

/**
 * Checks if a row uses a custom fetcher (based on the category)
 */
export function rowUsesCustomFetcher(rowId: string): boolean {
  const rowConfig = getRowConfig(rowId);
  if (!rowConfig) return false;

  // Check if the category corresponds to a filter that uses custom fetchers
  const filterConfig = getFilterConfig(rowConfig.category);
  return Boolean(filterConfig?.fetchConfig.customFetch);
}

/**
 * Handle filtering for international content rows
 */
export function handleInternationalRowFiltering(
  rowId: string,
  item: MediaItem,
): boolean {
  const originCountry = getInternationalOriginCountry(rowId);
  if (!originCountry) return true;

  return item.origin_country?.includes(originCountry) || false;
}
