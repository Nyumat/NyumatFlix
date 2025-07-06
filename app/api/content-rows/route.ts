import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { NextResponse } from "next/server";

/**
 * Maps row IDs to their corresponding category and type information
 */
const ROW_CONFIG: Record<
  string,
  { category: string; mediaType: "movie" | "tv" }
> = {
  // Standard categories
  "popular-movies": { category: "popular", mediaType: "movie" },
  "top-rated-movies": { category: "top_rated", mediaType: "movie" },
  "upcoming-movies": { category: "upcoming", mediaType: "movie" },

  // Genre-based categories
  "action-movies": { category: "action", mediaType: "movie" },
  "comedy-movies": { category: "comedy", mediaType: "movie" },
  "drama-movies": { category: "drama", mediaType: "movie" },
  "thriller-movies": { category: "thriller", mediaType: "movie" },
  "scifi-fantasy-movies": { category: "scifi_fantasy", mediaType: "movie" },
  "romcom-movies": { category: "romcom", mediaType: "movie" },

  // Studio categories
  "a24-films": { category: "studio_a24", mediaType: "movie" },
  "disney-magic": { category: "studio_disney", mediaType: "movie" },
  "pixar-animation": { category: "studio_pixar", mediaType: "movie" },
  "warner-bros": { category: "studio_warner_bros", mediaType: "movie" },
  "universal-films": { category: "studio_universal", mediaType: "movie" },
  "dreamworks-films": { category: "studio_dreamworks", mediaType: "movie" },

  // Director categories
  "nolan-films": { category: "director_nolan", mediaType: "movie" },
  "tarantino-films": { category: "director_tarantino", mediaType: "movie" },
  "spielberg-films": { category: "director_spielberg", mediaType: "movie" },
  "scorsese-films": { category: "director_scorsese", mediaType: "movie" },
  "fincher-films": { category: "director_fincher", mediaType: "movie" },

  // Curated picks
  "hidden-gems": { category: "hidden_gems", mediaType: "movie" },
  "critically-acclaimed": {
    category: "critically_acclaimed",
    mediaType: "movie",
  },

  // Time-based categories
  "eighties-movies": { category: "eighties", mediaType: "movie" },
  "nineties-movies": { category: "nineties", mediaType: "movie" },
  "early-2000s-movies": { category: "early_2000s", mediaType: "movie" },
  "recent-releases": { category: "recent", mediaType: "movie" },

  // TV-specific categories
  "popular-tvshows": { category: "popular", mediaType: "tv" },
  "top-rated-tvshows": { category: "top_rated", mediaType: "tv" },
  "binge-worthy-series": { category: "binge_worthy", mediaType: "tv" },
  "limited-series": { category: "limited_series", mediaType: "tv" },
  "reality-tv": { category: "reality", mediaType: "tv" },
  docuseries: { category: "docuseries", mediaType: "tv" },

  // New TV show categories
  "tv-on-the-air": { category: "on_the_air", mediaType: "tv" },
  "tv-comedy": { category: "tv_comedy", mediaType: "tv" },
  "tv-drama": { category: "tv_drama", mediaType: "tv" },
  "tv-crime": { category: "tv_crime", mediaType: "tv" },
  "tv-scifi-fantasy": { category: "tv_scifi_fantasy", mediaType: "tv" },
  "tv-animation": { category: "tv_animation", mediaType: "tv" },
  "tv-kids": { category: "tv_kids", mediaType: "tv" },

  // TV Network categories
  "hbo-originals": { category: "tv_network_hbo", mediaType: "tv" },
  "netflix-originals": { category: "tv_network_netflix", mediaType: "tv" },
  "disney-channel": { category: "tv_network_disney_channel", mediaType: "tv" },
  "cartoon-network": {
    category: "tv_network_cartoon_network",
    mediaType: "tv",
  },
  nickelodeon: { category: "tv_network_nickelodeon", mediaType: "tv" },
  "fx-originals": { category: "tv_network_fx", mediaType: "tv" },
  "amc-shows": { category: "tv_network_amc", mediaType: "tv" },
  "bbc-productions": { category: "tv_network_bbc", mediaType: "tv" },

  // TV Special categories
  "90s-cartoons": { category: "tv_90s_cartoons", mediaType: "tv" },
  "tv-anime": { category: "tv_anime", mediaType: "tv" },
  "tv-british-comedy": { category: "tv_british_comedy", mediaType: "tv" },
  "tv-true-crime": { category: "tv_true_crime", mediaType: "tv" },
  "tv-sitcoms": { category: "tv_sitcoms", mediaType: "tv" },
  "tv-limited-series": { category: "tv_limited_series", mediaType: "tv" },
  "tv-medical-dramas": { category: "tv_medical_dramas", mediaType: "tv" },
  "tv-superhero": { category: "tv_superhero", mediaType: "tv" },
  "tv-cooking-shows": { category: "tv_cooking_shows", mediaType: "tv" },

  // TV Time period categories
  "tv-90s": { category: "tv_90s", mediaType: "tv" },
  "tv-2000s": { category: "tv_2000s", mediaType: "tv" },
  "tv-2010s": { category: "tv_2010s", mediaType: "tv" },

  // Additional TV categories from original page
  kdrama: { category: "tv_kdrama", mediaType: "tv" },
  miniseries: { category: "tv_limited_series", mediaType: "tv" },
  "mind-bending-scifi": { category: "tv_mind_bending_scifi", mediaType: "tv" },
  "teen-supernatural": { category: "tv_teen_supernatural", mediaType: "tv" },
  "cooking-food": { category: "tv_cooking_shows", mediaType: "tv" },
  disneyxd: { category: "tv_network_disney_xd", mediaType: "tv" },
  "period-dramas": { category: "tv_period_dramas", mediaType: "tv" },
  "network-hits": { category: "tv_network_hits", mediaType: "tv" },
  "romantic-crime": { category: "tv_romantic_crime", mediaType: "tv" },
  family: { category: "tv_family", mediaType: "tv" },
  "kdrama-romance": { category: "tv_kdrama_romance", mediaType: "tv" },
  "workplace-comedies": { category: "tv_workplace_comedies", mediaType: "tv" },
  "2010s-mystery": { category: "tv_mystery", mediaType: "tv" },
};

