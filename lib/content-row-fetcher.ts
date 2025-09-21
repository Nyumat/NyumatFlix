import {
  buildMaybeItemsWithCategories,
  fetchPaginatedCategory,
} from "@/app/actions";
import {
  getFilterConfig,
  getRowConfig,
  handleInternationalRowFiltering,
  isInternationalRow,
  rowUsesCustomFetcher,
} from "@/utils/content-filters";
import { RowConfiguration } from "@/utils/filterSchema";
import { MediaItem } from "@/utils/typings";

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

  const config = getRowConfig(rowId);
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
    if (rowUsesCustomFetcher(rowId)) {
      // For custom fetchers, start from page 1 (not minCount)
      const result = await handleCustomFetcher(config, 1);
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
  config: RowConfiguration,
  page: number = 1,
): Promise<{ results: MediaItem[]; total_pages?: number } | null> {
  // Get the filter config to check for custom fetchers
  const filterConfig = getFilterConfig(config.category);
  if (!filterConfig?.fetchConfig.customFetch) return null;

  try {
    // Call the custom fetcher function directly
    return await filterConfig.fetchConfig.customFetch(page);
  } catch (error) {
    console.error(
      `[ContentRowFetcher] Error with custom fetcher for ${config.category}:`,
      error,
    );
    return null;
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
