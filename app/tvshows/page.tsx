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

export const dynamic = "force-dynamic";

const isTalkShow = (item: MediaItem): boolean => {
  if (Array.isArray(item.genre_ids) && item.genre_ids.includes(10767))
    return true;
  if ("genres" in item && Array.isArray(item.genres))
    return item.genres.some((g) => g.id === 10767);
  return false;
};

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
  const basicTrendingItems =
    trendingTVResponse.results
      ?.filter((item: MediaItem) => !isTalkShow(item))
      .slice(0, 5) || [];
  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "tv",
  );
  const recommendedRows = getRecommendedRowsForPage("tv");
  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;

      return {
        rowId,
        title: generateRowTitle(rowId),
        href: generateRowHref(config, "tv"),
        variant:
          rowId === "top-rated-tvshows" ? ("ranked" as const) : undefined,
        enrich: true, // Enable content rating enrichment for all rows
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
      <PageBackground imageUrl="/movie-banner.webp" title="TV Shows" />
      <main>
        <MediaCarousel items={enrichedTrendingItems} />
      </main>
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
