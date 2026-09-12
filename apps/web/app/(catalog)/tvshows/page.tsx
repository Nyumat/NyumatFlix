import { IndexPage } from "@/components/catalog/index-page";
import { CatalogDiscoverHubLoading } from "@/components/layout/page-loading/catalog-hub-loading";
import { CatalogResultsLoading } from "@/components/layout/page-loading/catalog-results-loading";
import {
  TvDiscoverContent,
  getTvHubFeature,
  TvListCatalogSection,
} from "@/components/tv/tv-catalog-sections";
import { pages } from "@/config/pages";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import { parseTvView, stripCatalogUiParams } from "@/lib/catalog-query";
import { getTvCatalogListCopy } from "@/lib/catalog-list-copy";
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
  const view = parseTvView(sp.view);
  const { title, description } =
    getDiscoverCatalogCopy(sp, "tv") ?? getTvCatalogListCopy(view);

  return buildCatalogMetadata({
    title,
    description: description || undefined,
    path: pages.tv.catalog.link,
  });
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
  const catalogQueryParams = toCatalogQueryParams(sp);
  const indexHref = Object.keys(sp).length > 0 ? pages.tv.root.link : undefined;
  const hubFeature = layoutState.isHubLayout ? await getTvHubFeature() : null;
  const backdrop = hubFeature?.backdrop ?? null;

  if (view === "discover") {
    return (
      <IndexPage backdrop={backdrop}>
        <Suspense fallback={<CatalogDiscoverHubLoading />}>
          <TvDiscoverContent
            searchParams={sp}
            title={title}
            description={description ?? ""}
            catalogQueryParams={catalogQueryParams}
            indexHref={indexHref}
            feature={hubFeature?.item ?? null}
          />
        </Suspense>
      </IndexPage>
    );
  }

  return (
    <IndexPage>
      <Suspense fallback={<CatalogResultsLoading />}>
        <TvListCatalogSection
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
