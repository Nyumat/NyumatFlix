import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { MediaItem } from "@/utils/typings";
import {
  buildMaybeItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchPaginatedCategory,
  fetchTMDBData,
} from "../actions";

// Opt-out of static generation – this page fetches dynamic data and is heavy at build time.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home | NyumatFlix",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com",
    title: "Home | NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: [
      {
        url: "https://nyumatflix.com/nyumatflix-alt.webp",
        width: 1200,
        height: 630,
        alt: "Home | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Home |NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: ["https://nyumatflix.com/nyumatflix-alt.webp"],
  },
};

// Row configuration mapping - same as content-rows API
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
  "nolan-films": { category: "director-nolan", mediaType: "movie" },

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
  "binge-worthy-series": { category: "tv-diverse", mediaType: "tv" },
  "limited-series": { category: "tv-limited-series", mediaType: "tv" },
  "reality-tv": { category: "tv-reality", mediaType: "tv" },
  docuseries: { category: "tv-docuseries", mediaType: "tv" },
};

// Server-side content row fetching function
async function fetchContentRowData(
  rowId: string,
  minCount: number,
  globalSeenIds: Set<number>,
): Promise<MediaItem[]> {
  if (!ROW_CONFIG[rowId]) {
    console.error(`[Home] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = ROW_CONFIG[rowId];
  let items: MediaItem[] = [];
  let page = 1;

  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  const isUsTvContent = (item: MediaItem): boolean => {
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

export default async function Home() {
  // Fetch both movies and TV shows for the hero carousel
  const [fanFavoriteMoviesResponse, fanFavoriteTVShowsResponse] =
    await Promise.all([
      fetchTMDBData("/discover/movie", {
        with_genres: "16|10751|12|878|35|28|10765", // Animation, Family, Adventure, Sci-Fi, Comedy, Action, Sci-Fi & Fantasy
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "release_date.gte": "2023-01-01",
        "release_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
        region: "US",
      }),
      fetchTMDBData("/discover/tv", {
        with_genres: "16|10751|12|878|35|28|10765", // Animation, Family, Adventure, Sci-Fi, Comedy, Action, Sci-Fi & Fantasy
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "first_air_date.gte": "2023-01-01",
        "first_air_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
      }),
    ]);

  const fanFavoriteMovies = fanFavoriteMoviesResponse?.results ?? [];
  const fanFavoriteTVShows = fanFavoriteTVShowsResponse?.results ?? [];

  // Add media_type to each item before combining
  const moviesWithType = fanFavoriteMovies.map((item: MediaItem) => ({
    ...item,
    media_type: "movie" as const,
  }));

  const tvShowsWithType = fanFavoriteTVShows.map((item: MediaItem) => ({
    ...item,
    media_type: "tv" as const,
  }));

  // Combine movies and TV shows
  const combinedFanFavorites = [...moviesWithType, ...tvShowsWithType];

  // Exit if no fan favorite content is available for the hero
  if (combinedFanFavorites.length === 0) {
    return null;
  }

  // Process hero content (both movies and TV shows)
  const seenIds = new Set<number>();
  const filteredFanFavoriteContent = combinedFanFavorites
    .filter((item: MediaItem) => {
      if (!item.poster_path) return false; // Ensure content has a poster
      if (seenIds.has(item.id)) return false; // Avoid duplicates
      if (item.title === "28 Days Later" || item.name === "28 Days Later")
        return false;
      if (item.id === 986056) return false;
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) => b.vote_average - a.vote_average) // Sort by rating for better quality
    .slice(1, 10); // Take the top 10 for enrichment

  // Separate movies and TV shows for enrichment
  const moviesToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "movie",
  );
  const tvShowsToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "tv",
  );

  // Enrich movies and TV shows separately with proper media type
  const [enrichedMovies, enrichedTVShows] = await Promise.all([
    moviesToEnrich.length > 0
      ? fetchAndEnrichMediaItems(moviesToEnrich, "movie")
      : Promise.resolve([]),
    tvShowsToEnrich.length > 0
      ? fetchAndEnrichMediaItems(tvShowsToEnrich, "tv")
      : Promise.resolve([]),
  ]);

  // Combine enriched items and sort by vote average again
  const fanFavoriteContentProcessedForHero = [
    ...enrichedMovies,
    ...enrichedTVShows,
  ].sort((a, b) => b.vote_average - a.vote_average);

  // Global tracking of seen IDs across ALL content rows
  // Start with hero carousel items to ensure they don't appear in content rows
  const globalSeenIds = new Set<number>();
  fanFavoriteContentProcessedForHero.forEach((item) =>
    globalSeenIds.add(item.id),
  );

  // Define content rows configuration
  const contentRowsConfig = [
    {
      rowId: "top-rated-movies",
      title: "Top Rated Movies",
      href: "/movies/browse?type=top-rated",
      variant: "ranked" as const,
      enrich: true,
    },
    {
      rowId: "early-2000s-movies",
      title: "Early 2000s Nostalgia",
      href: "/movies/browse?year=2000-2009",
    },
    {
      rowId: "popular-movies",
      title: "Popular Movies",
      href: "/movies/browse",
    },
    {
      rowId: "popular-tvshows",
      title: "Popular TV Shows",
      href: "/tvshows/browse?filter=tv-popular",
    },
    {
      rowId: "nolan-films",
      title: "Christopher Nolan Films",
      href: "/movies/browse?type=director-nolan",
    },
    {
      rowId: "scifi-fantasy-movies",
      title: "Sci-Fi & Fantasy Worlds",
      href: "/movies/browse?genre=878,14",
    },
    {
      rowId: "binge-worthy-series",
      title: "Binge-Worthy Series",
      href: "/tvshows/browse?filter=tv-diverse",
    },
    {
      rowId: "comedy-movies",
      title: "Laugh Out Loud (Comedies)",
      href: "/movies/browse?genre=35",
    },
    {
      rowId: "a24-films",
      title: "A24 Films",
      href: "/movies/browse?type=studio-a24",
    },
    {
      rowId: "thriller-movies",
      title: "Edge-of-Your-Seat Thrillers",
      href: "/movies/browse?genre=53",
    },
    {
      rowId: "limited-series",
      title: "Limited Series That Hit Hard",
      href: "/tvshows/browse?filter=tv-limited-series",
    },
    {
      rowId: "drama-movies",
      title: "Heartfelt Dramas",
      href: "/movies/browse?genre=18",
    },
    {
      rowId: "critically-acclaimed",
      title: "Critically Acclaimed",
      href: "/movies/browse?filter=critically_acclaimed",
    },
    {
      rowId: "eighties-movies",
      title: "80s Throwbacks",
      href: "/movies/browse?year=1980-1989",
    },
    {
      rowId: "reality-tv",
      title: "Reality TV Picks",
      href: "/tvshows/browse?filter=tv-reality",
    },
    {
      rowId: "nineties-movies",
      title: "90s Favorites",
      href: "/movies/browse?year=1990-1999",
    },
    {
      rowId: "romcom-movies",
      title: "Chill with Rom-Coms",
      href: "/movies/browse?genre=10749,35",
    },
    {
      rowId: "docuseries",
      title: "Docuseries You Can't Miss",
      href: "/tvshows/browse?filter=tv-docuseries",
    },
    {
      rowId: "hidden-gems",
      title: "Hidden Gems",
      href: "/movies/browse?filter=hidden_gems",
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
    <div>
      <main>
        {/* Hero carousel - remains fully visible */}
        <MediaCarousel items={fanFavoriteContentProcessedForHero} />
        <div className="relative">
          {/* only cover content area, not hero */}
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
          <div className="relative z-10 min-h-[200vh]">
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
          </div>
        </div>
      </main>
    </div>
  );
}
