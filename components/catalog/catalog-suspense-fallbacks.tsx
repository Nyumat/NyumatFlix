import { Skeleton } from "@/components/ui/skeleton";

export const CatalogGridFallback = () => (
  <div className="space-y-6" aria-hidden>
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
        <Skeleton className="h-8 w-10 rounded-md" />
        <Skeleton className="h-8 w-10 rounded-md" />
      </div>
    </div>
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
        >
          <Skeleton className="aspect-poster w-full rounded-[28px]" />
        </div>
      ))}
    </div>
  </div>
);

export const CatalogRowFallback = () => (
  <div className="space-y-4" aria-hidden>
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-40 rounded-lg" />
      <div className="hidden gap-2 md:flex">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton
          key={index}
          className="aspect-poster w-[calc(50%-0.5rem)] shrink-0 rounded-[28px] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
        />
      ))}
    </div>
  </div>
);

export const CatalogHeroPairFallback = () => (
  <div className="grid gap-4 md:grid-cols-2" aria-hidden>
    {[0, 1].map((key) => (
      <div
        key={key}
        className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-card/30 shadow-xl backdrop-blur-md"
      >
        <Skeleton className="h-72 w-full rounded-none md:h-80" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-linear-to-t from-black/80 to-transparent p-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-2/3 max-w-xs rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

export const CatalogSpotlightFallback = () => (
  <div
    className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-card/30 shadow-2xl backdrop-blur-md"
    aria-hidden
  >
    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/90 via-background/40 to-background/20" />
    <div className="relative flex h-hero flex-col items-center justify-end gap-4 px-4 pb-8 pt-16 text-center md:gap-5 md:px-8 md:pb-10">
      <Skeleton className="h-6 w-28 rounded-full" />
      <Skeleton className="h-10 w-[min(70%,20rem)] rounded-lg md:h-12" />
      <div className="flex flex-wrap justify-center gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="w-full max-w-xl space-y-2">
        <Skeleton className="mx-auto h-4 w-full rounded-md" />
        <Skeleton className="mx-auto h-4 w-4/5 rounded-md" />
      </div>
      <div className="flex items-center justify-center gap-3 pt-1">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
    </div>
  </div>
);

export const CatalogCollectionsFallback = () => (
  <div className="space-y-6 md:space-y-8" aria-hidden>
    <div className="space-y-2 px-1">
      <Skeleton className="h-7 w-36 rounded-lg" />
      <Skeleton className="h-4 w-full max-w-md rounded-md" />
    </div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      {[0, 1, 2, 3].map((key) => (
        <div
          key={key}
          className="relative space-y-3 overflow-hidden rounded-2xl p-3 sm:space-y-4 sm:p-4"
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <Skeleton className="aspect-poster w-20 shrink-0 rounded-xl sm:w-24" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-6 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2 sm:gap-2.5">
            {[0, 1, 2, 3].map((posterKey) => (
              <Skeleton
                key={posterKey}
                className="aspect-2/3 min-w-0 flex-1 rounded-2xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const TrendingSpotlightFallback = () => (
  <div
    className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-card/40 shadow-2xl backdrop-blur-xl"
    aria-hidden
  >
    <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-background/95 via-background/55 to-background/25" />
    <div className="relative flex min-h-[min(22rem,70vw)] flex-col gap-8 p-4 sm:p-6 md:min-h-80 md:flex-row md:items-stretch md:gap-8 md:p-8">
      <Skeleton className="aspect-poster w-full max-w-[11rem] shrink-0 rounded-2xl md:w-44 lg:w-48" />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-10 w-3/4 max-w-sm rounded-lg" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-5/6 max-w-sm rounded-md" />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);
