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
  title: "Movies | NyumatFlix",
  description: "Discover popular and top-rated movies on NyumatFlix.",
  openGraph: {
    title: "Movies | NyumatFlix",
    description: "Discover popular and top-rated movies on NyumatFlix.",
    type: "website",
    siteName: "NyumatFlix",
  },
  twitter: {
    title: "Movies | NyumatFlix",
    description: "Discover popular and top-rated movies on NyumatFlix.",
  },
};

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  categories?: string[];
}

// Row configuration mapping - same as content-rows API for movies
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
  "recent-releases": { category: "recent-releases", mediaType: "movie" },
};

// Server-side content row fetching function for movies
async function fetchContentRowData(
  rowId: string,
  minCount: number,
  globalSeenIds: Set<number>,
): Promise<MediaItem[]> {
  if (!ROW_CONFIG[rowId]) {
    console.error(`[Movies] Invalid row ID: ${rowId}`);
    return [];
  }

  const { category, mediaType } = ROW_CONFIG[rowId];
  let items: MediaItem[] = [];
  let page = 1;

  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);

  const filterAndDeduplicate = (item: MediaItem): boolean => {
    if (!hasValidPoster(item)) return false;
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

export default async function MoviesPage() {
  const trendingMoviesResponse = await fetchTMDBData("/discover/movie", {
    sort_by: "popularity.desc",
    with_genres: "28|12|16|35|878|10749|10751|10765",
    "release_date.gte": "2023-01-01",
    "release_date.lte": "2025-07-12",
    "vote_count.gte": "100",
    include_adult: "false",
    language: "en-US",
    region: "US",
  });

  const basicTrendingItems =
    trendingMoviesResponse.results
      ?.filter((movie) => movie.id !== 1011477)
      .slice(0, 10) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "movie",
  );

  // Global tracking of seen IDs across ALL content rows
  // Start with hero carousel items to ensure they don't appear in content rows
  const globalSeenIds = new Set<number>();
  enrichedTrendingItems.forEach((item) => globalSeenIds.add(item.id));

  // Define content rows configuration
  const contentRowsConfig = [
    {
      rowId: "top-rated-movies",
      title: "Top Rated Movies",
      href: "/movies/browse?type=top-rated",
      variant: "ranked" as const,
    },
    {
      rowId: "drama-movies",
      title: "Drama Movies",
      href: "/movies/browse?genre=18",
    },
    {
      rowId: "disney-magic",
      title: "Disney Movies",
      href: "/movies/browse?type=studio-disney",
    },
    {
      rowId: "nineties-movies",
      title: "90s Movies",
      href: "/movies/browse?year=1990-1999",
    },
    {
      rowId: "scifi-fantasy-movies",
      title: "Sci-Fi & Fantasy Movies",
      href: "/movies/browse?genre=878,14",
    },
    {
      rowId: "recent-releases",
      title: "New Releases",
      href: "/movies/browse?year=2025",
    },
    {
      rowId: "spielberg-films",
      title: "Steven Spielberg Movies",
      href: "/movies/browse?type=director-spielberg",
    },
    {
      rowId: "hidden-gems",
      title: "Hidden Gems",
      href: "/movies/browse?filter=hidden_gems",
    },
    {
      rowId: "comedy-movies",
      title: "Comedy Movies",
      href: "/movies/browse?genre=35",
    },
    {
      rowId: "early-2000s-movies",
      title: "2000s Movies",
      href: "/movies/browse?year=2000-2009",
    },
    {
      rowId: "nolan-films",
      title: "Christopher Nolan Movies",
      href: "/movies/browse?type=director-nolan",
    },
    {
      rowId: "pixar-animation",
      title: "Pixar Movies",
      href: "/movies/browse?type=studio-pixar",
    },
    {
      rowId: "upcoming-movies",
      title: "Upcoming Movies",
      href: "/movies/browse?type=upcoming",
    },
    {
      rowId: "scorsese-films",
      title: "Martin Scorsese Movies",
      href: "/movies/browse?type=director-scorsese",
    },
    {
      rowId: "a24-films",
      title: "A24 Movies",
      href: "/movies/browse?type=studio-a24",
    },
    {
      rowId: "eighties-movies",
      title: "80s Movies",
      href: "/movies/browse?year=1980-1989",
    },
    {
      rowId: "popular-movies",
      title: "Popular Movies",
      href: "/movies/browse?type=popular",
      variant: "standard" as const,
    },
    {
      rowId: "critically-acclaimed",
      title: "Critically Acclaimed Movies",
      href: "/movies/browse?filter=critically_acclaimed",
    },
    {
      rowId: "action-movies",
      title: "Action Movies",
      href: "/movies/browse?genre=28",
    },
    {
      rowId: "tarantino-films",
      title: "Quentin Tarantino Movies",
      href: "/movies/browse?type=director-tarantino",
    },
    {
      rowId: "thriller-movies",
      title: "Thriller Movies",
      href: "/movies/browse?genre=53",
    },
    {
      rowId: "romcom-movies",
      title: "Romantic Comedies",
      href: "/movies/browse?genre=10749,35",
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
      <MediaCarousel items={enrichedTrendingItems} />
      <div className="relative">
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
          <ContentContainer>
            {contentRowsData.map((rowData) => (
              <SuspenseContentRow
                key={rowData.rowId}
                rowId={rowData.rowId}
                title={rowData.title}
                href={rowData.href}
                variant={rowData.variant}
                preloadedItems={rowData.items}
              />
            ))}
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
