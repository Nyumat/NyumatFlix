import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "../actions";

export const metadata: Metadata = {
  title: "TV Shows | NyumatFlix",
  description: "Discover your next binge-worthy series on NyumatFlix.",
  openGraph: {
    title: "TV Shows | NyumatFlix",
    description: "Discover your next binge-worthy series on NyumatFlix.",
    type: "website",
    siteName: "NyumatFlix",
  },
  twitter: {
    title: "TV Shows | NyumatFlix",
    description: "Discover your next binge-worthy series on NyumatFlix.",
  },
};

// Opt-out of static generation – dynamic data is fetched.
export const dynamic = "force-dynamic";

// Row configuration mapping - same as content-rows API for TV shows
const ROW_CONFIG: Record<
  string,
  { category: string; mediaType: "movie" | "tv" }
> = {
  // TV-specific categories
  "top-rated-tvshows": { category: "tv-top-rated", mediaType: "tv" },
  "popular-tvshows": { category: "tv-popular", mediaType: "tv" },
  "tv-diverse": { category: "tv-diverse", mediaType: "tv" },
  "binge-worthy-series": { category: "tv-popular", mediaType: "tv" },
  "limited-series": { category: "tv-limited-series", mediaType: "tv" },
  "reality-tv": { category: "tv-reality", mediaType: "tv" },
  docuseries: { category: "tv-docuseries", mediaType: "tv" },
  miniseries: { category: "tv-limited-series", mediaType: "tv" },

  // TV Network categories
  "cartoon-network": {
    category: "tv-network-cartoon-network",
    mediaType: "tv",
  },
  nickelodeon: { category: "tv-network-nickelodeon", mediaType: "tv" },
  "disney-channel": { category: "tv-network-disney-channel", mediaType: "tv" },
  disneyxd: { category: "tv-network-disney-xd", mediaType: "tv" },

  // TV Genre categories
  "tv-comedy": { category: "tv-genre-comedy", mediaType: "tv" },
  "tv-drama": { category: "tv-genre-drama", mediaType: "tv" },
  "tv-crime": { category: "tv-genre-crime", mediaType: "tv" },
  "tv-scifi-fantasy": { category: "tv-genre-scifi-fantasy", mediaType: "tv" },
  "tv-animation": { category: "tv-genre-animation", mediaType: "tv" },
  "tv-kids": { category: "tv-genre-kids", mediaType: "tv" },

  // TV Special categories
  "90s-cartoons": { category: "tv-90s-cartoons", mediaType: "tv" },
  "tv-anime": { category: "tv-anime", mediaType: "tv" },
  "tv-british-comedy": { category: "tv-british-comedy", mediaType: "tv" },
  "tv-sitcoms": { category: "tv-sitcoms", mediaType: "tv" },
  "mind-bending-scifi": { category: "tv-mind-bending-scifi", mediaType: "tv" },
  "teen-supernatural": { category: "tv-teen-supernatural", mediaType: "tv" },
  "cooking-food": { category: "tv-cooking-shows", mediaType: "tv" },
  "network-hits": { category: "tv-network-hits", mediaType: "tv" },
  family: { category: "tv-family", mediaType: "tv" },
  kdrama: { category: "tv-kdrama", mediaType: "tv" },
  "kdrama-romance": { category: "tv-kdrama-romance", mediaType: "tv" },
  "2010s-mystery": { category: "tv-mystery", mediaType: "tv" },
};

// Rows that should allow international content
const internationalRows = [
  "kdrama",
  "kdrama-romance",
  "tv-anime",
  "tv-british-comedy",
];

