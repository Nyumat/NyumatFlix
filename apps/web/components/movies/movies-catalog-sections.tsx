import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { CatalogResultsLayout } from "@/components/catalog/catalog-results-layout";
import {
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { DiscoverToolbarSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import {
  IndexFeatureHero,
  type IndexFeatureHeroItem,
} from "@/components/catalog/index-feature-hero";
import { ContentRow } from "@/components/content/content-row";
import { DiscoverHubToolbarDynamic } from "@/components/discover/discover-hub-toolbar-dynamic";
import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import { RecentlyWatchedRow } from "@/components/home/recently-watched-row";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import { takeUniqueByIdInOrder } from "@/lib/catalog-page-dedupe";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { parseMovieView, parseTrendingTime } from "@/lib/catalog-query";
import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import {
  clampDiscoverMovieLte,
  filterReleasedMovies,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { filterDiscoverParams } from "@/lib/utils";
import { tmdb, type SortByTypeMovie, type WithImages } from "@/tmdb/api";
import { tmdbImage } from "@/tmdb/utils";
import type { MediaItem } from "@/lib/domain/typings";
import { cache, Suspense } from "react";

type SearchParams = Record<string, string>;

export async function MoviesDiscoverToolbarSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const [{ genres }, providerResponse] = await Promise.all([
    tmdb.genres.movie(),
    tmdb.watchProviders.movie({ region: TMDB_WATCH_REGION }),
  ]);
  const providers = providerResponse.results ?? [];

  return (
    <DiscoverHubToolbarDynamic
      type="movie"
      genres={genres}
      providers={providers}
      serverDiscoverFilters={filterDiscoverParams(sp)}
    />
  );
}

export function MoviesDiscoverToolbarFallback() {
  return <DiscoverToolbarSkeleton />;
}

const getCachedTrendingMoviesDay = cache(async () => {
  const { results } = await tmdb.trending.movie({ time: "day", page: "1" });
  return filterReleasedMovies(results ?? []);
});

type MoviesHubFeature = {
  item: IndexFeatureHeroItem;
  backdrop: PageBackdrop | null;
};

const toMoviesHubBackdrop = (
  item: IndexFeatureHeroItem,
): PageBackdrop | null => {
  if (!item.backdrop_path) return null;

  return {
    imageUrl: tmdbImage.backdrop(item.backdrop_path, "w1280"),
    alt: item.title ?? "Featured movie",
    priority: true,
  };
};

const getCachedMoviesHubFeature = cache(
  async (): Promise<MoviesHubFeature | null> => {
    const movies = await getCachedTrendingMoviesDay();
    const featured = movies.find((movie) => Boolean(movie.backdrop_path));

    if (!featured) return null;

    let item: IndexFeatureHeroItem = featured;

    try {
      item = await tmdb.movie.detail<WithImages>({
        id: featured.id,
        append: "images",
      });
    } catch {
      item = featured;
    }

    return {
      item,
      backdrop: toMoviesHubBackdrop(item) ?? toMoviesHubBackdrop(featured),
    };
  },
);

export async function getMoviesHubFeature(): Promise<MoviesHubFeature | null> {
  return getCachedMoviesHubFeature();
}

export async function getMoviesHubAmbientBackdrop(): Promise<PageBackdrop | null> {
  return (await getCachedMoviesHubFeature())?.backdrop ?? null;
}

export async function MoviesDiscoverResultsSection({
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
  const today = getTodayIsoDateUtc();
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
  const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };

  const [catalogResponse, { genres }, providerResponse] = await Promise.all([
    tmdb.discover.movie({
      watch_region: TMDB_WATCH_REGION,
      page: sp.page ?? "1",
      sort_by: (sp.sort_by as SortByTypeMovie | undefined) ?? "popularity.desc",
      ...mergedDiscover,
      "primary_release_date.lte": clampDiscoverMovieLte(
        mergedDiscover["primary_release_date.lte"],
        today,
      ),
    }),
    tmdb.genres.movie(),
    tmdb.watchProviders.movie({ region: TMDB_WATCH_REGION }),
  ]);

  const {
    results: moviesRaw,
    page: currentPage,
    total_pages: totalPages,
    total_results: totalResults,
  } = catalogResponse;
  const movies = filterReleasedMovies(moviesRaw);
  const providers = providerResponse.results ?? [];

  return (
    <CatalogResultsLayout
      mediaType="movie"
      title={title}
      description={description}
      genres={genres}
      providers={providers}
      items={slimMediaItemsForRsc(
        movies.map((m) => ({
          ...m,
          media_type: "movie" as const,
        })),
      )}
      currentPage={currentPage}
      totalPages={totalPages}
      queryParams={catalogQueryParams}
      resultCount={totalResults ?? movies.length}
      emptyTitle="No movies found for the selected filters."
      emptyDescription="Try removing some filters or sorting differently."
      indexHref={indexHref}
      includeChrome={includeChrome}
    />
  );
}

export async function MoviesDiscoverContent({
  searchParams: sp,
  title,
  description,
  catalogQueryParams,
  indexHref,
  feature,
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
  feature?: IndexFeatureHeroItem | null;
}) {
  const layoutState = getCatalogLayoutState(sp, parseMovieView(sp.view));
  const today = getTodayIsoDateUtc();
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
  const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };

  const catalogResponse = await tmdb.discover.movie({
    watch_region: TMDB_WATCH_REGION,
    page: sp.page ?? "1",
    sort_by: (sp.sort_by as SortByTypeMovie | undefined) ?? "popularity.desc",
    ...mergedDiscover,
    "primary_release_date.lte": clampDiscoverMovieLte(
      mergedDiscover["primary_release_date.lte"],
      today,
    ),
  });

  const movies = filterReleasedMovies(catalogResponse.results ?? []);

  if (layoutState.isResultsLayout || movies.length === 0) {
    return (
      <MoviesDiscoverResultsSection
        searchParams={sp}
        title={title}
        description={description}
        catalogQueryParams={catalogQueryParams}
        indexHref={indexHref}
        includeChrome={!layoutState.isHubLayout}
      />
    );
  }

  return <MoviesDiscoverHubSection feature={feature} searchParams={sp} />;
}

async function MoviesDiscoverHubSection({
  feature,
  searchParams: sp,
}: {
  feature?: IndexFeatureHeroItem | null;
  searchParams: SearchParams;
}) {
  const today = getTodayIsoDateUtc();
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
  const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };

  const [
    trendingMovies,
    popularByVoteResponse,
    { results: topRatedMoviesForHubRaw },
  ] = await Promise.all([
    getCachedTrendingMoviesDay(),
    tmdb.discover.movie({
      watch_region: TMDB_WATCH_REGION,
      page: "1",
      sort_by: "vote_count.desc",
      ...mergedDiscover,
      "primary_release_date.lte": clampDiscoverMovieLte(
        mergedDiscover["primary_release_date.lte"],
        today,
      ),
    }),
    tmdb.movie.list({
      list: "top_rated",
      page: "1",
      region: TMDB_WATCH_REGION,
    }),
  ]);

  const popularMovies = filterReleasedMovies(
    popularByVoteResponse.results ?? [],
  );
  const topRatedMoviesForHub = filterReleasedMovies(topRatedMoviesForHubRaw);

  const hubTopPicksRow = topRatedMoviesForHub.slice(0, 12);

  const hubSeen = new Set<number>();
  for (const m of hubTopPicksRow) hubSeen.add(m.id);

  const hubTrendingCarousel = takeUniqueByIdInOrder(
    trendingMovies,
    hubSeen,
    40,
  );
  const hubPopularCarousel = takeUniqueByIdInOrder(popularMovies, hubSeen, 40);

  const hubTrendingCarouselItems = slimMediaItemsForRsc(
    hubTrendingCarousel.map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );
  const hubPopularCarouselItems = slimMediaItemsForRsc(
    hubPopularCarousel.map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );

  return (
    <>
      {feature ? (
        <IndexFeatureHero item={feature} mediaType="movie" priority />
      ) : null}

      <Suspense fallback={<MoviesDiscoverToolbarFallback />}>
        <MoviesDiscoverToolbarSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <RecentlyWatchedRow bleed scope="movie" />
      </Suspense>

      {hubTrendingCarousel.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback bleed />}>
          <TrendCarousel
            type="movie"
            title="Trending"
            link={pages.trending.movie.link}
            items={hubTrendingCarouselItems}
            bleed
          />
        </Suspense>
      ) : null}

      {hubTopPicksRow.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback bleed />}>
          <ContentRow
            variant="ranked"
            title="Top Rated"
            items={slimMediaItemsForRsc(
              hubTopPicksRow.map((m) => ({
                ...m,
                media_type: "movie" as const,
              })),
            )}
            href={pages.movie.topRated.link}
            bleed
          />
        </Suspense>
      ) : null}

      {hubPopularCarousel.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback bleed />}>
          <TrendCarousel
            type="movie"
            title="Popular"
            link={pages.movie.popular.discoverHubLink}
            items={hubPopularCarouselItems}
            bleed
          />
        </Suspense>
      ) : null}

      <CatalogCategoryShowcase
        excludeIds={Array.from(hubSeen)}
        pageKey="movies"
      />
    </>
  );
}

