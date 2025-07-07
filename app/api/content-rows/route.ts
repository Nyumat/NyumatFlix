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
  "action-movies": { category: "genre-action", mediaType: "movie" },
  "comedy-movies": { category: "genre-comedy", mediaType: "movie" },
  "drama-movies": { category: "genre-drama", mediaType: "movie" },
  "thriller-movies": { category: "genre-thriller", mediaType: "movie" },
  "scifi-fantasy-movies": {
    category: "genre-scifi-fantasy",
    mediaType: "movie",
  },
  "romcom-movies": { category: "genre-romcom", mediaType: "movie" },

  // Studio categories
  "a24-films": { category: "studio-a24", mediaType: "movie" },
  "disney-magic": { category: "studio-disney", mediaType: "movie" },
  "pixar-animation": { category: "studio-pixar", mediaType: "movie" },
  "warner-bros": { category: "studio-warner-bros", mediaType: "movie" },
  "universal-films": { category: "studio-universal", mediaType: "movie" },
  "dreamworks-films": { category: "studio-dreamworks", mediaType: "movie" },

  // Director categories
  "nolan-films": { category: "director-nolan", mediaType: "movie" },
  "tarantino-films": { category: "director-tarantino", mediaType: "movie" },
  "spielberg-films": { category: "director-spielberg", mediaType: "movie" },
  "scorsese-films": { category: "director-scorsese", mediaType: "movie" },
  "fincher-films": { category: "director-fincher", mediaType: "movie" },

  // Curated picks
  "hidden-gems": { category: "hidden-gems", mediaType: "movie" },
  "critically-acclaimed": {
    category: "critically-acclaimed",
    mediaType: "movie",
  },

  // Time-based categories
  "eighties-movies": { category: "year-80s", mediaType: "movie" },
  "nineties-movies": { category: "year-90s", mediaType: "movie" },
  "early-2000s-movies": { category: "year-2000s", mediaType: "movie" },
  "recent-releases": { category: "year-2023", mediaType: "movie" },

  // TV-specific categories
  "popular-tvshows": { category: "tv-popular", mediaType: "tv" },
  "top-rated-tvshows": { category: "tv-top-rated", mediaType: "tv" },
  "binge-worthy-series": { category: "tv-popular", mediaType: "tv" },
  "limited-series": { category: "tv-limited-series", mediaType: "tv" },
  "reality-tv": { category: "tv-reality", mediaType: "tv" },
  docuseries: { category: "tv-docuseries", mediaType: "tv" },

  // New TV show categories
  "tv-on-the-air": { category: "tv-on-the-air", mediaType: "tv" },
  "tv-comedy": { category: "tv-genre-comedy", mediaType: "tv" },
  "tv-drama": { category: "tv-genre-drama", mediaType: "tv" },
  "tv-crime": { category: "tv-genre-crime", mediaType: "tv" },
  "tv-scifi-fantasy": { category: "tv-genre-scifi-fantasy", mediaType: "tv" },
  "tv-animation": { category: "tv-genre-animation", mediaType: "tv" },
  "tv-kids": { category: "tv-genre-kids", mediaType: "tv" },

  // TV Network categories
  "hbo-originals": { category: "tv-network-hbo", mediaType: "tv" },
  "netflix-originals": { category: "tv-network-netflix", mediaType: "tv" },
  "disney-channel": { category: "tv-network-disney-channel", mediaType: "tv" },
  "cartoon-network": {
    category: "tv-network-cartoon-network",
    mediaType: "tv",
  },
  nickelodeon: { category: "tv-network-nickelodeon", mediaType: "tv" },
  "fx-originals": { category: "tv-network-fx", mediaType: "tv" },
  "amc-shows": { category: "tv-network-amc", mediaType: "tv" },
  "bbc-productions": { category: "tv-network-bbc", mediaType: "tv" },

  // TV Special categories
  "90s-cartoons": { category: "tv-90s-cartoons", mediaType: "tv" },
  "tv-anime": { category: "tv-anime", mediaType: "tv" },
  "tv-british-comedy": { category: "tv-british-comedy", mediaType: "tv" },
  "tv-true-crime": { category: "tv-true-crime", mediaType: "tv" },
  "tv-sitcoms": { category: "tv-sitcoms", mediaType: "tv" },
  "tv-limited-series": { category: "tv-limited-series", mediaType: "tv" },
  "tv-medical-dramas": { category: "tv-medical-dramas", mediaType: "tv" },
  "tv-superhero": { category: "tv-superhero", mediaType: "tv" },
  "tv-cooking-shows": { category: "tv-cooking-shows", mediaType: "tv" },

  // TV Time period categories
  "tv-90s": { category: "tv-year-90s", mediaType: "tv" },
  "tv-2000s": { category: "tv-year-2000s", mediaType: "tv" },
  "tv-2010s": { category: "tv-year-2010s", mediaType: "tv" },

  // Additional TV categories from original page
  kdrama: { category: "tv-kdrama", mediaType: "tv" },
  miniseries: { category: "tv-limited-series", mediaType: "tv" },
  "mind-bending-scifi": { category: "tv-mind-bending-scifi", mediaType: "tv" },
  "teen-supernatural": { category: "tv-teen-supernatural", mediaType: "tv" },
  "cooking-food": { category: "tv-cooking-shows", mediaType: "tv" },
  disneyxd: { category: "tv-network-disney-xd", mediaType: "tv" },
  "period-dramas": { category: "tv-period-dramas", mediaType: "tv" },
  "network-hits": { category: "tv-network-hits", mediaType: "tv" },
  "romantic-crime": { category: "tv-romantic-crime", mediaType: "tv" },
  family: { category: "tv-family", mediaType: "tv" },
  "kdrama-romance": { category: "tv-kdrama-romance", mediaType: "tv" },
  "workplace-comedies": { category: "tv-workplace-comedies", mediaType: "tv" },
  "2010s-mystery": { category: "tv-mystery", mediaType: "tv" },
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
  resetAfter: Date.now() + 86400000, // 24 hours from now (increased from 1 hour)
};

