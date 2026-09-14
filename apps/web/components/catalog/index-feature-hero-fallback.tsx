import { Skeleton } from "@/components/ui/skeleton";

export const IndexFeatureHeroFallback = () => (
  <div
    className="index-hero-viewport-bleed relative isolate mb-4 h-[85dvh] overflow-hidden lg:mb-12"
    aria-hidden
  >
    <Skeleton className="absolute inset-0 rounded-none" />
    <div className="absolute inset-0 flex items-end index-rail-padding pb-20 lg:pb-24">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 lg:mx-0 lg:items-start lg:gap-6">
        <Skeleton className="h-24 w-80 max-w-[70vw] rounded-lg md:h-32" />
        <Skeleton className="h-5 w-72 max-w-[70vw] rounded-full" />
        <Skeleton className="h-20 w-[38rem] max-w-full rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);