export async function MoviesListCatalogSection({
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
  const view = parseMovieView(sp.view);

  const [catalogResponse, { genres }, providerResponse] = await Promise.all([
    view === "trending"
      ? tmdb.trending.movie({
          time: parseTrendingTime(sp.trending_time),
          page: sp.page ?? "1",
        })
      : tmdb.movie.list({
          region: TMDB_WATCH_REGION,
          list: view === "discover" ? "popular" : view,
          page: sp.page ?? "1",
        }),
    tmdb.genres.movie(),
    tmdb.watchProviders.movie({ region: TMDB_WATCH_REGION }),
  ]);

  const {
    results: moviesRaw,
    page: currentPage,
    total_pages: totalPages,
    total_results: totalResults,
  } = catalogResponse;

  const movies = filterReleasedMovies(moviesRaw);
  const providers = providerResponse.results ?? [];
  const movieItems: MediaItem[] = slimMediaItemsForRsc(
    movies.map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );

  return (
    <CatalogResultsLayout
      mediaType="movie"
      title={title}
      description={description}
      genres={genres}
      providers={providers}
      items={movieItems}
      currentPage={currentPage}
      totalPages={totalPages}
      queryParams={catalogQueryParams}
      resultCount={totalResults ?? movieItems.length}
      emptyTitle="No movies found for this list."
      indexHref={indexHref}
    />
  );
}
