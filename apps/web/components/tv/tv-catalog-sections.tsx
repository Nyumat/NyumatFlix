import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { CatalogResultsLayout } from "@/components/catalog/catalog-results-layout";
import {
  CatalogRankedRowFallback,
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { ContentRow } from "@/components/content/content-row";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { RecentlyWatchedRow } from "@/components/home/recently-watched-row";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { parseTrendingTime, parseTvView } from "@/lib/catalog-query";
import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import {
  clampDiscoverTvLte,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { filterDiscoverParams, getUserTimezone } from "@/lib/utils";
import {
  getTvHubFeature as loadTvHubFeature,
  type CatalogHubFeature,
} from "@/lib/server/catalog-hub-feature";
import { tmdb, type SortByTypeTv } from "@/tmdb/api";
import type { MediaItem } from "@/lib/domain/typings";
import { cache } from "react";
import { Suspense } from "react";

type SearchParams = Record<string, string>;

const getDiscoverMergedParams = (sp: SearchParams) => {
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "tv");
  return { ...discoverParams, ...catalogUrlMerge };
};

const getCachedTrendingTvDay = cache(async () => {
  const { results } = await tmdb.trending.tv({ time: "day", page: "1" });
  return filterReleasedTvShows(results ?? []);
});

export async function getTvHubFeature(): Promise<CatalogHubFeature | null> {
  return loadTvHubFeature();
}

const getCachedPopularTvByVote = cache(async (sp: SearchParams) => {
  const today = getTodayIsoDateUtc();
  const mergedDiscover = getDiscoverMergedParams(sp);
  const response = await tmdb.discover.tv({
    watch_region: TMDB_WATCH_REGION,
    page: "1",
    sort_by: "vote_count.desc",
    ...mergedDiscover,
    "first_air_date.lte": clampDiscoverTvLte(
      mergedDiscover["first_air_date.lte"],
      today,
    ),
  });
  return filterReleasedTvShows(response.results ?? []);
});

const getCachedTopRatedTvHub = cache(async () => {
  const timezone = getUserTimezone();
  const { results } = await tmdb.tv.list({
    list: "top_rated",
    page: "1",
    region: TMDB_WATCH_REGION,
    timezone,
  });
  return filterReleasedTvShows(results);
});

const getCachedDiscoverCatalog = cache(async (sp: SearchParams) => {
  const today = getTodayIsoDateUtc();
  const mergedDiscover = getDiscoverMergedParams(sp);
  return tmdb.discover.tv({
    watch_region: TMDB_WATCH_REGION,
    page: sp.page ?? "1",
    sort_by: (sp.sort_by as SortByTypeTv | undefined) ?? "popularity.desc",
    ...mergedDiscover,
    "first_air_date.lte": clampDiscoverTvLte(
      mergedDiscover["first_air_date.lte"],
      today,
    ),
  });
});

export async function getTvHubAmbientBackdrop(): Promise<PageBackdrop | null> {
  return (await loadTvHubFeature())?.backdrop ?? null;
}

export async function TvDiscoverResultsSection({
  searchParams: sp,
  title,
  description,
  catalogQueryParams,
  indexHref,
  includeChrome = true,
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
  includeChrome?: boolean;
}) {
  const [catalogResponse, { genres }, providerResponse] = await Promise.all([
    getCachedDiscoverCatalog(sp),
    tmdb.genres.tv(),
    tmdb.watchProviders.tv({ region: TMDB_WATCH_REGION }),
  ]);

  const shows = filterReleasedTvShows(catalogResponse.results ?? []);

  return (
    <CatalogResultsLayout
      mediaType="tv"
      title={title}
      description={description}
      genres={genres}
      providers={providerResponse.results ?? []}
      items={slimMediaItemsForRsc(
        shows.map((show) => ({
          ...show,
          media_type: "tv" as const,
        })),
      )}
      currentPage={catalogResponse.page}
      totalPages={catalogResponse.total_pages}
      queryParams={catalogQueryParams}
      emptyTitle="No TV shows found for the selected filters."
      emptyDescription="Try removing some filters or sorting differently."
      indexHref={indexHref}
      includeChrome={includeChrome}
    />
  );
}

async function TvDiscoverTrendingCarouselSection() {
  const trendingShows = await getCachedTrendingTvDay();
  const items = slimMediaItemsForRsc(
    trendingShows.slice(0, 40).map((show) => ({
      ...show,
      media_type: "tv" as const,
    })),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <TrendCarousel
      type="tv"
      title="Trending"
      link={pages.trending.tv.link}
      items={items}
      bleed
    />
  );
}

async function TvDiscoverTopRatedSection() {
  const topRatedTvForHub = await getCachedTopRatedTvHub();
  const hubTopPicksRow = topRatedTvForHub.slice(0, 12);

  if (hubTopPicksRow.length === 0) {
    return null;
  }

  return (
    <ContentRow
      variant="ranked"
      title="Top Rated"
      items={slimMediaItemsForRsc(
        hubTopPicksRow.map((show) => ({
          ...show,
          media_type: "tv" as const,
        })),
      )}
      href={pages.tv.topRated.link}
      bleed
    />
  );
}

async function TvDiscoverPopularCarouselSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const popularTv = await getCachedPopularTvByVote(sp);
  const items = slimMediaItemsForRsc(
    popularTv.slice(0, 40).map((show) => ({
      ...show,
      media_type: "tv" as const,
    })),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <TrendCarousel
      type="tv"
      title="Popular"
      link={pages.tv.popular.discoverHubLink}
      items={items}
      bleed
    />
  );
}

