import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { NextResponse } from "next/server";

/**
 * Use centralized content row configuration
 */

// Legacy compatibility - this will be removed once all clients use the centralized system
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
  "villeneuve-films": { category: "director-villeneuve", mediaType: "movie" },
  "wright-films": { category: "director-wright", mediaType: "movie" },
  "wes-anderson-films": {
    category: "director-wes-anderson",
    mediaType: "movie",
  },
  "coen-films": { category: "director-coen", mediaType: "movie" },
  "ridley-scott-films": {
    category: "director-ridley-scott",
    mediaType: "movie",
  },
  "cameron-films": { category: "director-cameron", mediaType: "movie" },
  "kubrick-films": { category: "director-kubrick", mediaType: "movie" },
  "hitchcock-films": { category: "director-hitchcock", mediaType: "movie" },
  "pta-films": { category: "director-pta", mediaType: "movie" },

  // Curated picks
  "hidden-gems": { category: "hidden-gems", mediaType: "movie" },
  "critically-acclaimed": {
    category: "critically-acclaimed",
    mediaType: "movie",
  },
  "blockbuster-hits": { category: "blockbuster-hits", mediaType: "movie" },
  "award-winners": { category: "award-winners", mediaType: "movie" },
  "cult-classics": { category: "cult-classics", mediaType: "movie" },
  "indie-films": { category: "indie-films", mediaType: "movie" },

  // Collection/Franchise categories
  "marvel-mcu": { category: "marvel-mcu", mediaType: "movie" },
  "star-wars": { category: "star-wars", mediaType: "movie" },
  "fast-furious": { category: "fast-furious", mediaType: "movie" },
  "harry-potter": { category: "harry-potter", mediaType: "movie" },
  "lord-of-rings": { category: "lord-of-rings", mediaType: "movie" },
  "mission-impossible": { category: "mission-impossible", mediaType: "movie" },
  "james-bond": { category: "james-bond", mediaType: "movie" },
  "batman-dark-knight": { category: "batman-dark-knight", mediaType: "movie" },
  "jurassic-park": { category: "jurassic-park", mediaType: "movie" },
  transformers: { category: "transformers", mediaType: "movie" },

  // Time-based categories
  "eighties-movies": { category: "year-80s", mediaType: "movie" },
  "nineties-movies": { category: "year-90s", mediaType: "movie" },
  "early-2000s-movies": { category: "year-2000s", mediaType: "movie" },
  "recent-releases": { category: "recent-releases", mediaType: "movie" },

  // TV-specific categories
  "popular-tvshows": { category: "tv-popular", mediaType: "tv" },
  "top-rated-tvshows": { category: "tv-top-rated", mediaType: "tv" },
  "tv-diverse": { category: "tv-diverse", mediaType: "tv" },
  "binge-worthy-series": { category: "tv-diverse", mediaType: "tv" },
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
  "tv-animated-adventures": {
    category: "tv-animated-adventures",
    mediaType: "tv",
  },

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
  family: { category: "tv-family", mediaType: "tv" },
  "kdrama-romance": { category: "tv-kdrama-romance", mediaType: "tv" },
  "workplace-comedies": { category: "tv-workplace-comedies", mediaType: "tv" },
  "2010s-mystery": { category: "tv-mystery", mediaType: "tv" },
  "tv-game-shows": { category: "tv-game-shows", mediaType: "tv" },
};

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
): Promise<MediaItem[]> {
  if (!ROW_CONFIG[rowId]) {
    console.error(`[ContentRows] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = ROW_CONFIG[rowId];
  // We use a local cache just for this specific row
  const rowSeenIds = new Set<number>();
  let items: MediaItem[] = [];
  let page = 1;

  // Common filter function for all media types
  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

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

  const filterAndDeduplicate = (item: MediaItem): boolean => {
    if (!hasValidPoster(item) || !isUsTvContent(item)) return false;

    if (rowSeenIds.has(item.id)) return false;

    rowSeenIds.add(item.id);

    return true;
  };

  // I think it's wise to keep fetching pages until we have at least
  // minCount items, but also to limit to 10 pages to prevent infinite loops.
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

  // For now, I like defaulting to 20 items
  const minCount = countRaw ? parseInt(countRaw, 10) : 20;
  const shouldEnrich = enrichRaw === "true";

  if (!rowId || !ROW_CONFIG[rowId]) {
    return NextResponse.json(
      { error: "Invalid row ID provided" },
      { status: 400 },
    );
  }

  try {
    const items = await fetchStandardizedRow(rowId, minCount);

    // Optionally enrich items with additional details (videos, logos, etc.)
    const response = shouldEnrich
      ? await fetchAndEnrichMediaItems(items, ROW_CONFIG[rowId].mediaType)
      : items;

    // Cache headers <3
    return NextResponse.json(response, {
      // headers: {
      //   "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      //   "CDN-Cache-Control": "public, s-maxage=300",
      //   "Vercel-CDN-Cache-Control": "public, s-maxage=300",
      // },
    });
  } catch (error) {
    console.error(`Error fetching row ${rowId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch content row" },
      { status: 500 },
    );
  }
}
