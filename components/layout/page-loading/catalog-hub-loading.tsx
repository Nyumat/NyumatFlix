import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { CatalogHubChromeSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

const catalogHubSectionClassName = "min-h-screen w-full pb-16 pt-14 md:pt-16";

const CatalogHubSections = () => (
  <>
    <CatalogSpotlightFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
  </>
);

const CatalogDiscoverHubSections = () => (
  <>
    <CatalogSpotlightFallback />
    <RecentlyWatchedRowFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
    <CatalogHeroPairFallback />
    <CatalogRowFallback />
  </>
);

type CatalogHubLoadingProps = {
  withPageContainer?: boolean;
};

export function CatalogHubLoading({
  withPageContainer = true,
}: CatalogHubLoadingProps = {}) {
  return (
    <PageLoadingShell withPageContainer={withPageContainer}>
      <section className={catalogHubSectionClassName}>
        <div className="container space-y-10">
          <CatalogHubSections />
        </div>
      </section>
    </PageLoadingShell>
  );
}

export function CatalogDiscoverHubLoading({
  withPageContainer = false,
}: CatalogHubLoadingProps = {}) {
  return (
    <PageLoadingShell withPageContainer={withPageContainer}>
      <section className={catalogHubSectionClassName}>
        <div className="container space-y-10">
          <CatalogHubChromeSkeleton />
          <CatalogDiscoverHubSections />
        </div>
      </section>
    </PageLoadingShell>
  );
}
