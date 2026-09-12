import { slimMediaItemsForRsc, toHeroTvRefs } from "@/lib/cards/catalog-dto";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { CatalogResultsLayout } from "@/components/catalog/catalog-results-layout";
import {
  CatalogGridFallback,
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { DiscoverToolbarSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { ContentRow } from "@/components/content/content-row";
import { DiscoverHubToolbarDynamic } from "@/components/discover/discover-hub-toolbar-dynamic";
import { RecentlyWatchedRow } from "@/components/home/recently-watched-row";
import { CatalogSpotlight } from "@/components/trend/catalog-spotlight";
import { TrendCarousel } from "@/components/trend/trend-client";
import { TvHero } from "@/components/tv/tv-server";
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
import type { SortByTypeTv } from "@/tmdb/api";
import { tmdb } from "@/tmdb/api";
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

export async function TvDiscoverToolbarSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const [{ genres }, providerResponse] = await Promise.all([
    tmdb.genres.tv(),
    tmdb.watchProviders.tv({ region: TMDB_WATCH_REGION }),
  ]);

  return (
    <DiscoverHubToolbarDynamic
      type="tv"
      genres={genres}
      providers={providerResponse.results ?? []}
      serverDiscoverFilters={filterDiscoverParams(sp)}
    />
  );
}

export function TvDiscoverToolbarFallback() {
  return <DiscoverToolbarSkeleton />;
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
      resultCount={catalogResponse.total_results ?? shows.length}
      emptyTitle="No TV shows found for the selected filters."
      emptyDescription="Try removing some filters or sorting differently."
      indexHref={indexHref}
      includeChrome={includeChrome}
    />
  );
}

async function TvDiscoverSpotlightSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const [trendingShows, catalogResponse] = await Promise.all([
    getCachedTrendingTvDay(),
    getCachedDiscoverCatalog(sp),
  ]);
  const shows = filterReleasedTvShows(catalogResponse.results ?? []);
  const heroPool = trendingShows.length > 0 ? trendingShows : shows.slice(0, 1);
  const heroFeaturedId = heroPool[0]?.id ?? null;

  if (heroFeaturedId == null) {
    return null;
  }

  return (
    <CatalogSpotlight
      mediaType="tv"
      id={heroFeaturedId}
      priority
      hubLink={pages.tv.catalog.resultsLink}
      hubButtonLabel="Browse all TV shows"
      badgeLabel="Trending today"
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
    />
  );
}

async function TvDiscoverTrendingHeroSection() {
  const trendingShows = await getCachedTrendingTvDay();
  const heroPair = trendingShows.slice(0, 2);

  if (heroPair.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TvHero
        tvShows={toHeroTvRefs(heroPair)}
        label="Trending now"
        count={2}
        pick="first"
      />
    </div>
  );
}

async function TvDiscoverTopRatedSection() {
  const [topRatedTvForHub, trendingShows] = await Promise.all([
    getCachedTopRatedTvHub(),
    getCachedTrendingTvDay(),
  ]);
  const heroFeaturedId = trendingShows[0]?.id ?? null;
  const showsForRanked =
    heroFeaturedId != null
      ? topRatedTvForHub.filter((show) => show.id !== heroFeaturedId)
      : topRatedTvForHub;
  const hubTopPicksRow = showsForRanked.slice(0, 12);

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
    />
  );
}

async function TvDiscoverPopularHeroSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const popularTv = await getCachedPopularTvByVote(sp);
  const heroPair = popularTv.slice(0, 2);

  if (heroPair.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TvHero
        tvShows={toHeroTvRefs(heroPair)}
        label="Popular now"
        count={2}
        pick="first"
      />
    </div>
  );
}

async function TvDiscoverGridSection({
  searchParams: sp,
  catalogQueryParams,
}: {
  searchParams: SearchParams;
  catalogQueryParams: Record<string, string>;
}) {
  const catalogResponse = await getCachedDiscoverCatalog(sp);
  const shows = filterReleasedTvShows(catalogResponse.results ?? []);
  const hubGridItems: MediaItem[] = slimMediaItemsForRsc(
    shows.map((show) => ({
      ...show,
      media_type: "tv" as const,
    })),
  );

  return (
    <CatalogInfiniteGrid
      mediaType="tv"
      initialItems={hubGridItems}
      initialPage={catalogResponse.page}
      totalPages={catalogResponse.total_pages}
      queryParams={catalogQueryParams}
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
  const heroFeaturedId = trendingShows[0]?.id ?? null;
  const hubTopPicksRow =
    heroFeaturedId != null
      ? topRatedTvForHub
          .filter((show) => show.id !== heroFeaturedId)
          .slice(0, 12)
      : topRatedTvForHub.slice(0, 12);

  const excludeIds = new Set<number>();
  if (heroFeaturedId != null) {
    excludeIds.add(heroFeaturedId);
  }
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

export async function TvDiscoverHubSections({
  searchParams: sp,
  catalogQueryParams,
}: {
  searchParams: SearchParams;
  catalogQueryParams: Record<string, string>;
}) {
  return (
    <>
      <Suspense fallback={<CatalogSpotlightFallback />}>
        <TvDiscoverSpotlightSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={<RecentlyWatchedRowFallback />}>
        <RecentlyWatchedRow scope="tv" />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback />}>
        <TvDiscoverTrendingCarouselSection />
      </Suspense>

      <Suspense fallback={<CatalogHeroPairFallback />}>
        <TvDiscoverTrendingHeroSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback />}>
        <TvDiscoverTopRatedSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback />}>
        <TvDiscoverPopularCarouselSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={<CatalogHeroPairFallback />}>
        <TvDiscoverPopularHeroSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback />}>
        <TvDiscoverCategoryShowcase searchParams={sp} />
      </Suspense>

      <Suspense fallback={<CatalogGridFallback />}>
        <TvDiscoverGridSection
          searchParams={sp}
          catalogQueryParams={catalogQueryParams}
        />
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
  const catalogResponse = await getCachedDiscoverCatalog(sp);
  const shows = filterReleasedTvShows(catalogResponse.results ?? []);

  if (layoutState.isResultsLayout || shows.length === 0) {
    return (
      <TvDiscoverResultsSection
        searchParams={sp}
        title={title}
        description={description}
        catalogQueryParams={catalogQueryParams}
        indexHref={indexHref}
        includeChrome={!layoutState.isHubLayout}
      />
    );
  }

  return (
    <TvDiscoverHubSections
      searchParams={sp}
      catalogQueryParams={catalogQueryParams}
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
    total_results: totalResults,
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
      resultCount={totalResults ?? tvItems.length}
      emptyTitle="No TV shows found for this list."
      indexHref={indexHref}
    />
  );
}
