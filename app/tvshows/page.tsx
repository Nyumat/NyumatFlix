import { enrichMediaItemsWithLogos } from "@/app/actions";
import { CatalogCategoryShowcase } from "@/components/catalog/catalog-category-showcase";
import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { CatalogResultsLayout } from "@/components/catalog/catalog-results-layout";
import { ContentRow } from "@/components/content/content-row";
import { DiscoverFilters, DiscoverSort } from "@/components/discover";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { CatalogSpotlight } from "@/components/trend/catalog-spotlight";
import { TrendCarousel } from "@/components/trend/trend-client";
import { TvHero } from "@/components/tv";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { pages } from "@/config";
import {
  filterUnseenById,
  takeUniqueByIdInOrder,
} from "@/lib/catalog-page-dedupe";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import {
  parseTrendingTime,
  parseTvView,
  stripCatalogUiParams,
} from "@/lib/catalog-query";
import { buildCatalogDiscoverUrlMerge } from "@/lib/discover-merge";
import { getTvCatalogListCopy } from "@/lib/catalog-list-copy";
import { getDiscoverCatalogCopy } from "@/lib/discover-page-copy";
import {
  clampDiscoverTvLte,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import {
  filterDiscoverParams,
  getUserTimezone,
  normalizeRouteSearchParams,
} from "@/lib/utils";
import type { SortByTypeTv } from "@/tmdb/api";
import { tmdb } from "@/tmdb/api";
import type { TvShowWithMediaType } from "@/tmdb/models";
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
  const view = parseTvView(sp.view);
  const { title, description } =
    getDiscoverCatalogCopy(sp, "tv") ?? getTvCatalogListCopy(view);

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

export default async function TvShowsCatalogPage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseTvView(sp.view);
  const layoutState = getCatalogLayoutState(sp, view);
  const { title, description } =
    getDiscoverCatalogCopy(sp, "tv") ?? getTvCatalogListCopy(view);
  const timezone = getUserTimezone();
  const catalogQueryParams = toCatalogQueryParams(sp);

  if (view === "discover") {
    const today = getTodayIsoDateUtc();
    const discoverParams = filterDiscoverParams(sp);
    const catalogUrlMerge = buildCatalogDiscoverUrlMerge(sp, "tv");
    const mergedDiscover = { ...discoverParams, ...catalogUrlMerge };
    const [
      { results: trendingRaw },
      catalogResponse,
      { results: popularTvRaw },
    ] = await Promise.all([
      tmdb.trending.tv({ time: "day", page: "1" }),
      tmdb.discover.tv({
        watch_region: TMDB_WATCH_REGION,
        page: sp.page ?? "1",
        sort_by: (sp.sort_by as SortByTypeTv | undefined) ?? "popularity.desc",
        ...mergedDiscover,
        "first_air_date.lte": clampDiscoverTvLte(
          mergedDiscover["first_air_date.lte"],
          today,
        ),
      }),
      tmdb.tv.list({
        list: "popular",
        page: "1",
        region: TMDB_WATCH_REGION,
        timezone,
      }),
    ]);

    const trendingShows = filterReleasedTvShows(trendingRaw);
    const popularTv = filterReleasedTvShows(popularTvRaw);

    const {
      results: showsRaw,
      page: currentPage,
      total_pages: totalPages,
    } = catalogResponse;
    const shows = filterReleasedTvShows(showsRaw);

    const providerResponse = await tmdb.watchProviders.tv({
      region: TMDB_WATCH_REGION,
    });
    const providers = providerResponse.results ?? [];

    const { genres } = await tmdb.genres.tv();

    if (layoutState.isResultsLayout || shows.length === 0) {
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
                  mediaType="tv"
                  title={title}
                  description={description}
                  genres={genres}
                  providers={providers}
                  items={shows.map((s) => ({
                    ...s,
                    media_type: "tv" as const,
                  }))}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  queryParams={catalogQueryParams}
                  emptyTitle="No TV shows found for the selected filters."
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
      trendingShows.length > 0 ? trendingShows : shows.slice(0, 1);
    const heroFeaturedId = heroPool[0]?.id ?? null;

    const showsForRanked =
      heroFeaturedId != null
        ? shows.filter((s) => s.id !== heroFeaturedId)
        : shows;

    const hubTopPicksRow = showsForRanked.slice(0, 12);

    const hubSeen = new Set<number>();
    if (heroFeaturedId != null) hubSeen.add(heroFeaturedId);
    for (const s of hubTopPicksRow) hubSeen.add(s.id);

    const hubTrendingCarousel = takeUniqueByIdInOrder(
      trendingShows,
      hubSeen,
      40,
    );
    const hubTrendingHeroPair = takeUniqueByIdInOrder(
      trendingShows,
      hubSeen,
      2,
    );
    const hubPopularCarousel = takeUniqueByIdInOrder(popularTv, hubSeen, 40);
    const hubPopularHeroPair = takeUniqueByIdInOrder(popularTv, hubSeen, 2);

    const [hubTrendingCarouselEnriched, hubPopularCarouselEnriched] =
      await Promise.all([
        enrichMediaItemsWithLogos(
          hubTrendingCarousel.map((s) => ({
            ...s,
            media_type: "tv" as const,
          })),
          "tv",
        ),
        enrichMediaItemsWithLogos(
          hubPopularCarousel.map((s) => ({
            ...s,
            media_type: "tv" as const,
          })),
          "tv",
        ),
      ]);

    const hubGridItems: MediaItem[] = filterUnseenById(shows, hubSeen).map(
      (s) => ({ ...s, media_type: "tv" as const }),
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <DiscoverFilters
                  type="tv"
                  genres={genres}
                  providers={providers}
                  serverDiscoverFilters={filterDiscoverParams(sp)}
                />
                <DiscoverSort type="tv" />
              </div>

              {heroFeaturedId != null ? (
                <CatalogSpotlight
                  mediaType="tv"
                  id={heroFeaturedId}
                  priority
                  hubLink={pages.tv.catalog.resultsLink}
                  hubButtonLabel="Browse all TV shows"
                  badgeLabel="Trending today"
                />
              ) : null}

              {hubTrendingCarousel.length > 0 ? (
                <TrendCarousel
                  type="tv"
                  title={pages.trending.tv.title}
                  description={pages.trending.tv.description}
                  link={pages.trending.tv.link}
                  items={hubTrendingCarouselEnriched as TvShowWithMediaType[]}
                />
              ) : null}

              {hubTrendingHeroPair.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TvHero
                    tvShows={hubTrendingHeroPair}
                    label="Trending now"
                    count={2}
                    pick="first"
                  />
                </div>
              ) : null}

              {hubTopPicksRow.length > 0 ? (
                <ContentRow
                  variant="ranked"
                  title="Top Picks"
                  items={hubTopPicksRow.map((s) => ({
                    ...s,
                    media_type: "tv" as const,
                  }))}
                  href={pages.tv.catalog.resultsLink}
                />
              ) : null}

              {hubPopularCarousel.length > 0 ? (
                <TrendCarousel
                  type="tv"
                  title="Popular"
                  description={pages.tv.popular.description}
                  link={pages.tv.popular.link}
                  items={hubPopularCarouselEnriched as TvShowWithMediaType[]}
                />
              ) : null}

              {hubPopularHeroPair.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <TvHero
                    tvShows={hubPopularHeroPair}
                    label="Popular now"
                    count={2}
                    pick="first"
                  />
                </div>
              ) : null}

              <CatalogCategoryShowcase
                excludeIds={Array.from(hubSeen)}
                pageKey="tv"
              />

              <CatalogInfiniteGrid
                mediaType="tv"
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
      ? tmdb.trending.tv({
          time: parseTrendingTime(sp.trending_time),
          page: sp.page ?? "1",
        })
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

  const providers = providerResponse.results ?? [];
  const tvItems: MediaItem[] = shows.map((s) => ({
    ...s,
    media_type: "tv" as const,
  }));

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full pb-16 pt-6">
          <div className="container space-y-10">
            <CatalogResultsLayout
              mediaType="tv"
              title={title}
              description={description}
              genres={genres}
              providers={providers}
              items={tvItems}
              currentPage={currentPage}
              totalPages={totalPages}
              queryParams={catalogQueryParams}
              emptyTitle="No TV shows found for this list."
            />
          </div>
        </section>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
