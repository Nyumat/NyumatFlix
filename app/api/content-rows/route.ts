import { NextResponse } from "next/server";
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

async function fetchStandardizedRow(
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
 * API route handler for fetching row content
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
    const items = await fetchStandardizedRow(rowId, minCount);

    const config = getRowConfig(rowId);
    const response =
      shouldEnrich && config
        ? await fetchAndEnrichMediaItems(items, config.mediaType)
        : items;

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=300",
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
