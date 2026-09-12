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
      <section className="min-h-screen w-full pb-16 pt-8 md:pt-12">
        <div className="index-container space-y-6 md:space-y-10">
          <CatalogHubChromeSkeleton />
          <CatalogGridFallback />
        </div>
      </section>
    </PageLoadingShell>
  );
}
