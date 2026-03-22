import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { DiscoverFilters, DiscoverSort } from "@/components/discover";
import { ListPagination } from "@/components/shared/list-pagination";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { TvHero } from "@/components/tv";
import { TrendCarousel } from "@/components/trend";
import { pages } from "@/config";
import type { TvCatalogView } from "@/lib/catalog-routes";
import { parseTvView } from "@/lib/catalog-routes";
import {
  filterDiscoverParams,
  getUserTimezone,
  normalizeRouteSearchParams,
} from "@/lib/utils";
import { tmdb } from "@/tmdb/api";
import type { SortByTypeTv } from "@/tmdb/api";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const revalidate = 3600;

const heroLabel = (view: TvCatalogView): string => {
  switch (view) {
    case "discover":
      return "Discover";
    case "popular":
      return "Popular";
    case "on_the_air":
      return "On the air";
    case "airing_today":
      return "Airing today";
    case "top_rated":
      return "Top rated";
    default:
      return "TV";
  }
};

const getTvCopy = (view: ReturnType<typeof parseTvView>) => {
  switch (view) {
    case "discover":
      return {
        title: pages.tv.discover.title,
        description: pages.tv.discover.description,
      };
    case "popular":
      return {
        title: pages.tv.popular.title,
        description: pages.tv.popular.description,
      };
    case "on_the_air":
      return {
        title: pages.tv.onTheAir.title,
        description: pages.tv.onTheAir.description,
      };
    case "airing_today":
      return {
        title: pages.tv.airingToday.title,
        description: pages.tv.airingToday.description,
      };
    case "top_rated":
      return {
        title: pages.tv.topRated.title,
        description: pages.tv.topRated.description,
      };
    default:
      return {
        title: pages.tv.discover.title,
        description: pages.tv.discover.description,
      };
  }
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseTvView(sp.view);
  const { title, description } = getTvCopy(view);

  return {
    title: `${title} | NyumatFlix`,
    description,
    openGraph: {
      title: `${title} | NyumatFlix`,
      description,
      type: "website",
      siteName: "NyumatFlix",
    },
  };
}

export default async function TvShowsCatalogPage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseTvView(sp.view);
  const { title, description } = getTvCopy(view);
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";
  const timezone = getUserTimezone();

  if (view === "discover") {
    const {
      results: shows,
      page: currentPage,
      total_pages: totalPages,
    } = await tmdb.discover.tv({
      watch_region: region,
      page: sp.page ?? "1",
      sort_by: (sp.sort_by as SortByTypeTv | undefined) ?? "popularity.desc",
      ...filterDiscoverParams(sp),
    });

    const providerResponse = await tmdb.watchProviders.tv({ region });
    const providers = providerResponse.results ?? [];

    const { genres } = await tmdb.genres.tv();

    return (
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <div className="w-full max-w-7xl space-y-6 px-2 pb-12 sm:px-4">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                {title}
              </h1>
              <p className="mt-2 text-muted-foreground">{description}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <DiscoverFilters
                type="tv"
                genres={genres}
                providers={providers}
              />
              <DiscoverSort type="tv" />
            </div>

            {shows.length ? (
              <>
                <TvHero
                  tvShows={shows.slice(0, 10)}
                  label={heroLabel(view)}
                  count={1}
                  priority
                />

                <TrendCarousel
                  type="tv"
                  compact
                  showToolbar={false}
                  items={shows.map((s) => ({
                    ...s,
                    media_type: "tv" as const,
                  }))}
                />

                {totalPages > 1 && (
                  <div className="flex justify-center pt-2">
                    <ListPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="font-medium">
                  No TV shows found for the selected filters.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try removing some filters or sorting differently.
                </p>
              </div>
            )}
          </div>
        </ContentContainer>

        <ScrollToTop />
      </div>
    );
  }

  const {
    results: shows,
    page: currentPage,
    total_pages: totalPages,
  } = await tmdb.tv.list({
    region,
    list: view,
    page: sp.page ?? "1",
    timezone,
  });

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <div className="w-full max-w-7xl space-y-6 px-2 pb-12 sm:px-4">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h1>
            <p className="mt-2 text-muted-foreground">{description}</p>
          </div>

          {shows.length ? (
            <>
              <TvHero
                tvShows={shows.slice(0, 10)}
                label={heroLabel(view)}
                count={1}
                priority
              />

              <TrendCarousel
                type="tv"
                compact
                showToolbar={false}
                items={shows.map((s) => ({
                  ...s,
                  media_type: "tv" as const,
                }))}
              />

              {totalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <ListPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <p className="font-medium">No TV shows found for this list.</p>
            </div>
          )}
        </div>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
