import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
} from "@/app/actions";
import {
  getRowConfig,
  handleInternationalRowFiltering,
  isInternationalRow,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";

/**
 * Content row configuration is now handled via JSON in utils/filters.json
 * This component uses getRowConfig() from content-filters.ts to access configurations
 */

/**
 * Server-side data fetching function - matches API route logic
 */
async function fetchStandardizedRow(
  rowId: string,
  minCount: number = 20,
): Promise<MediaItem[]> {
  const config = getRowConfig(rowId);
  if (!config) {
    console.error(`[ServerContentRow] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = config;
  const rowSeenIds = new Set<number>();
  let items: MediaItem[] = [];
  let page = 1;

  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  const isUsTvContent = (item: MediaItem): boolean => {
    if (isInternationalRow(rowId)) {
      return handleInternationalRowFiltering(rowId, item);
    }

    return (
      mediaType !== "tv" ||
      item.origin_country?.includes("US") ||
      item.original_language === "en"
    );
  };

  const filterAndDeduplicate = (item: MediaItem): boolean => {
    if (!hasValidPoster(item) || !isUsTvContent(item)) return false;
    if (rowSeenIds.has(item.id)) return false;
    rowSeenIds.add(item.id);
    return true;
  };

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

  return items.slice(0, minCount);
}

/**
 * Add artificial delay to ensure Suspense boundary shows fallback
 * This simulates realistic loading time and ensures skeleton visibility
 */
async function delayForSuspense<T>(
  promise: Promise<T>,
  minDelay: number = 300,
): Promise<T> {
  const [result] = await Promise.all([
    promise,
    new Promise((resolve) => setTimeout(resolve, minDelay)),
  ]);
  return result;
}

interface ServerContentRowAsyncProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
}

/**
 * Server Component that fetches data and renders ContentRow
 * This component will be wrapped in Suspense
 */
export async function ServerContentRowAsync({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
}: ServerContentRowAsyncProps) {
  try {
    // Fetch data on the server with minimum delay to show skeleton
    const items = await delayForSuspense(
      fetchStandardizedRow(rowId, minCount),
      200, // Minimum 200ms delay to ensure skeleton shows
    );

    // Optionally enrich items with additional details
    const config = getRowConfig(rowId);
    const finalItems = enrich
      ? await fetchAndEnrichMediaItems(items, config?.mediaType || "movie")
      : items;

    // If no items, don't render anything
    if (finalItems.length === 0) {
      return null;
    }

    return (
      <section id={rowId} className="my-4">
        <ContentRow
          title={title}
          items={finalItems}
          href={href}
          variant={variant}
        />
      </section>
    );
  } catch (error) {
    console.error(`[ServerContentRowAsync] Error loading row ${rowId}:`, error);

    // Return error state
    return (
      <section id={rowId} className="my-4">
        <div className="mx-4 md:mx-8 mb-8">
          <div className="text-red-500 text-sm">Failed to load {title}</div>
        </div>
      </section>
    );
  }
}