// Global cache to track seen media IDs across different row types
// Use a Map to store when an ID was first seen and in which row
type MediaCache = {
  seenIds: Map<number, string>; // Maps media ID to the rowId that first used it
  resetAfter: number; // Timestamp to reset cache after
};

// Global cache with 1-hour expiration
const GLOBAL_MEDIA_CACHE: MediaCache = {
  seenIds: new Map<number, string>(),
  resetAfter: Date.now() + 3600000, // 1 hour from now
};

// Reset cache if it's older than the expiration time
function resetCacheIfNeeded() {
  if (Date.now() > GLOBAL_MEDIA_CACHE.resetAfter) {
    GLOBAL_MEDIA_CACHE.seenIds.clear();
    GLOBAL_MEDIA_CACHE.resetAfter = Date.now() + 3600000;
  }
}

// Rows that should allow international content
const internationalRows = [
  "kdrama",
  "kdrama-romance",
  "tv-anime",
  "tv-british-comedy",
];

/**
 * Fetches content for a specific row with at least minCount unique items
 */
async function fetchStandardizedRow(
  rowId: string,
  minCount: number = 20,
  respectGlobalCache: boolean = true,
): Promise<MediaItem[]> {
  // Reset cache if needed
  resetCacheIfNeeded();

  // Check if row ID is valid
  if (!ROW_CONFIG[rowId]) {
    console.error(`Invalid row ID: ${rowId}`);
    return [];
  }

  // Disable global cache for specific categories that should always appear
  // like popular and top-rated movies/shows regardless of duplication
  const priorityRows = [
    "popular-movies",
    "top-rated-movies",
    "popular-tvshows",
    "top-rated-tvshows",
  ];
  const shouldRespectGlobalCache =
    respectGlobalCache && !priorityRows.includes(rowId);

  const { category, mediaType } = ROW_CONFIG[rowId];
  const rowSeenIds = new Set<number>(); // Local cache for this specific row
  let items: MediaItem[] = [];
  let page = 1;

  // Common filter function for all media types
  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  // Additional filter for US TV content
  const isUsTvContent = (item: MediaItem): boolean => {
    // For international rows, allow their specific origin countries
    if (internationalRows.includes(rowId)) {
      if (rowId === "kdrama" || rowId === "kdrama-romance") {
        return item.origin_country?.includes("KR") || false;
      }
      if (rowId === "tv-anime") {
        return item.origin_country?.includes("JP") || false;
      }
      if (rowId === "tv-british-comedy") {
        return item.origin_country?.includes("GB") || false;
      }
    }

    // For other rows, keep the original logic
    return (
      mediaType !== "tv" ||
      item.origin_country?.includes("US") ||
      item.original_language === "en"
    );
  };

  // Function to filter and deduplicate items
  const filterAndDeduplicate = (item: MediaItem): boolean => {
    // Skip items without posters or non-US TV content
    if (!hasValidPoster(item) || !isUsTvContent(item)) return false;

    // Skip items already used in this row
    if (rowSeenIds.has(item.id)) return false;

    // Check global cache if requested
    if (shouldRespectGlobalCache) {
      const existingRowId = GLOBAL_MEDIA_CACHE.seenIds.get(item.id);
      // Skip if this item has been seen in another row
      if (existingRowId && existingRowId !== rowId) {
        return false;
      }
    }

    // Mark as seen both locally and globally
    rowSeenIds.add(item.id);

    // Only update global cache for non-priority rows
    if (shouldRespectGlobalCache) {
      GLOBAL_MEDIA_CACHE.seenIds.set(item.id, rowId);
    }

    return true;
  };

  // Keep fetching pages until we have at least minCount items or no more results
  while (items.length < minCount && page <= 5) {
    // Limit to 5 pages (100 items max) to prevent infinite loops
    const newItems = await fetchPaginatedCategory(category, mediaType, page);
    if (!newItems || newItems.length === 0) break;

    // Process the new batch of items
    const processedItems = await buildMaybeItemsWithCategories<MediaItem>(
      newItems,
      mediaType,
    );
    const filteredItems = processedItems.filter(filterAndDeduplicate);
    items = [...items, ...filteredItems];

    page++;
  }

  // For popular and top-rated, if we still don't have enough items, keep adding more
  // without global cache restrictions to ensure these rows are always well-populated
  if (priorityRows.includes(rowId) && items.length < minCount) {
    // Reset page counter and try again with no global cache restrictions
    page = 1;
    while (items.length < minCount && page <= 3) {
      const newItems = await fetchPaginatedCategory(category, mediaType, page);
      if (!newItems || newItems.length === 0) break;

      const processedItems = await buildMaybeItemsWithCategories<MediaItem>(
        newItems,
        mediaType,
      );

      // Only filter by valid poster and local deduplication, no global cache check
      const filteredItems = processedItems.filter((item) => {
        if (!hasValidPoster(item) || !isUsTvContent(item)) return false;
        if (rowSeenIds.has(item.id)) return false;
        rowSeenIds.add(item.id);
        return true;
      });

      items = [...items, ...filteredItems];
      page++;
    }
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
  const globalCacheRaw = searchParams.get("globalCache");

  // Default to 20 items if not specified
  const minCount = countRaw ? parseInt(countRaw, 10) : 20;
  const shouldEnrich = enrichRaw === "true";
  const respectGlobalCache = globalCacheRaw !== "false"; // Default to true

  // Validate row ID
  if (!rowId || !ROW_CONFIG[rowId]) {
    return NextResponse.json(
      { error: "Invalid row ID provided" },
      { status: 400 },
    );
  }

  try {
    // Fetch standardized row content
    const items = await fetchStandardizedRow(
      rowId,
      minCount,
      respectGlobalCache,
    );

    // Optionally enrich items with additional details (videos, logos, etc.)
    const response = shouldEnrich
      ? await fetchAndEnrichMediaItems(items, ROW_CONFIG[rowId].mediaType)
      : items;

    return NextResponse.json(response);
  } catch (error) {
    console.error(`Error fetching row ${rowId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch content row" },
      { status: 500 },
    );
  }
}
