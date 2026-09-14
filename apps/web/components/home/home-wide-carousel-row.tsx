"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  carouselItemClassName,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { wideCarouselItemClassName } from "@/lib/carousel-layout";
import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

export const homeWideCarouselItemClassName = wideCarouselItemClassName;

type HomeWideCarouselRowProps<T> = {
  ariaLabel: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
  items: T[];
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

export function HomeWideCarouselRow<T>({
  ariaLabel,
  title,
  description,
  actionHref,
  actionLabel = "View all",
  action,
  items,
  getItemKey,
  renderItem,
}: HomeWideCarouselRowProps<T>) {
  const catalogCardStyle = useCatalogCardStyle();
  const itemClassName = carouselItemClassName(catalogCardStyle);

  return (
    <section
      aria-label={ariaLabel}
      className="index-bleed animate-in fade-in slide-in-from-bottom-1 duration-500 fill-mode-both"
    >
      <Carousel
        className="group/row"
        opts={{
          align: "start",
          slidesToScroll: "auto",
          dragFree: true,
          containScroll: "trimSnaps",
        }}
      >
        <div className="index-rail-padding mb-4 flex items-baseline justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
              {title}
            </h2>
            {description ? <p className="sr-only">{description}</p> : null}
          </div>

          {action ??
            (actionHref ? (
              <Link
                href={actionHref}
                className={contentRowActionLinkClassName}
                prefetch={false}
              >
                <span>{actionLabel}</span>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null)}
        </div>

        <CarouselContent
          className="-ml-3 lg:-ml-4"
          viewportClassName="index-rail-padding"
        >
          {items.map((item, index) => (
            <CarouselItem
              key={getItemKey(item, index)}
              className={itemClassName}
            >
              {renderItem(item, index)}
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious
          variant="ghost"
          className="hidden left-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex"
          aria-label="Scroll left"
        />
        <CarouselNext
          variant="ghost"
          className="hidden right-2 top-1/2 z-20 h-11 w-11 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex"
          aria-label="Scroll right"
        />
      </Carousel>
    </section>
  );
}
