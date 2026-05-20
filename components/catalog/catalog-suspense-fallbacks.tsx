export const CatalogGridFallback = () => (
  <div className="space-y-6" aria-hidden>
    <div className="flex items-center justify-between">
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-1 rounded-lg border p-1">
        <div className="h-8 w-10 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-10 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 10 }).map((_, index) => (
        <div
          key={index}
          className="w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
        >
          <div className="aspect-poster animate-pulse rounded-[28px] bg-muted" />
        </div>
      ))}
    </div>
  </div>
);

export const CatalogRowFallback = () => (
  <div className="space-y-4" aria-hidden>
    <div className="flex items-center justify-between">
      <div className="h-6 w-40 animate-pulse rounded-md bg-muted" />
      <div className="hidden gap-2 md:flex">
        <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="aspect-poster w-[calc(50%-0.5rem)] shrink-0 animate-pulse rounded-[28px] bg-muted md:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
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
        className="h-72 animate-pulse rounded-2xl bg-muted md:h-80"
      />
    ))}
  </div>
);

export const CatalogSpotlightFallback = () => (
  <div
    className="min-h-[min(22rem,70vw)] animate-pulse rounded-2xl bg-muted md:min-h-80"
    aria-hidden
  />
);
