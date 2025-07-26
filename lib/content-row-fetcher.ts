import {
  buildMaybeItemsWithCategories,
  fetchPaginatedCategory,
} from "@/app/actions";
import { customFetchers } from "@/utils/customFetchers";
import { MediaItem } from "@/utils/typings";
import {
  ContentRowConfig,
  getContentRowConfig,
  hasCustomFetcher,
} from "./content-row-config";

interface FetchContentRowOptions {
  rowId: string;
  minCount?: number;
  globalSeenIds?: Set<number>;
  filterUsTvOnly?: boolean;
}

interface ContentRowResult {
  items: MediaItem[];
  totalAvailable: number;
}

/**
 * Centralized function to fetch content for any row type.
 * Handles both standard categories and custom fetchers with consistent filtering.
 */
export async function fetchContentRowData(
  options: FetchContentRowOptions,
): Promise<ContentRowResult> {
  const {
    rowId,
    minCount = 20,
    globalSeenIds = new Set<number>(),
    filterUsTvOnly = true,
  } = options;

  const config = getContentRowConfig(rowId);
  if (!config) {
    console.error(`[ContentRowFetcher] Invalid row ID: ${rowId}`);
    return { items: [], totalAvailable: 0 };
  }

  const { category, mediaType } = config;
  let items: MediaItem[] = [];
  let totalAvailable = 0;

  // Common filter functions
  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  const isUsTvContent = (item: MediaItem): boolean => {
    // For international rows, allow their specific origin countries
    if (isInternationalRow(rowId)) {
      return handleInternationalRowFiltering(rowId, item);
    }

    // For other rows, keep the original logic
    return (
      mediaType !== "tv" ||
      !filterUsTvOnly ||
      item.origin_country?.includes("US") ||
      item.original_language === "en"
    );
  };

  const filterAndDeduplicate = (item: MediaItem): boolean => {
    if (!hasValidPoster(item) || !isUsTvContent(item)) return false;
    if (globalSeenIds.has(item.id)) return false;
    globalSeenIds.add(item.id);
    return true;
  };

  try {
    // Check if this row uses a custom fetcher
    if (hasCustomFetcher(rowId) && config.customFetcher) {
      const result = await handleCustomFetcher(config, minCount);
      if (result) {
        const filteredItems = result.results
          .filter(filterAndDeduplicate)
          .slice(0, minCount);

        return {
          items: filteredItems,
          totalAvailable: result.total_pages
            ? result.total_pages * 20
            : result.results.length,
        };
      }
    }

    // Fall back to standard category fetching
    let page = 1;
    while (items.length < minCount && page <= 10) {
      const newItems = await fetchPaginatedCategory(category, mediaType, page);
      if (!newItems || newItems.length === 0) break;

      const processedItems = await buildMaybeItemsWithCategories<MediaItem>(
        newItems,
        mediaType,
      );

      const filteredItems = processedItems.filter(filterAndDeduplicate);
      items = [...items, ...filteredItems];
      page++;
    }

    totalAvailable = items.length;

    return {
      items: items.slice(0, minCount),
      totalAvailable,
    };
  } catch (error) {
    console.error(`[ContentRowFetcher] Error fetching row ${rowId}:`, error);
    return { items: [], totalAvailable: 0 };
  }
}

/**
 * Handle custom fetcher execution
 */
async function handleCustomFetcher(
  config: ContentRowConfig,
  page: number = 1,
): Promise<{ results: MediaItem[]; total_pages?: number } | null> {
  if (!config.customFetcher) return null;

  const { name, params = {} } = config.customFetcher;

  try {
    switch (name) {
      case "fetchByDirector":
        if (params.directorKey) {
          return await customFetchers.fetchByDirector(
            params.directorKey as "nolan",
            page,
          );
        }
        break;

      case "fetchByStudio":
        if (params.studioKey) {
          return await customFetchers.fetchByStudio(
            params.studioKey as "a24",
            page,
          );
        }
        break;

      case "fetchByCollection":
        if (params.collectionKey) {
          return await customFetchers.fetchByCollection(
            params.collectionKey as "marvel-mcu",
            page,
          );
        }
        break;

      case "fetchDiverseTV":
        return await customFetchers.fetchDiverseTV(page);

      case "fetchSitcoms":
        return await customFetchers.fetchSitcoms(page);

      case "fetchNetworkHits":
        return await customFetchers.fetchNetworkHits(page);

      default:
        console.warn(`[ContentRowFetcher] Unknown custom fetcher: ${name}`);
        return null;
    }
  } catch (error) {
    console.error(
      `[ContentRowFetcher] Error with custom fetcher ${name}:`,
      error,
    );
    return null;
  }

  return null;
}

