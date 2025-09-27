import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { ProgressiveContentLoader } from "@/components/layout/progressive-content-loader";
import {
  getRecommendedRowsForPage,
  getRowConfig,
  handleInternationalRowFiltering,
  isInternationalRow,
} from "@/utils/content-filters";
import { Genre, MediaItem } from "@/utils/typings";
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

export const dynamic = "force-dynamic";

const isTalkShow = (item: MediaItem): boolean => {
  if (Array.isArray(item.genre_ids) && item.genre_ids.includes(10767))
    return true;
  if ("genres" in item && Array.isArray(item.genres))
    return item.genres.some((g: Genre) => g.id === 10767);
  return false;
};

async function fetchContentRowData(
  rowId: string,
  minCount: number,
  globalSeenIds: Set<number>,
): Promise<MediaItem[]> {
  const config = getRowConfig(rowId);
  if (!config) {
    return [];
  }
  const { category, mediaType } = config;
  let items: MediaItem[] = [];
  let page = 1;
  const hasValidPoster = (item: MediaItem): boolean =>
    Boolean(item.poster_path);
  const isUsTvContent = (item: MediaItem): boolean => {
    if (isInternationalRow(rowId)) {
      return handleInternationalRowFiltering(rowId, item);
    }
    return (
      mediaType !== "tv" ||
      item.origin_country?.includes("US") ||
      item.original_language === "en"
    );
  };
  const filterAndDeduplicate = (item: MediaItem): boolean => {
    if (!hasValidPoster(item) || !isUsTvContent(item)) return false;
    if (isTalkShow(item)) return false;
    if (globalSeenIds.has(item.id)) return false;
    globalSeenIds.add(item.id);
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
  const globalSeenIds = new Set<number>();
  enrichedTrendingItems.forEach((item) => globalSeenIds.add(item.id));
  const recommendedRows = getRecommendedRowsForPage("tv");
  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;
      const title = rowId
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
        .replace(/Tv /g, "TV ")
        .replace(/Tvshows/g, "TV Shows");
      return {
        rowId,
        title,
        href: `/tvshows/browse?filter=${config.category}`,
        variant:
          rowId === "top-rated-tvshows" ? ("ranked" as const) : undefined,
        enrich: ["reality-tv", "mind-bending-scifi"].includes(rowId) || false,
      };
    })
    .filter(Boolean) as Array<{
    rowId: string;
    title: string;
    href: string;
    variant?: "ranked";
    enrich?: boolean;
  }>;
  // Load only the first row initially for progressive loading
  const initialRowCount = 1;
  const initialRowsConfig = contentRowsConfig.slice(0, initialRowCount);
  const remainingRowsConfig = contentRowsConfig.slice(initialRowCount);

  // Load initial row data
  const initialContentRowsData = await Promise.all(
    initialRowsConfig.map(async (config) => {
      const items = await fetchContentRowData(config.rowId, 20, globalSeenIds);
      return {
        ...config,
        items,
      };
    }),
  );

  // Create server action to load next batch of rows
  const getNextRows = async (
    remainingRows: typeof contentRowsConfig,
    batchSize: number = 2,
  ): Promise<typeof contentRowsConfig> => {
    "use server";
    if (remainingRows.length === 0) return [];

    // Load next batch of rows
    const nextBatch = remainingRows.slice(
      0,
      Math.min(batchSize, remainingRows.length),
    );

    const nextRowResults = await Promise.all(
      nextBatch.map(async (config) => {
        const items = await fetchContentRowData(
          config.rowId,
          20,
          globalSeenIds,
        );
        return {
          ...config,
          items,
        };
      }),
    );

    return nextRowResults;
  };

  return (
    <>
      <main>
        <MediaCarousel items={enrichedTrendingItems} />
      </main>
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
