import {
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { CatalogHubChromeSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

const catalogHubSectionClassName = "min-h-screen w-full pb-16 pt-8 md:pt-12";

const CatalogHubSections = () => (
  <>
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
  </>
);

const CatalogDiscoverHubSections = () => (
  <>
    <RecentlyWatchedRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
    <CatalogRowFallback bleed />
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
        <div className="index-container space-y-8 md:space-y-10 lg:space-y-12">
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
        <div className="index-container space-y-8 md:space-y-10 lg:space-y-12">
          <CatalogHubChromeSkeleton />
          <CatalogDiscoverHubSections />
        </div>
      </section>
    </PageLoadingShell>
  );
}
