"use client";

import {
  carouselItemClassName,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type CatalogRankedRowFallbackProps = {
  bleed?: boolean;
};

export function CatalogRankedRowFallback({
  bleed = false,
}: CatalogRankedRowFallbackProps = {}) {
  const catalogCardStyle = useCatalogCardStyle();
  const isWide = catalogCardStyle === "backdrop";
  const itemClassName = carouselItemClassName(catalogCardStyle);

  return (
    <section className={cn(bleed && "index-bleed")} aria-hidden>
      <div
        className={cn(
          "content-row-header mb-4 flex items-baseline justify-between gap-3",
          bleed ? "index-rail-padding" : "px-1 md:px-0",
        )}
      >
        <Skeleton
          className={cn("rounded-lg", bleed ? "h-8 w-64" : "h-6 w-40")}
        />
        <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
      </div>

      {isWide ? (
        <Carousel
          opts={{
            align: "start",
            dragFree: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent
            className="-ml-3 lg:-ml-4"
            viewportClassName={bleed ? "index-rail-padding" : undefined}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <CarouselItem key={index} className={itemClassName}>
                <div className="relative">
                  <Skeleton className="aspect-video w-full rounded-lg" />
                  <Skeleton className="absolute left-0 top-0 h-14 w-11 rounded-none" />
                  <div className="mt-2 space-y-1.5">
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6",
            bleed && "index-rail-padding",
          )}
        >
          {[1, 2, 3].map((rank) => (
            <div key={rank} className="relative overflow-hidden rounded-2xl">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="absolute left-3 top-3 size-8 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
