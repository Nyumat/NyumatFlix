import { Skeleton } from "@/components/ui/skeleton";
import { CatalogGridFallback } from "@/components/catalog/catalog-suspense-fallbacks";
import { PageLoadingShell } from "./page-loading-shell";

export function BrowseGridLoading() {
  return (
    <PageLoadingShell className="pb-16">
      <div className="container max-w-7xl space-y-8 px-4 py-14">
        <Skeleton className="h-10 w-56 rounded-lg" />
        <CatalogGridFallback />
      </div>
    </PageLoadingShell>
  );
}
