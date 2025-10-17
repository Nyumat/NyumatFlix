import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { ProgressiveContentLoader } from "@/components/layout/progressive-content-loader";
import { fetchMultipleContentRows } from "@/lib/content-row-fetcher";
import {
  generateRowHref,
  generateRowTitle,
  getRecommendedRowsForPage,
  getRowConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";
import { LazyContentRowsDynamic } from "./client-components";

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
  alternates: {
    canonical: "https://nyumatflix.com/movies",
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
      ?.filter(
        (movie): movie is Movie =>
          typeof movie === "object" &&
          movie !== null &&
          "id" in movie &&
          typeof movie.id === "number" &&
          movie.id !== 1011477,
      )
      ?.filter(
        (movie): movie is Movie =>
          typeof movie === "object" &&
          movie !== null &&
          "id" in movie &&
          typeof movie.id === "number" &&
          movie.id !== 1011477,
      )
      .slice(0, 10) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "movie",
  );

  const recommendedRows = getRecommendedRowsForPage("movies");

  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;

      return {
        rowId,
        title: generateRowTitle(rowId),
        href: generateRowHref(config, "movie"),
        variant: rowId === "top-rated-movies" ? ("ranked" as const) : undefined,
        enrich: true,
      };
    })
    .filter(Boolean) as Array<{
    rowId: string;
    title: string;
    href: string;
    variant?: "ranked";
    enrich?: boolean;
  }>;

  const heroIds = new Set(enrichedTrendingItems.map((item) => item.id));

  // Load only the first 2 rows initially for progressive loading
  const initialRowCount = 2;
  const initialRowsConfig = contentRowsConfig.slice(0, initialRowCount);
  const remainingRowsConfig = contentRowsConfig.slice(initialRowCount);

  // Load initial rows data
  const initialContentRowResults = await fetchMultipleContentRows(
    initialRowsConfig.map((config) => ({
      rowId: config.rowId,
      minCount: 20,
    })),
  );

  const initialContentRowsData = initialRowsConfig.map((config) => {
    const result = initialContentRowResults.find(
      (r) => r.rowId === config.rowId,
    );
    const filteredItems =
      result?.items.filter((item) => !heroIds.has(item.id)) || [];

    return {
      ...config,
      items: filteredItems,
    };
  });

  // Create server action to load next batch of rows
  const getNextRows = async (
    remainingRows: typeof contentRowsConfig,
    batchSize: number = 3,
  ): Promise<typeof contentRowsConfig> => {
    "use server";
    if (remainingRows.length === 0) return [];

    // Load next batch of rows
    const nextBatch = remainingRows.slice(
      0,
      Math.min(batchSize, remainingRows.length),
    );

    const nextRowResults = await fetchMultipleContentRows(
      nextBatch.map((config) => ({
        rowId: config.rowId,
        minCount: 20,
      })),
    );

    return nextBatch.map((config) => {
      const result = nextRowResults.find((r) => r.rowId === config.rowId);
      const filteredItems =
        result?.items.filter((item) => Boolean(item.poster_path)) || []; // Only filter by poster_path

      return {
        ...config,
        items: filteredItems,
      };
    });
  };

  return (
    <>
      <PageBackground imageUrl="/movie-banner.webp" title="Movies" />
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
        <div className="relative z-10 min-h-[300vh] pb-32">
          <ContentContainer>
            <ProgressiveContentLoader
              initialRows={initialContentRowsData}
              remainingRowsConfig={remainingRowsConfig}
              getNextRows={getNextRows}
            />
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
