import { CatalogInfiniteGrid } from "@/components/catalog/catalog-infinite-grid";
import { SilkShaderBackground } from "@/components/hero/silk-shader-background";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { ProviderLogoMark } from "@/components/provider/provider-logo-mark";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { cn } from "@/lib/utils";
import type { WatchProviderBrand } from "@/lib/watch-providers";
import {
  getTodayIsoDateUtc,
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import type { MediaItem } from "@/lib/domain/typings";
import { tmdb } from "@/tmdb/api";
import Link from "next/link";

type ProviderMediaType = "movie" | "tv";

export type ProviderCatalogData = {
  items: MediaItem[];
  currentPage: number;
  totalPages: number;
};

export async function getProviderCatalog(
  providerId: number,
  mediaType: ProviderMediaType,
): Promise<ProviderCatalogData> {
  const provider = String(providerId);
  const today = getTodayIsoDateUtc();

  if (mediaType === "movie") {
    const response = await tmdb.discover.movie({
      watch_region: TMDB_WATCH_REGION,
      with_watch_providers: provider,
      page: "1",
      sort_by: "popularity.desc",
      "primary_release_date.lte": today,
    });
    const movies = filterReleasedMovies(response.results ?? []);

    return {
      items: slimMediaItemsForRsc(
        movies.map((movie) => ({ ...movie, media_type: "movie" as const })),
      ),
      currentPage: response.page,
      totalPages: response.total_pages,
    };
  }

  const response = await tmdb.discover.tv({
    watch_region: TMDB_WATCH_REGION,
    with_watch_providers: provider,
    page: "1",
    sort_by: "popularity.desc",
    "first_air_date.lte": today,
  });
  const shows = filterReleasedTvShows(response.results ?? []);

  return {
    items: slimMediaItemsForRsc(
      shows.map((show) => ({ ...show, media_type: "tv" as const })),
    ),
    currentPage: response.page,
    totalPages: response.total_pages,
  };
}

const providerTypeHref = (providerId: number, mediaType: ProviderMediaType) =>
  `/providers/${providerId}?type=${mediaType}`;

const switcherItemClass = (active: boolean) =>
  cn(
    "flex h-10 min-w-24 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors sm:min-w-28",
    active
      ? "bg-white/95 text-black shadow-sm shadow-black/25"
      : "text-white/65 hover:bg-white/10 hover:text-white",
  );

function ProviderShaderBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-background"
    >
      <SilkShaderBackground className="h-full w-full opacity-65" />
      <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/72 to-background" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}

type ProviderCatalogPageProps = {
  provider: WatchProviderBrand;
  mediaType: ProviderMediaType;
  catalog: ProviderCatalogData;
};

export function ProviderCatalogPage({
  provider,
  mediaType,
  catalog,
}: ProviderCatalogPageProps) {
  return (
    <PageContainer>
      <main className="relative isolate min-h-screen overflow-hidden bg-background text-white">
        <ProviderShaderBackdrop />
        <ContentContainer
          topSpacing={false}
          className="relative z-10 flex w-full flex-col items-center"
        >
          <section className="min-h-screen w-full pb-20 pt-28 sm:pt-32 md:pt-36">
            <div className="index-container space-y-8 md:space-y-10 lg:space-y-12">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <header className="flex min-w-0 items-center gap-4 sm:gap-5">
                  <ProviderLogoMark
                    provider={provider}
                    className="size-16 shrink-0 rounded-[20px] sm:size-20 md:size-24 md:rounded-[26px]"
                  />
                  <h1 className="min-w-0 text-3xl font-black leading-none text-white drop-shadow-2xl sm:text-4xl md:text-6xl">
                    {provider.name}
                  </h1>
                </header>

                <nav
                  aria-label={`${provider.name} catalog type`}
                  className="inline-flex w-fit rounded-full border border-white/12 bg-black/40 p-1 shadow-lg shadow-black/20 backdrop-blur-md"
                >
                  <Link
                    href={providerTypeHref(provider.id, "movie")}
                    aria-current={mediaType === "movie" ? "page" : undefined}
                    className={switcherItemClass(mediaType === "movie")}
                  >
                    Movies
                  </Link>
                  <Link
                    href={providerTypeHref(provider.id, "tv")}
                    aria-current={mediaType === "tv" ? "page" : undefined}
                    className={switcherItemClass(mediaType === "tv")}
                  >
                    Series
                  </Link>
                </nav>
              </div>

              {catalog.items.length > 0 ? (
                <CatalogInfiniteGrid
                  mediaType={mediaType}
                  initialItems={catalog.items}
                  initialPage={catalog.currentPage}
                  totalPages={catalog.totalPages}
                  queryParams={{
                    with_watch_providers: String(provider.id),
                  }}
                  showViewModeControls={false}
                />
              ) : (
                <div className="rounded-3xl border border-white/12 bg-black/20 p-12 text-center text-white/75 backdrop-blur-md">
                  No {mediaType === "movie" ? "movies" : "series"} found for
                  this provider.
                </div>
              )}
            </div>
          </section>
        </ContentContainer>
      </main>
      <ScrollToTop />
    </PageContainer>
  );
}
