import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
} from "@/app/actions";
import {
  getFilterConfig,
  getRowConfig,
  handleInternationalRowFiltering,
  isInternationalRow,
  rowUsesCustomFetcher,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

const CACHE_TTL_SECONDS = 20 * 60; // 20 minutes

async function fetchStandardizedRowUncached(
  rowId: string,
  minCount: number = 20,
): Promise<MediaItem[]> {
  const config = getRowConfig(rowId);
  if (!config) {
    console.error(`[ContentRows] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = config;
  const rowSeenIds = new Set<number>();

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

  if (rowUsesCustomFetcher(rowId)) {
    const rowConfig = getRowConfig(rowId);
    const filterConfig = getFilterConfig(rowConfig?.category || "");

    if (filterConfig?.fetchConfig?.customFetch) {
      let items: MediaItem[] = [];
      let page = 1;
      let totalPages = 1;

      while (items.length < minCount && page <= totalPages && page <= 10) {
        const result = await filterConfig.fetchConfig.customFetch(page);
        if (!result) break;

        totalPages = result.total_pages ?? totalPages;
        const filtered = (result.results || []).filter(filterAndDeduplicate);
        items = [...items, ...filtered];
        page++;
      }

      return items.slice(0, minCount);
    }
  }

  let items: MediaItem[] = [];
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

  return items.slice(0, minCount);
}

const fetchStandardizedRow = unstable_cache(
  fetchStandardizedRowUncached,
  ["content-row"],
  { revalidate: CACHE_TTL_SECONDS },
);

/**
 * API route handler for fetching row content
 * Note: we only cache the base TMDB data, not the enriched version
 * (enriched data can exceed the 2MB cache limit)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rowId = searchParams.get("id");
  const enrichRaw = searchParams.get("enrich");
  const countRaw = searchParams.get("count");

  const minCount = countRaw ? parseInt(countRaw, 10) : 20;
  const shouldEnrich = enrichRaw === "true";

  if (!rowId || !getRowConfig(rowId)) {
    return NextResponse.json(
      { error: "Invalid row ID provided" },
      { status: 400 },
    );
  }

  try {
    // base fetch is cached, enrichment runs after (too large to cache)
    const items = await fetchStandardizedRow(rowId, minCount);
    const config = getRowConfig(rowId);

    const response =
      shouldEnrich && config
        ? await fetchAndEnrichMediaItems(items, config.mediaType)
        : items;

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${CACHE_TTL_SECONDS * 2}`,
      },
    });
  } catch (error) {
    console.error(`Error fetching row ${rowId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch content row" },
      { status: 500 },
    );
  }
}
