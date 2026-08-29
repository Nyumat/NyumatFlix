import { Skeleton } from "@/components/ui/skeleton";
import {
  CatalogRowFallback,
  RecentlyWatchedRowFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";

export const AnimeHeroFallback = () => (
  <div
    className="relative isolate h-[min(58vh,31rem)] min-h-[27rem] overflow-hidden rounded-3xl md:h-hero md:min-h-0"
    aria-hidden
  >
    <Skeleton className="absolute inset-0 rounded-3xl" />
    <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 pb-5 md:gap-4 md:p-8 md:pb-8 lg:p-10">
      <Skeleton className="h-6 w-24 rounded-full" />
      <Skeleton className="h-10 w-48 max-w-[70%] rounded-lg md:h-12" />
      <div className="flex items-center justify-center gap-3">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  </div>
);

export const AnimeHubSectionsFallback = () => (
  <>
    <AnimeHeroFallback />
    <RecentlyWatchedRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
    <CatalogRowFallback />
  </>
);