async function TvDiscoverCategoryShowcase({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const [trendingShows, topRatedTvForHub] = await Promise.all([
    getCachedTrendingTvDay(),
    getCachedTopRatedTvHub(),
  ]);
  const hubTopPicksRow = topRatedTvForHub.slice(0, 12);

  const excludeIds = new Set<number>();
  for (const show of hubTopPicksRow) {
    excludeIds.add(show.id);
  }
  for (const show of trendingShows.slice(0, 40)) {
    excludeIds.add(show.id);
  }

  return (
    <CatalogCategoryShowcase excludeIds={Array.from(excludeIds)} pageKey="tv" />
  );
}

export function TvDiscoverHubSections({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <RecentlyWatchedRow bleed scope="tv" />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <TvDiscoverTrendingCarouselSection />
      </Suspense>

      <Suspense fallback={<CatalogRankedRowFallback bleed />}>
        <TvDiscoverTopRatedSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <TvDiscoverPopularCarouselSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={null}>
        <TvDiscoverCategoryShowcase searchParams={sp} />
      </Suspense>
    </>
  );
}

export async function TvDiscoverContent({
  searchParams: sp,
  title,
  description,
  catalogQueryParams,
  indexHref,
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
}) {
  const layoutState = getCatalogLayoutState(sp, parseTvView(sp.view));

  if (layoutState.isHubLayout) {
    return <TvDiscoverHubSections searchParams={sp} />;
  }

  return (
    <TvDiscoverResultsSection
      searchParams={sp}
      title={title}
      description={description}
      catalogQueryParams={catalogQueryParams}
      indexHref={indexHref}
      includeChrome
    />
  );
}

export async function TvListCatalogSection({
  searchParams: sp,
  title,
  description,
  catalogQueryParams,
  indexHref,
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
}) {
  const view = parseTvView(sp.view);
  const timezone = getUserTimezone();

  const [catalogResponse, { genres }, providerResponse] = await Promise.all([
    view === "trending"
      ? tmdb.trending.tv({
          time: parseTrendingTime(sp.trending_time),
          page: sp.page ?? "1",
        })
      : view === "discover"
        ? Promise.reject(
            new Error("TvListCatalogSection does not support discover view"),
          )
        : tmdb.tv.list({
            region: TMDB_WATCH_REGION,
            list: view,
            page: sp.page ?? "1",
            timezone,
          }),
    tmdb.genres.tv(),
    tmdb.watchProviders.tv({ region: TMDB_WATCH_REGION }),
  ]);

  const {
    results: showsRaw,
    page: currentPage,
    total_pages: totalPages,
  } = catalogResponse;

  const shows = filterReleasedTvShows(showsRaw);
  const tvItems: MediaItem[] = slimMediaItemsForRsc(
    shows.map((show) => ({
      ...show,
      media_type: "tv" as const,
    })),
  );

  return (
    <CatalogResultsLayout
      mediaType="tv"
      title={title}
      description={description}
      genres={genres}
      providers={providerResponse.results ?? []}
      items={tvItems}
      currentPage={currentPage}
      totalPages={totalPages}
      queryParams={catalogQueryParams}
      emptyTitle="No TV shows found for this list."
      indexHref={indexHref}
    />
  );
}
