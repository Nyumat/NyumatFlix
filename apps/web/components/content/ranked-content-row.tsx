"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import useMedia from "@/hooks/useMedia";
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

export function RankedContentRow({
  title,
  items: initialItems,
  href,
  showHeader = true,
  bleed = false,
}: RankedContentRowProps) {
  const isMobile = useMedia("(max-width: 768px)", false);
  const items = filterWithPosterPath(initialItems).slice(0, 3);
  const header = showHeader ? (
    <ContentRowHeader bleed={bleed} title={title} href={href} />
  ) : null;

  if (isMobile) {
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
              className="-ml-3"
              viewportClassName={bleed ? "index-rail-padding" : undefined}
            >
              {items.map((item, index) => (
                <CarouselItem
                  key={`${item.id}-${index}`}
                  className="pl-3 basis-[82%] sm:basis-[58%] md:basis-[40%]"
                >
                  <RankedBackdropCard item={item} rank={index + 1} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute -left-3 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 shadow-lg shadow-black/20 transition-all duration-200" />
            <CarouselNext className="absolute -right-3 top-1/2 -translate-y-1/2 bg-card/90 backdrop-blur-md hover:bg-primary/20 border-0 shadow-lg shadow-black/20 transition-all duration-200" />
          </Carousel>
        </div>
      </section>
    );
  }

  return (
    <section className={cn(bleed && "index-bleed")}>
      {header}

      <div
        className={cn(
          "grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6",
          bleed && "index-rail-padding",
        )}
      >
        {items.map((item, index) => (
          <RankedBackdropCard
            key={`${item.id}-${index}`}
            item={item}
            rank={index + 1}
          />
        ))}
      </div>
    </section>
  );
}
