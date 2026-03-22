import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { DiscoverFilters, DiscoverSort } from "@/components/discover";
import { MovieHero } from "@/components/movie";
import { TrendCarousel } from "@/components/trend";
import { ListPagination } from "@/components/shared/list-pagination";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { pages } from "@/config";
import type { MovieCatalogView } from "@/lib/catalog-routes";
import { parseMovieView } from "@/lib/catalog-routes";
import { filterDiscoverParams, normalizeRouteSearchParams } from "@/lib/utils";
import { tmdb } from "@/tmdb/api";
import type { SortByTypeMovie } from "@/tmdb/api";
import type { Metadata } from "next";
import { cookies } from "next/headers";

export const revalidate = 3600;

const heroLabel = (view: MovieCatalogView): string => {
  switch (view) {
    case "discover":
      return "Discover";
    case "popular":
      return "Popular";
    case "now_playing":
      return "Now playing";
    case "upcoming":
      return "Upcoming";
    case "top_rated":
      return "Top rated";
    default:
      return "Movies";
  }
};

const getMovieCopy = (view: ReturnType<typeof parseMovieView>) => {
  switch (view) {
    case "discover":
      return {
        title: pages.movie.discover.title,
        description: pages.movie.discover.description,
      };
    case "popular":
      return {
        title: pages.movie.popular.title,
        description: pages.movie.popular.description,
      };
    case "now_playing":
      return {
        title: pages.movie.nowPlaying.title,
        description: pages.movie.nowPlaying.description,
      };
    case "upcoming":
      return {
        title: pages.movie.upcoming.title,
        description: pages.movie.upcoming.description,
      };
    case "top_rated":
      return {
        title: pages.movie.topRated.title,
        description: pages.movie.topRated.description,
      };
    default:
      return {
        title: pages.movie.discover.title,
        description: pages.movie.discover.description,
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
  const view = parseMovieView(sp.view);
  const { title, description } = getMovieCopy(view);

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

export default async function MoviesCatalogPage(props: PageProps) {
  const raw = await props.searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const view = parseMovieView(sp.view);
  const { title, description } = getMovieCopy(view);
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";

  if (view === "discover") {
    const {
      results: movies,
      page: currentPage,
      total_pages: totalPages,
    } = await tmdb.discover.movie({
      watch_region: region,
      page: sp.page ?? "1",
      sort_by: (sp.sort_by as SortByTypeMovie | undefined) ?? "popularity.desc",
      ...filterDiscoverParams(sp),
    });

    const providerResponse = await tmdb.watchProviders.movie({ region });
    const providers = providerResponse.results ?? [];

    const { genres } = await tmdb.genres.movie();

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
                type="movie"
                genres={genres}
                providers={providers}
              />
              <DiscoverSort type="movie" />
            </div>

            {movies.length ? (
              <>
                <MovieHero
                  movies={movies.slice(0, 10)}
                  label={heroLabel(view)}
                  count={1}
                  priority
                />

                <TrendCarousel
                  type="movie"
                  compact
                  showToolbar={false}
                  items={movies.map((m) => ({
                    ...m,
                    media_type: "movie" as const,
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
                  No movies found for the selected filters.
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
    results: movies,
    page: currentPage,
    total_pages: totalPages,
  } = await tmdb.movie.list({
    region,
    list: view,
    page: sp.page ?? "1",
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

          {movies.length ? (
            <>
              <MovieHero
                movies={movies.slice(0, 10)}
                label={heroLabel(view)}
                count={1}
                priority
              />

              <TrendCarousel
                type="movie"
                compact
                showToolbar={false}
                items={movies.map((m) => ({
                  ...m,
                  media_type: "movie" as const,
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
              <p className="font-medium">No movies found for this list.</p>
            </div>
          )}
        </div>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
