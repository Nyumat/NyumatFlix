import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";

/**
 * Row configuration mapping - matches the API route
 */
const ROW_CONFIG: Record<
  string,
  { category: string; mediaType: "movie" | "tv" }
> = {
  // Standard categories
  "popular-movies": { category: "popular", mediaType: "movie" },
  "top-rated-movies": { category: "top_rated", mediaType: "movie" },
  "upcoming-movies": { category: "upcoming", mediaType: "movie" },
  "recent-releases": { category: "year-2023", mediaType: "movie" },

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

  // Director categories
  "nolan-films": { category: "director-nolan", mediaType: "movie" },
  "tarantino-films": { category: "director-tarantino", mediaType: "movie" },
  "spielberg-films": { category: "director-spielberg", mediaType: "movie" },
  "scorsese-films": { category: "director-scorsese", mediaType: "movie" },

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

  // TV-specific categories
  "popular-tvshows": { category: "tv-popular", mediaType: "tv" },
  "top-rated-tvshows": { category: "tv-top-rated", mediaType: "tv" },
  "binge-worthy-series": { category: "tv-popular", mediaType: "tv" },
  "limited-series": { category: "tv-limited-series", mediaType: "tv" },
  "reality-tv": { category: "tv-reality", mediaType: "tv" },
  docuseries: { category: "tv-docuseries", mediaType: "tv" },
  "tv-on-the-air": { category: "tv-on-the-air", mediaType: "tv" },
  "tv-comedy": { category: "tv-genre-comedy", mediaType: "tv" },
  "tv-drama": { category: "tv-genre-drama", mediaType: "tv" },
  "tv-crime": { category: "tv-genre-crime", mediaType: "tv" },
  "tv-scifi-fantasy": { category: "tv-genre-scifi-fantasy", mediaType: "tv" },
  "tv-animation": { category: "tv-genre-animation", mediaType: "tv" },
  "tv-kids": { category: "tv-genre-kids", mediaType: "tv" },

  // Additional categories
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
  "2010s-mystery": { category: "tv-mystery", mediaType: "tv" },
  "90s-cartoons": { category: "tv-90s-cartoons", mediaType: "tv" },
  "cartoon-network": {
    category: "tv-network-cartoon-network",
    mediaType: "tv",
  },
  nickelodeon: { category: "tv-network-nickelodeon", mediaType: "tv" },
  "disney-channel": { category: "tv-network-disney-channel", mediaType: "tv" },
};

// Rows that should allow international content
const internationalRows = [
  "kdrama",
  "kdrama-romance",
  "tv-anime",
  "tv-british-comedy",
];

/**
 * Server-side data fetching function - matches API route logic
 */
async function fetchStandardizedRow(
  rowId: string,
  minCount: number = 20,
): Promise<MediaItem[]> {
  if (!ROW_CONFIG[rowId]) {
    console.error(`[ServerContentRow] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = ROW_CONFIG[rowId];
  const rowSeenIds = new Set<number>();
  let items: MediaItem[] = [];
  let page = 1;

  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  const isUsTvContent = (item: MediaItem): boolean => {
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
    const finalItems = enrich
      ? await fetchAndEnrichMediaItems(
          items,
          ROW_CONFIG[rowId]?.mediaType || "movie",
        )
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
