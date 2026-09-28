"use client";

import { CatalogCarouselTileSkeleton } from "@/components/catalog/catalog-card-skeletons";
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

type CatalogPosterRowFallbackProps = {
  bleed?: boolean;
  /** Viewport rail padding without wrapping the row in `index-bleed`. */
  railPadding?: boolean;
  /** Poster strip only — row header is rendered elsewhere (e.g. static provider toolbar). */
  hideHeader?: boolean;
};

export function CatalogPosterRowFallback({
  bleed = false,
  railPadding = false,
  hideHeader = false,
}: CatalogPosterRowFallbackProps = {}) {
  const catalogCardStyle = useCatalogCardStyle();
  const itemClassName = carouselItemClassName(catalogCardStyle);
  const useRailPadding = railPadding || bleed;

  return (
    <section className={cn(bleed && "index-bleed")} aria-hidden>
      {hideHeader ? null : (
        <div
          className={cn(
            "content-row-header mb-4 flex items-baseline justify-between gap-3",
            bleed || useRailPadding ? "index-rail-padding" : "px-1 md:px-0",
          )}
        >
          <Skeleton
            className={cn("rounded-lg", bleed ? "h-8 w-64" : "h-6 w-40")}
          />
          <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
        </div>
      )}
      <div className={cn("relative", hideHeader && "mt-0")}>
        <Carousel
          opts={{
            align: "start",
            loop: false,
            dragFree: true,
            skipSnaps: true,
          }}
          className="w-full"
        >
          <CarouselContent
            viewportClassName={
              useRailPadding ? "index-rail-padding" : "md:mx-0"
            }
            className="-ml-3 lg:-ml-4"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <CarouselItem key={index} className={itemClassName}>
                <CatalogCarouselTileSkeleton style={catalogCardStyle} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
