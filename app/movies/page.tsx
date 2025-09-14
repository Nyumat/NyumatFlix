import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { fetchMultipleContentRows } from "@/lib/content-row-fetcher";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";

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

// Use centralized content row configuration

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

  // Define content rows configuration with display metadata
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
      title: "Just Dropped",
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

  // Extract hero carousel IDs to avoid duplicates in content rows
  const heroIds = new Set(enrichedTrendingItems.map((item) => item.id));

  // Fetch all content row data using centralized system
  const contentRowResults = await fetchMultipleContentRows(
    contentRowsConfig.map((config) => ({
      rowId: config.rowId,
      minCount: 20,
    })),
  );

  // Filter out hero content from results and combine with display metadata
  const contentRowsData = contentRowsConfig.map((config) => {
    const result = contentRowResults.find((r) => r.rowId === config.rowId);
    const filteredItems =
      result?.items.filter((item) => !heroIds.has(item.id)) || [];

    return {
      ...config,
      items: filteredItems,
    };
  });

  return (
    <>
      <MediaCarousel items={enrichedTrendingItems} />
      <div className="relative">
        <div className="absolute inset-0 w-full h-full z-0">
          <div
            className="w-full h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.webp')",
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