// Server-side content row fetching function for TV shows
async function fetchContentRowData(
  rowId: string,
  minCount: number,
  globalSeenIds: Set<number>,
): Promise<MediaItem[]> {
  if (!ROW_CONFIG[rowId]) {
    console.error(`[TVShows] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = ROW_CONFIG[rowId];
  let items: MediaItem[] = [];
  let page = 1;

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
    if (globalSeenIds.has(item.id)) return false;
    globalSeenIds.add(item.id);
    return true;
  };

  // Fetch enough pages to get minCount unique items
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

export default async function TVShowsPage() {
  const trendingTVResponse = await fetchTMDBData("/discover/tv", {
    sort_by: "popularity.desc",
    "vote_average.gte": "7.0",
    "release_date.gte": "2023-01-01",
    "release_date.lte": "2025-07-12",
    "vote_count.gte": "1500",
    include_adult: "false",
    language: "en-US",
    region: "US",
  });
  // Only take a few items for the hero carousel to keep build time low
  const basicTrendingItems = trendingTVResponse.results?.slice(0, 5) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "tv",
  );

  // Global tracking of seen IDs across ALL content rows
  // Start with hero carousel items to ensure they don't appear in content rows
  const globalSeenIds = new Set<number>();
  enrichedTrendingItems.forEach((item) => globalSeenIds.add(item.id));

  // Define content rows configuration
  const contentRowsConfig = [
    {
      rowId: "tv-diverse",
      title: "Popular TV Shows",
      href: "/tvshows/browse?filter=tv-diverse",
    },
    {
      rowId: "top-rated-tvshows",
      title: "Top Rated TV Shows",
      href: "/tvshows/browse?filter=tv-top-rated",
      variant: "ranked" as const,
    },
    {
      rowId: "reality-tv",
      title: "Reality TV Hits",
      href: "/tvshows/browse?filter=tv-reality",
      enrich: true,
    },
    {
      rowId: "cartoon-network",
      title: "Cartoon Network",
      href: "/tvshows/browse?filter=tv-network-cartoon-network",
    },
    {
      rowId: "tv-crime",
      title: "Crime & Mystery",
      href: "/tvshows/browse?filter=tv-genre-crime",
    },
    {
      rowId: "miniseries",
      title: "Critically Acclaimed Miniseries",
      href: "/tvshows/browse?filter=tv-limited-series",
    },
    {
      rowId: "tv-comedy",
      title: "Comedies",
      href: "/tvshows/browse?filter=tv-genre-comedy",
    },
    {
      rowId: "mind-bending-scifi",
      title: "Mind-Bending Sci-Fi",
      href: "/tvshows/browse?filter=tv-mind-bending-scifi",
      enrich: true,
    },
    {
      rowId: "nickelodeon",
      title: "Nickelodeon",
      href: "/tvshows/browse?filter=tv-network-nickelodeon",
    },
    {
      rowId: "tv-drama",
      title: "Critically Acclaimed Dramas",
      href: "/tvshows/browse?filter=tv-genre-drama",
    },
    {
      rowId: "teen-supernatural",
      title: "Teen Supernatural Dramas",
      href: "/tvshows/browse?filter=tv-teen-supernatural",
    },
    {
      rowId: "cooking-food",
      title: "Cooking & Food Shows",
      href: "/tvshows/browse?filter=tv-cooking-shows",
    },
    {
      rowId: "disneyxd",
      title: "Disney XD",
      href: "/tvshows/browse?filter=tv-network-disney-xd",
    },
    {
      rowId: "tv-scifi-fantasy",
      title: "Sci-Fi & Fantasy Adventures",
      href: "/tvshows/browse?filter=tv-genre-scifi-fantasy",
    },
    {
      rowId: "tv-animation",
      title: "Animated Shows",
      href: "/tvshows/browse?filter=tv-genre-animation",
    },
    {
      rowId: "network-hits",
      title: "Network TV Hits",
      href: "/tvshows/browse?filter=tv-network-hits",
    },
    {
      rowId: "tv-sitcoms",
      title: "Classic Sitcoms",
      href: "/tvshows/browse?filter=tv-sitcoms",
    },
    {
      rowId: "disney-channel",
      title: "Disney Channel",
      href: "/tvshows/browse?filter=tv-network-disney-channel",
    },
    {
      rowId: "family",
      title: "Family Favorites",
      href: "/tvshows/browse?filter=tv-family",
    },
    {
      rowId: "kdrama",
      title: "Popular K-Dramas",
      href: "/tvshows/browse?filter=tv-kdrama",
    },
    {
      rowId: "2010s-mystery",
      title: "Mystery Shows",
      href: "/tvshows/browse?filter=tv-mystery",
    },
    {
      rowId: "tv-kids",
      title: "Kids Shows",
      href: "/tvshows/browse?filter=tv-genre-kids",
    },
    {
      rowId: "90s-cartoons",
      title: "90s Cartoons",
      href: "/tvshows/browse?filter=tv-90s-cartoons",
    },
  ];

  // Fetch all content row data server-side with global uniqueness
  const contentRowsData = await Promise.all(
    contentRowsConfig.map(async (config) => {
      const items = await fetchContentRowData(config.rowId, 20, globalSeenIds);
      return {
        ...config,
        items,
      };
    }),
  );

  return (
    <>
      <main>
        {/* Hero carousel for trending TV shows - remains fully visible */}
        <MediaCarousel items={enrichedTrendingItems} />
      </main>

      {/* Content rows section with background */}
      <div className="relative">
        {/* Fix: Position background to only cover content area, not hero */}
        <div className="absolute inset-0 w-full h-full z-0">
          <div
            className="w-full h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.jpg')",
              filter: "blur(8px)",
              opacity: 0.3,
            }}
          />
        </div>
        {/* Content with sufficient min-height to prevent shifts */}
        <div className="relative z-10 min-h-[200vh]">
          <ContentContainer>
            {contentRowsData.map((rowData) => (
              <SuspenseContentRow
                key={rowData.rowId}
                rowId={rowData.rowId}
                title={rowData.title}
                href={rowData.href}
                variant={rowData.variant}
                enrich={rowData.enrich}
                preloadedItems={rowData.items}
              />
            ))}
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
