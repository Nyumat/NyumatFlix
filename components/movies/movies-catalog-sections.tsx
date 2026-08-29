import { slimMediaItemsForRsc, toHeroMovieRefs } from "@/lib/cards/catalog-dto";
import { enrichAboveFoldMediaItemsWithLogos } from "@/lib/server/actions";
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
import { MovieHero } from "@/components/movie/movie-server";
import { CatalogSpotlight } from "@/components/trend/catalog-spotlight";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import {
  filterUnseenById,
  takeUniqueByIdInOrder,
} from "@/lib/catalog-page-dedupe";
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
import type { SortByTypeMovie } from "@/tmdb/api";
import { tmdb } from "@/tmdb/api";
import type { MovieWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/lib/domain/typings";
import { Suspense } from "react";

const ABOVE_FOLD_LOGO_COUNT = 8;

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
}: {
  searchParams: SearchParams;
  title: string;
  description: string;
  catalogQueryParams: Record<string, string>;
  indexHref?: string;
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

  return (
    <MoviesDiscoverHubSection
      searchParams={sp}
      catalogQueryParams={catalogQueryParams}
      catalogResponse={catalogResponse}
    />
  );
}

async function MoviesDiscoverHubSection({
  searchParams: sp,
  catalogQueryParams,
  catalogResponse,
}: {
  searchParams: SearchParams;
  catalogQueryParams: Record<string, string>;
  catalogResponse: Awaited<ReturnType<typeof tmdb.discover.movie>>;
}) {
  const today = getTodayIsoDateUtc();
  const discoverParams = filterDiscoverParams(sp);
  const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
  const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };

  const [
    { results: trendingRaw },
    popularByVoteResponse,
    { results: topRatedMoviesForHubRaw },
  ] = await Promise.all([
    tmdb.trending.movie({ time: "day", page: "1" }),
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

  const trendingMovies = filterReleasedMovies(trendingRaw);
  const popularMovies = filterReleasedMovies(
    popularByVoteResponse.results ?? [],
  );
  const topRatedMoviesForHub = filterReleasedMovies(topRatedMoviesForHubRaw);

  const movies = filterReleasedMovies(catalogResponse.results ?? []);
  const { page: currentPage, total_pages: totalPages } = catalogResponse;

  const heroPool =
    trendingMovies.length > 0 ? trendingMovies : movies.slice(0, 1);
  const heroFeaturedId = heroPool[0]?.id ?? null;

  const moviesForRanked =
    heroFeaturedId != null
      ? topRatedMoviesForHub.filter((m) => m.id !== heroFeaturedId)
      : topRatedMoviesForHub;

  const hubTopPicksRow = moviesForRanked.slice(0, 12);

  const hubSeen = new Set<number>();
  if (heroFeaturedId != null) hubSeen.add(heroFeaturedId);
  for (const m of hubTopPicksRow) hubSeen.add(m.id);

  const hubTrendingCarousel = takeUniqueByIdInOrder(
    trendingMovies,
    hubSeen,
    40,
  );
  const hubTrendingHeroPair = takeUniqueByIdInOrder(trendingMovies, hubSeen, 2);
  const hubPopularCarousel = takeUniqueByIdInOrder(popularMovies, hubSeen, 40);
  const hubPopularHeroPair = takeUniqueByIdInOrder(popularMovies, hubSeen, 2);

  const [hubTrendingCarouselEnriched, hubPopularCarouselEnriched] =
    await Promise.all([
      enrichAboveFoldMediaItemsWithLogos(
        hubTrendingCarousel.map((m) => ({
          ...m,
          media_type: "movie" as const,
        })),
        "movie",
        ABOVE_FOLD_LOGO_COUNT,
      ),
      enrichAboveFoldMediaItemsWithLogos(
        hubPopularCarousel.map((m) => ({
          ...m,
          media_type: "movie" as const,
        })),
        "movie",
        ABOVE_FOLD_LOGO_COUNT,
      ),
    ]);

  const hubGridItems: MediaItem[] = slimMediaItemsForRsc(
    filterUnseenById(movies, hubSeen).map((m) => ({
      ...m,
      media_type: "movie" as const,
    })),
  );

  return (
    <>
      {heroFeaturedId != null ? (
        <Suspense fallback={<CatalogSpotlightFallback />}>
          <CatalogSpotlight
            mediaType="movie"
            id={heroFeaturedId}
            priority
            hubLink={pages.movie.catalog.resultsLink}
            hubButtonLabel="Browse all movies"
            badgeLabel="Trending today"
          />
        </Suspense>
      ) : null}

      <Suspense fallback={<RecentlyWatchedRowFallback />}>
        <RecentlyWatchedRow scope="movie" />
      </Suspense>

      {hubTrendingCarousel.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback />}>
          <TrendCarousel
            type="movie"
            title="Trending"
            link={pages.trending.movie.link}
            items={slimMediaItemsForRsc(
              hubTrendingCarouselEnriched as MovieWithMediaType[],
            )}
          />
        </Suspense>
      ) : null}

      {hubTrendingHeroPair.length > 0 ? (
        <Suspense fallback={<CatalogHeroPairFallback />}>
          <div className="grid gap-4 md:grid-cols-2">
            <MovieHero
              movies={toHeroMovieRefs(hubTrendingHeroPair)}
              label="Trending now"
              count={2}
              pick="first"
            />
          </div>
        </Suspense>
      ) : null}

      {hubTopPicksRow.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback />}>
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
          />
        </Suspense>
      ) : null}

      {hubPopularCarousel.length > 0 ? (
        <Suspense fallback={<CatalogRowFallback />}>
          <TrendCarousel
            type="movie"
            title="Popular"
            link={pages.movie.popular.discoverHubLink}
            items={slimMediaItemsForRsc(
              hubPopularCarouselEnriched as MovieWithMediaType[],
            )}
          />
        </Suspense>
      ) : null}

      {hubPopularHeroPair.length > 0 ? (
        <Suspense fallback={<CatalogHeroPairFallback />}>
          <div className="grid gap-4 md:grid-cols-2">
            <MovieHero
              movies={toHeroMovieRefs(hubPopularHeroPair)}
              label="Popular now"
              count={2}
              pick="first"
            />
          </div>
        </Suspense>
      ) : null}

      <CatalogCategoryShowcase
        excludeIds={Array.from(hubSeen)}
        pageKey="movies"
      />

      <Suspense fallback={<CatalogGridFallback />}>
        <CatalogInfiniteGrid
          mediaType="movie"
          initialItems={hubGridItems}
          initialPage={currentPage}
          totalPages={totalPages}
          queryParams={catalogQueryParams}
        />
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
