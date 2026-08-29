import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  TrendingSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "./page-loading-shell";

export function TrendingHubLoading() {
  return (
    <PageLoadingShell withPageContainer={false}>
      <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
        <div className="container space-y-10">
          <header className="space-y-1 text-center md:text-left" aria-hidden>
            <Skeleton className="mx-auto h-9 w-40 rounded-lg sm:h-10 md:mx-0 md:h-12" />
          </header>

          <TrendingSpotlightFallback />
          <CatalogRowFallback />
          <CatalogHeroPairFallback />
          <CatalogRowFallback />
          <CatalogHeroPairFallback />
          <CatalogRowFallback />
        </div>
      </section>
    </PageLoadingShell>
  );
}
