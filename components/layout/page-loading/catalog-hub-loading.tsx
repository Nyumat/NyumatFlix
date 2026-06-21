import {
  CatalogHeroPairFallback,
  CatalogRowFallback,
  CatalogSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { PageLoadingShell } from "./page-loading-shell";

export function CatalogHubLoading() {
  return (
    <PageLoadingShell>
      <section className="min-h-screen w-full pb-16 pt-14 md:pt-16">
        <div className="container space-y-10">
          <CatalogSpotlightFallback />
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
