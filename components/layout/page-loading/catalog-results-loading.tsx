import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { CatalogHubChromeSkeleton } from "@/components/catalog/catalog-chrome-skeletons";
import { PageLoadingShell } from "./page-loading-shell";

type CatalogResultsLoadingProps = {
  withPageContainer?: boolean;
};

export function CatalogResultsLoading({
  withPageContainer = false,
}: CatalogResultsLoadingProps = {}) {
  return (
    <PageLoadingShell withPageContainer={withPageContainer}>
      <section className="min-h-screen w-full bg-background/95 pb-16 pt-12 md:bg-transparent md:pt-16">
        <div className="container space-y-6 md:space-y-10">
          <CatalogHubChromeSkeleton />
          <CatalogGridFallback />
        </div>
      </section>
    </PageLoadingShell>
  );
}
