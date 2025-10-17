import { MediaCarousel } from "@/components/hero/media-carousel";
import { PageBackground } from "@/components/layout/page-background";
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

  return (
    <>
      <PageBackground imageUrl="/movie-banner.webp" title="Movies" />
      <MediaCarousel items={enrichedTrendingItems} />
      <div className="relative z-10 min-h-[200vh]">
        <LazyContentRowsDynamic
          rows={contentRowsConfig}
          initialCount={2}
          batchSize={1}
          rootMargin="100px"
        />
      </div>
    </>
  );
}
