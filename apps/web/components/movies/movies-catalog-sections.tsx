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
import { parseMovieView, parseTrendingTime } from "@/lib/catalog-query";
import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import {
  clampDiscoverMovieLte,
  filterReleasedMovies,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { filterDiscoverParams } from "@/lib/utils";
import {
  getMoviesCatalogHubFeature,
  type CatalogHubFeature,
} from "@/lib/server/catalog-hub-feature";
import { tmdb, type SortByTypeMovie } from "@/tmdb/api";
import type { MediaItem } from "@/lib/domain/typings";
import { cache, Suspense } from "react";

type SearchParams = Record<string, string>;

const getCachedTrendingMoviesDay = cache(async () => {
  const { results } = await tmdb.trending.movie({ time: "day", page: "1" });
  return filterReleasedMovies(results ?? []);
});

export async function getMoviesHubFeature(): Promise<CatalogHubFeature | null> {
  return getMoviesCatalogHubFeature();
}

export async function getMoviesHubAmbientBackdrop(): Promise<PageBackdrop | null> {
  return (await getMoviesCatalogHubFeature())?.backdrop ?? null;
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
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
}) {
  const layoutState = getCatalogLayoutState(sp, parseMovieView(sp.view));

  if (layoutState.isHubLayout) {
    return <MoviesDiscoverHubSections searchParams={sp} />;
  }

  return (
    <MoviesDiscoverResultsSection
      searchParams={sp}
      title={title}
      description={description}
      catalogQueryParams={catalogQueryParams}
      indexHref={indexHref}
      includeChrome
    />
  );
}

const getDiscoverMergedParams = (sp: SearchParams) => {
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
  return { ...discoverParams, ...catalogUrlMerge };
};

const getCachedPopularMoviesByVote = cache(async (sp: SearchParams) => {
  const today = getTodayIsoDateUtc();
  const mergedDiscover = getDiscoverMergedParams(sp);
  const response = await tmdb.discover.movie({
    watch_region: TMDB_WATCH_REGION,
    page: "1",
    sort_by: "vote_count.desc",
    ...mergedDiscover,
    "primary_release_date.lte": clampDiscoverMovieLte(
      mergedDiscover["primary_release_date.lte"],
      today,
    ),
  });
  return filterReleasedMovies(response.results ?? []);
});

const getCachedTopRatedMoviesHub = cache(async () => {
  const { results } = await tmdb.movie.list({
    list: "top_rated",
    page: "1",
    region: TMDB_WATCH_REGION,
  });
  return filterReleasedMovies(results ?? []);
});

async function MoviesDiscoverTrendingCarouselSection() {
  const trendingMovies = await getCachedTrendingMoviesDay();
  const items = slimMediaItemsForRsc(
    trendingMovies.slice(0, 40).map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );

  if (items.length === 0) return null;

  return (
    <TrendCarousel
      type="movie"
      title="Trending"
      link={pages.trending.movie.link}
      items={items}
      bleed
    />
  );
}

async function MoviesDiscoverTopRatedSection() {
  const topRatedMoviesForHub = await getCachedTopRatedMoviesHub();
  const hubTopPicksRow = topRatedMoviesForHub.slice(0, 12);

  if (hubTopPicksRow.length === 0) return null;

  return (
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
  );
}

async function MoviesDiscoverPopularCarouselSection({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  const popularMovies = await getCachedPopularMoviesByVote(sp);
  const items = slimMediaItemsForRsc(
    popularMovies.slice(0, 40).map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );

  if (items.length === 0) return null;

  return (
    <TrendCarousel
      type="movie"
      title="Popular"
      link={pages.movie.popular.discoverHubLink}
      items={items}
      bleed
    />
  );
}

async function MoviesDiscoverCategoryShowcase() {
  const [trendingMovies, topRatedMoviesForHub] = await Promise.all([
    getCachedTrendingMoviesDay(),
    getCachedTopRatedMoviesHub(),
  ]);
  const hubTopPicksRow = topRatedMoviesForHub.slice(0, 12);

  const excludeIds = new Set<number>();
  for (const movie of hubTopPicksRow) {
    excludeIds.add(movie.id);
  }
  for (const movie of trendingMovies.slice(0, 40)) {
    excludeIds.add(movie.id);
  }

  return (
    <CatalogCategoryShowcase
      excludeIds={Array.from(excludeIds)}
      pageKey="movies"
    />
  );
}

export function MoviesDiscoverHubSections({
  searchParams: sp,
}: {
  searchParams: SearchParams;
}) {
  return (
    <>
      <Suspense fallback={<RecentlyWatchedRowFallback bleed />}>
        <RecentlyWatchedRow bleed scope="movie" />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <MoviesDiscoverTrendingCarouselSection />
      </Suspense>

      <Suspense fallback={<CatalogRankedRowFallback bleed />}>
        <MoviesDiscoverTopRatedSection />
      </Suspense>

      <Suspense fallback={<CatalogRowFallback bleed />}>
        <MoviesDiscoverPopularCarouselSection searchParams={sp} />
      </Suspense>

      <Suspense fallback={null}>
        <MoviesDiscoverCategoryShowcase />
      </Suspense>
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
      emptyTitle="No movies found for this list."
      indexHref={indexHref}
    />
  );
}
