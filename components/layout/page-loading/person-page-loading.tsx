import { Skeleton } from "@/components/ui/skeleton";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { PageLoadingShell } from "./page-loading-shell";

export function PersonPageLoading() {
  return (
    <PageLoadingShell>
      <div className="container max-w-7xl space-y-8 px-2 pb-12 pt-14 sm:px-4 md:pt-16">
        <div className="space-y-3">
          <Skeleton className="h-10 w-72 max-w-full rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <CatalogGridFallback />
      </div>
    </PageLoadingShell>
  );
}
