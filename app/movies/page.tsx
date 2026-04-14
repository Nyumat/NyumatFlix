import { enrichMediaItemsWithLogos } from "@/app/actions";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { CatalogResultsLayout } from "@/components/catalog/catalog-results-layout";
import { ContentRow } from "@/components/content/content-row";
import { DiscoverHubToolbarDynamic } from "@/components/discover";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MovieHero } from "@/components/movie";
import { CatalogSpotlight } from "@/components/trend/catalog-spotlight";
import { TrendCarousel } from "@/components/trend/trend-client";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { pages } from "@/config";
import {
  filterUnseenById,
  takeUniqueByIdInOrder,
} from "@/lib/catalog-page-dedupe";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import {
  parseMovieView,
  parseTrendingTime,
  stripCatalogUiParams,
} from "@/lib/catalog-query";
import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import { getMovieCatalogListCopy } from "@/lib/catalog-list-copy";
import { getDiscoverCatalogCopy } from "@/lib/discover-page-copy";
import {
  clampDiscoverMovieLte,
  filterReleasedMovies,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { filterDiscoverParams, normalizeRouteSearchParams } from "@/lib/utils";
import type { SortByTypeMovie } from "@/tmdb/api";
import { tmdb } from "@/tmdb/api";
import type { MovieWithMediaType } from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";
import type { Metadata } from "next";

export const revalidate = 3600;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseMovieView(sp.view);
  const { title, description } =
    getDiscoverCatalogCopy(sp, "movie") ?? getMovieCatalogListCopy(view);

  return {
    title: `${title} | NyumatFlix`,
    description: description || undefined,
    openGraph: {
      title: `${title} | NyumatFlix`,
      description: description || undefined,
      type: "website",
      siteName: "NyumatFlix",
    },
  };
}

const toCatalogQueryParams = (
  sp: Record<string, string>,
): Record<string, string> =>
  stripCatalogUiParams(
    Object.fromEntries(Object.entries(sp).filter(([key]) => key !== "page")),
  );

