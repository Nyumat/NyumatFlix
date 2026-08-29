import { CatalogDiscoverHubLoading } from "@/components/layout/page-loading/catalog-hub-loading";
import { CatalogResultsLoading } from "@/components/layout/page-loading/catalog-results-loading";
import { QueryPageHeader } from "@/components/catalog/query-page-header";
import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import {
  MoviesDiscoverContent,
  MoviesDiscoverToolbarFallback,
  MoviesDiscoverToolbarSection,
  MoviesListCatalogSection,
} from "@/components/movies/movies-catalog-sections";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { pages } from "@/config/pages";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { parseMovieView, stripCatalogUiParams } from "@/lib/catalog-query";
import { getMovieCatalogListCopy } from "@/lib/catalog-list-copy";
import { getDiscoverCatalogCopy } from "@/lib/discover-page-copy";
import { normalizeRouteSearchParams } from "@/lib/utils";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";
import { Suspense } from "react";

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

  return buildCatalogMetadata({
    title,
    description: description || undefined,
    path: pages.movie.catalog.link,
  });
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
  const indexHref =
    Object.keys(sp).length > 0 ? pages.movie.root.link : undefined;

  if (view === "discover") {
    return (
      <div className="flex w-full flex-col">
        <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

        <ContentContainer className="relative z-10 flex w-full flex-col items-center">
          <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
            <div className="container space-y-10">
              {layoutState.isHubLayout ? (
                <>
                  <QueryPageHeader
                    title={title}
                    description={description ?? ""}
                    backHref={indexHref}
                  />

                  <Suspense fallback={<MoviesDiscoverToolbarFallback />}>
                    <MoviesDiscoverToolbarSection searchParams={sp} />
                  </Suspense>
                </>
              ) : null}

              <Suspense fallback={<CatalogDiscoverHubLoading />}>
                <MoviesDiscoverContent
                  searchParams={sp}
                  title={title}
                  description={description ?? ""}
                  catalogQueryParams={catalogQueryParams}
                  indexHref={indexHref}
                />
              </Suspense>
            </div>
          </section>
        </ContentContainer>

        <ScrollToTop />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <section className="min-h-screen w-full bg-background/95 pb-16 pt-12 md:bg-transparent md:pt-16">
          <div className="container space-y-6 md:space-y-10">
            <Suspense fallback={<CatalogResultsLoading />}>
              <MoviesListCatalogSection
                searchParams={sp}
                title={title}
                description={description ?? ""}
                catalogQueryParams={catalogQueryParams}
                indexHref={indexHref}
              />
            </Suspense>
          </div>
        </section>
      </ContentContainer>

      <ScrollToTop />
    </div>
  );
}