/**
 * Check if a row is for international content
 */
function isInternationalRow(rowId: string): boolean {
  const internationalRows = [
    "kdrama",
    "kdrama-romance",
    "tv-anime",
    "tv-british-comedy",
  ];
  return internationalRows.includes(rowId);
}

/**
 * Handle filtering for international content rows
 */
function handleInternationalRowFiltering(
  rowId: string,
  item: MediaItem,
): boolean {
  switch (rowId) {
    case "kdrama":
    case "kdrama-romance":
      return item.origin_country?.includes("KR") || false;
    case "tv-anime":
      return item.origin_country?.includes("JP") || false;
    case "tv-british-comedy":
      return item.origin_country?.includes("GB") || false;
    default:
      return true;
  }
}

/**
 * Fetch multiple content rows in parallel with global deduplication
 */
export async function fetchMultipleContentRows(
  rowConfigs: Array<{
    rowId: string;
    minCount?: number;
  }>,
  options?: {
    filterUsTvOnly?: boolean;
  },
): Promise<
  Array<{
    rowId: string;
    items: MediaItem[];
    totalAvailable: number;
  }>
> {
  const globalSeenIds = new Set<number>();

  // Process rows sequentially to maintain global deduplication
  const results: Array<{
    rowId: string;
    items: MediaItem[];
    totalAvailable: number;
  }> = [];

  for (const { rowId, minCount } of rowConfigs) {
    const result = await fetchContentRowData({
      rowId,
      minCount,
      globalSeenIds,
      filterUsTvOnly: options?.filterUsTvOnly,
    });

    results.push({
      rowId,
      items: result.items,
      totalAvailable: result.totalAvailable,
    });
  }

  return results;
}

/**
 * Get recommended content rows for a specific page type
 */
export function getRecommendedRowsForPage(
  pageType: "home" | "movies" | "tv",
): string[] {
  switch (pageType) {
    case "home":
      return [
        "top-rated-movies",
        "early-2000s-movies",
        "popular-movies",
        "popular-tvshows",
        "nolan-films",
        "scifi-fantasy-movies",
        "binge-worthy-series",
        "comedy-movies",
        "a24-films",
        "thriller-movies",
        "limited-series",
        "drama-movies",
        "critically-acclaimed",
        "eighties-movies",
        "reality-tv",
        "nineties-movies",
        "romcom-movies",
        "docuseries",
        "hidden-gems",
      ];

    case "movies":
      return [
        "top-rated-movies",
        "drama-movies",
        "disney-magic",
        "nineties-movies",
        "scifi-fantasy-movies",
        "recent-releases",
        "spielberg-films",
        "hidden-gems",
        "comedy-movies",
        "early-2000s-movies",
        "nolan-films",
        "pixar-animation",
        "upcoming-movies",
        "scorsese-films",
        "a24-films",
        "eighties-movies",
        "popular-movies",
        "critically-acclaimed",
        "action-movies",
        "tarantino-films",
        "thriller-movies",
        "romcom-movies",
      ];

    case "tv":
      return [
        "popular-tvshows",
        "top-rated-tvshows",
        "binge-worthy-series",
        "sitcoms",
        "drama-tvshows",
        "limited-series",
        "comedy-tvshows",
        "network-hits",
        "crime-tvshows",
        "scifi-tvshows",
        "reality-tv",
        "docuseries",
        "action-tvshows",
        "animation-tvshows",
        "kdrama",
        "tv-anime",
        "tv-british-comedy",
      ];

    default:
      return [];
  }
}