export default async function MoviesCatalogPage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseMovieView(sp.view);
  const layoutState = getCatalogLayoutState(sp, view);
  const { title, description } =
    getDiscoverCatalogCopy(sp, "movie") ?? getMovieCatalogListCopy(view);
  const catalogQueryParams = toCatalogQueryParams(sp);

  if (view === "discover") {
    const today = getTodayIsoDateUtc();
    const discoverParams = filterDiscoverParams(sp);
    const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "movie");
    const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };
    const [
      { results: trendingRaw },
      catalogResponse,
      popularByVoteResponse,
      { results: topRatedMoviesForHubRaw },
    ] = await Promise.all([
      tmdb.trending.movie({ time: "day", page: "1" }),
      tmdb.discover.movie({
        watch_region: TMDB_WATCH_REGION,
        page: sp.page ?? "1",
        sort_by:
          (sp.sort_by as SortByTypeMovie | undefined) ?? "popularity.desc",
        ...mergedDiscover,
        "primary_release_date.lte": clampDiscoverMovieLte(
          mergedDiscover["primary_release_date.lte"],
          today,
        ),
      }),
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

    const {
      results: moviesRaw,
      page: currentPage,
      total_pages: totalPages,
    } = catalogResponse;
    const movies = filterReleasedMovies(moviesRaw);

    const providerResponse = await tmdb.watchProviders.movie({
      region: TMDB_WATCH_REGION,
    });
    const providers = providerResponse.results ?? [];

    const { genres } = await tmdb.genres.movie();

    if (layoutState.isResultsLayout || movies.length === 0) {
      return (
        <div className="flex w-full flex-col">
          <StaticHero
            imageUrl="/movie-banner.webp"
            title=""
            route=""
            hideTitle
          />

          <ContentContainer className="relative z-10 flex w-full flex-col items-center">
            <section className="min-h-screen w-full pb-16 pt-6">
              <div className="container space-y-10">
                <CatalogResultsLayout
                  mediaType="movie"
                  title={title}
                  description={description}
                  genres={genres}
                  providers={providers}
                  items={movies.map((m) => ({
                    ...m,
                    media_type: "movie" as const,
                  }))}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  queryParams={catalogQueryParams}
                  emptyTitle="No movies found for the selected filters."
                  emptyDescription="Try removing some filters or sorting differently."
                />
              </div>
            </section>
          </ContentContainer>

          <ScrollToTop />
        </div>
      );
    }

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
    const hubTrendingHeroPair = takeUniqueByIdInOrder(
      trendingMovies,
      hubSeen,
      2,
    );
    const hubPopularCarousel = takeUniqueByIdInOrder(
      popularMovies,
      hubSeen,
      40,
    );
    const hubPopularHeroPair = takeUniqueByIdInOrder(popularMovies, hubSeen, 2);

    const [hubTrendingCarouselEnriched, hubPopularCarouselEnriched] =
      await Promise.all([
        enrichMediaItemsWithLogos(
          hubTrendingCarousel.map((m) => ({
            ...m,
            media_type: "movie" as const,
          })),
          "movie",
        ),
        enrichMediaItemsWithLogos(
          hubPopularCarousel.map((m) => ({
            ...m,
            media_type: "movie" as const,
          })),
          "movie",
        ),
      ]);

    const hubGridItems: MediaItem[] = filterUnseenById(movies, hubSeen).map(
      (m) => ({ ...m, media_type: "movie" as const }),
    );

    return (
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <section className="min-h-screen w-full pb-16 pt-6">
            <div className="container space-y-10">
              <header className="space-y-1 text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                  {title}
                </h1>
                {description ? (
                  <p className="text-muted-foreground">{description}</p>
                ) : null}
              </header>

              <DiscoverHubToolbarDynamic
                type="movie"
                genres={genres}
                providers={providers}
                serverDiscoverFilters={filterDiscoverParams(sp)}
              />

              {heroFeaturedId != null ? (
                <CatalogSpotlight
                  mediaType="movie"
                  id={heroFeaturedId}
                  priority
                  hubLink={pages.movie.catalog.resultsLink}
                  hubButtonLabel="Browse all movies"
                  badgeLabel="Trending today"
                />
              ) : null}

              {hubTrendingCarousel.length > 0 ? (
                <TrendCarousel
                  type="movie"
                  title={pages.trending.movie.title}
                  link={pages.trending.movie.link}
                  items={hubTrendingCarouselEnriched as MovieWithMediaType[]}
                />
              ) : null}

              {hubTrendingHeroPair.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <MovieHero
                    movies={hubTrendingHeroPair}
                    label="Trending now"
                    count={2}
                    pick="first"
                  />
                </div>
              ) : null}

              {hubTopPicksRow.length > 0 ? (
                <ContentRow
                  variant="ranked"
                  title={pages.movie.topRated.title}
                  items={hubTopPicksRow.map((m) => ({
                    ...m,
                    media_type: "movie" as const,
                  }))}
                  href={pages.movie.topRated.link}
                />
              ) : null}

              {hubPopularCarousel.length > 0 ? (
                <TrendCarousel
                  type="movie"
                  title="Popular"
                  link={pages.movie.popular.discoverHubLink}
                  items={hubPopularCarouselEnriched as MovieWithMediaType[]}
                />
              ) : null}

              {hubPopularHeroPair.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <MovieHero
                    movies={hubPopularHeroPair}
                    label="Popular now"
                    count={2}
                    pick="first"
                  />
                </div>
              ) : null}

              <CatalogCategoryShowcase
                excludeIds={Array.from(hubSeen)}
                pageKey="movies"
              />

              <CatalogInfiniteGrid
                mediaType="movie"
                initialItems={hubGridItems}
                initialPage={currentPage}
                totalPages={totalPages}
                queryParams={catalogQueryParams}
              />
            </div>
          </section>
        </ContentContainer>

        <ScrollToTop />
      </div>
    );
  }

  const [catalogResponse, { genres }, providerResponse] = await Promise.all([
    view === "trending"
      ? tmdb.trending.movie({
          time: parseTrendingTime(sp.trending_time),
          page: sp.page ?? "1",
        })
      : tmdb.movie.list({
          region: TMDB_WATCH_REGION,
          list: view,
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
  const movieItems: MediaItem[] = movies.map((m) => ({
    ...m,
    media_type: "movie" as const,
  }));

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-6">
          <div className="container space-y-10">
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
            />
          </div>
        </section>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
