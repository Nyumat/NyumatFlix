import { IndexPage } from "@/components/catalog/index-page";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import { CatalogResultsLoading } from "@/components/layout/page-loading/catalog-results-loading";
import {
  MoviesDiscoverContent,
  MoviesDiscoverHubSections,
  MoviesListCatalogSection,
} from "@/components/movies/movies-catalog-sections";
import { MoviesHubFeatureHero } from "@/components/movies/movies-hub-feature-hero";
import { pages } from "@/config/pages";
import { getMoviesCatalogHubFeature } from "@/lib/server/catalog-hub-feature";
import { resolveHubIndexPageBackdrops } from "@/lib/server/hub-index-page";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { parseMovieView, stripCatalogUiParams } from "@/lib/catalog-query";
import { getMovieCatalogListCopy } from "@/lib/catalog-list-copy";
import { getDiscoverCatalogCopy } from "@/lib/discover-page-copy";
import { normalizeRouteSearchParams } from "@/lib/utils";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";
import { Suspense } from "react";

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
    const hubFeature = layoutState.isHubLayout
      ? await getMoviesCatalogHubFeature()
      : null;
    const hubBackdrops = layoutState.isHubLayout
      ? resolveHubIndexPageBackdrops(hubFeature, "movie")
      : null;

    return (
      <IndexPage
        background={layoutState.isHubLayout ? "hub" : "shader"}
        backdrop={hubBackdrops?.backdrop ?? null}
        heroBackdrops={hubBackdrops?.heroBackdrops}
      >
        {layoutState.isHubLayout ? (
          <>
            <Suspense fallback={<IndexFeatureHeroFallback />}>
              <MoviesHubFeatureHero />
            </Suspense>
            <MoviesDiscoverHubSections searchParams={sp} />
          </>
        ) : (
          <Suspense fallback={<CatalogResultsLoading />}>
            <MoviesDiscoverContent
              searchParams={sp}
              title={title}
              description={description ?? ""}
              catalogQueryParams={catalogQueryParams}
              indexHref={indexHref}
            />
          </Suspense>
        )}
      </IndexPage>
    );
  }

  return (
    <IndexPage>
      <Suspense fallback={<CatalogResultsLoading />}>
        <MoviesListCatalogSection
          searchParams={sp}
          title={title}
          description={description ?? ""}
          catalogQueryParams={catalogQueryParams}
          indexHref={indexHref}
        />
      </Suspense>
    </IndexPage>
  );
}
