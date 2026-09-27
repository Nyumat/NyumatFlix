"use client";

import { CatalogHubRow } from "@/components/catalog/catalog-hub-row";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  carouselItemClassName,
  filterCatalogCardArt,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { ContentRowHeader } from "./content-row-header";
import { RankedBackdropCard } from "./ranked-backdrop-card";

export interface RankedContentRowProps {
  title: string;
  items: MediaItem[];
  href: string;
  showHeader?: boolean;
  bleed?: boolean;
}

const WIDE_RANKED_LIMIT = 10;
const POSTER_RANKED_LIMIT = 10;

export function RankedContentRow({
  title,
  items: initialItems,
  href,
  showHeader = true,
  bleed = false,
}: RankedContentRowProps) {
  const catalogCardStyle = useCatalogCardStyle();
  const isWideCatalogRanked = catalogCardStyle === "backdrop";

  const items = isWideCatalogRanked
    ? filterCatalogCardArt(initialItems, "backdrop").slice(0, WIDE_RANKED_LIMIT)
    : filterWithPosterPath(initialItems).slice(0, POSTER_RANKED_LIMIT);

  const header = showHeader ? (
    <ContentRowHeader bleed={bleed} title={title} href={href} />
  ) : null;

  if (isWideCatalogRanked) {
    return (
      <CatalogHubRow ariaLabel={title} bleed={bleed} header={header}>
        {items.map((item, index) => (
          <CarouselItem
            key={`${item.id}-${index}`}
            className={carouselItemClassName("backdrop")}
          >
            <RankedBackdropCard item={item} rank={index + 1} variant="ribbon" />
          </CarouselItem>
        ))}
      </CatalogHubRow>
    );
  }

  return (
    <section className={cn(bleed && "index-bleed")}>
      {header}
      <div className="relative">
        <Carousel
          opts={{
            align: "start",
            loop: false,
            dragFree: true,
            skipSnaps: true,
            containScroll: "trimSnaps",
          }}
          className="w-full"
        >
          <CarouselContent
            className="-ml-3 lg:-ml-4"
            viewportClassName={bleed ? "index-rail-padding" : undefined}
          >
            {items.map((item, index) => (
              <CarouselItem
                key={`${item.id}-${index}`}
                className="basis-[82%] pl-3 sm:basis-[58%] md:basis-1/3 lg:pl-4"
              >
                <RankedBackdropCard item={item} rank={index + 1} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="absolute top-1/2 -left-3 -translate-y-1/2 border-0 bg-card/90 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:bg-primary/20 md:-left-2" />
          <CarouselNext className="absolute top-1/2 -right-3 -translate-y-1/2 border-0 bg-card/90 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-200 hover:bg-primary/20 md:-right-2" />
        </Carousel>
      </div>
    </section>
  );
}