// Reset cache if it's older than the expiration time
function resetCacheIfNeeded() {
  if (Date.now() > GLOBAL_MEDIA_CACHE.resetAfter) {
    console.log("[ContentRows] Resetting global media cache");
    GLOBAL_MEDIA_CACHE.seenIds.clear();
    GLOBAL_MEDIA_CACHE.resetAfter = Date.now() + 86400000; // 24 hours
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
    console.error(`[ContentRows] Invalid row ID: ${rowId}`);
    return [];
  }

  console.log(
    `[ContentRows] Fetching row: ${rowId}, respectGlobalCache: ${respectGlobalCache}`,
  );

  // Define row groups that can share content between them but avoid duplicates across groups
  const rowGroups = {
    // Core movie categories - can share between popular and top-rated
    popularMovies: ["popular-movies", "top-rated-movies"],

    // Core TV categories - can share between popular and top-rated
    popularTV: ["popular-tvshows", "top-rated-tvshows", "binge-worthy-series"],

    // Genre-based movie groups
    actionMovies: ["action-movies"],
    comedyMovies: ["comedy-movies"],
    dramaMovies: ["drama-movies"],
    scifiMovies: ["scifi-fantasy-movies"],
    thrillerMovies: ["thriller-movies"],
    romanceMovies: ["romcom-movies"],

    // Genre-based TV groups
    comedyTV: ["tv-comedy"],
    dramaTV: ["tv-drama", "period-dramas"],
    scifiTV: ["tv-scifi-fantasy", "mind-bending-scifi"],
    crimeTV: ["tv-crime", "romantic-crime"],
    realityTV: ["tv-reality"],
    animationTV: ["tv-animation", "90s-cartoons"],
    kidsTV: [
      "tv-kids",
      "cartoon-network",
      "nickelodeon",
      "disney-channel",
      "disneyxd",
    ],

    // Studio/Director groups
    directorFilms: [
      "nolan-films",
      "tarantino-films",
      "spielberg-films",
      "scorsese-films",
      "fincher-films",
    ],
    studioFilms: [
      "a24-films",
      "disney-magic",
      "pixar-animation",
      "warner-bros",
      "universal-films",
      "dreamworks-films",
    ],

    // International/Cultural content
    international: [
      "kdrama",
      "kdrama-romance",
      "tv-anime",
      "tv-british-comedy",
    ],

    // Specialized categories
    timeBasedMovies: [
      "eighties-movies",
      "nineties-movies",
      "early-2000s-movies",
      "recent-releases",
    ],
    timeBasedTV: ["tv-90s", "tv-2000s", "tv-2010s"],
    curatedMovies: ["critically-acclaimed", "hidden-gems", "upcoming-movies"],
    curatedTV: [
      "tv-on-the-air",
      "miniseries",
      "limited-series",
      "network-hits",
      "tv-sitcoms",
    ],
    familyContent: ["family", "workplace-comedies"],
    mysteryContent: ["2010s-mystery", "teen-supernatural"],
    cookingContent: ["cooking-food"],
  };

  // Find which group this row belongs to
  const currentRowGroup = Object.keys(rowGroups).find((group) =>
    rowGroups[group].includes(rowId),
  );

  // Should respect global cache unless explicitly disabled
  // But allow some flexibility for popular/top-rated content
  const shouldRespectGlobalCache = respectGlobalCache;

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
      if (existingRowId && existingRowId !== rowId) {
        // Find which group the existing row belongs to
        const existingRowGroup = Object.keys(rowGroups).find((group) =>
          rowGroups[group].includes(existingRowId),
        );

        // If current row and existing row are in different groups, skip to avoid duplicates
        // But allow duplicates within the same group (e.g., popular and top-rated can share)
        if (
          currentRowGroup &&
          existingRowGroup &&
          currentRowGroup !== existingRowGroup
        ) {
          return false;
        }

        // If no group classification, apply stricter deduplication
        if (!currentRowGroup || !existingRowGroup) {
          return false;
        }
      }
    }

    // Mark as seen both locally and globally
    rowSeenIds.add(item.id);

    // Update global cache to track this item
    if (shouldRespectGlobalCache) {
      GLOBAL_MEDIA_CACHE.seenIds.set(item.id, rowId);
    }

    return true;
  };

  // Keep fetching pages until we have at least minCount items or no more results
  while (items.length < minCount && page <= 5) {
    // Limit to 5 pages (100 items max) to prevent infinite loops
    const newItems = await fetchPaginatedCategory(category, mediaType, page);

    console.log(
      `[ContentRows] Row ${rowId}, page ${page}: fetched ${newItems?.length || 0} items`,
    );

    if (!newItems || newItems.length === 0) break;

    // Process the new batch of items
    const processedItems = await buildMaybeItemsWithCategories<MediaItem>(
      newItems,
      mediaType,
    );
    const filteredItems = processedItems.filter(filterAndDeduplicate);

    console.log(
      `[ContentRows] Row ${rowId}, page ${page}: ${filteredItems.length} items after filtering`,
    );

    items = [...items, ...filteredItems];

    page++;
  }

  // For popular and top-rated content, if we still don't have enough items, keep adding more
  // without global cache restrictions to ensure these rows are always well-populated
  const isPriorityContent =
    currentRowGroup === "popularMovies" || currentRowGroup === "popularTV";
  if (isPriorityContent && items.length < minCount) {
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

  console.log(
    `[ContentRows] Row ${rowId} final count: ${items.slice(0, minCount).length} items`,
  );

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
