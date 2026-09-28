"use client";

import {
  Carousel,
  CarouselContent,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { catalogHubRowTrackMinHeightClassName } from "@/lib/carousel-layout";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const catalogHubCarouselContentClassName = "-ml-3 lg:-ml-4";

const catalogHubCarouselArrowBaseClassName =
  "hidden top-1/2 z-20 h-12 w-12 -translate-y-1/2 text-white opacity-0 drop-shadow-lg transition-all duration-300 hover:scale-110 hover:bg-transparent hover:text-white group-hover/row:opacity-100 group-focus-within/row:opacity-100 disabled:pointer-events-none disabled:opacity-0 lg:inline-flex";

export const catalogHubCarouselArrowClassName = (
  bleed: boolean,
  railPadding?: boolean,
  side: "left" | "right" = "left",
) => {
  const useRailPadding = railPadding ?? bleed;
  return cn(
    catalogHubCarouselArrowBaseClassName,
    side === "left"
      ? useRailPadding
        ? "left-2"
        : "left-0"
      : useRailPadding
        ? "right-2"
        : "right-0",
  );
};

type CatalogHubRowCarouselProps = {
  bleed?: boolean;
  railPadding?: boolean;
  children: ReactNode;
};

export function CatalogHubRowCarousel({
  bleed = false,
  railPadding,
  children,
}: CatalogHubRowCarouselProps) {
  const useRailPadding = railPadding ?? bleed;

  return (
    <div className={cn("relative", catalogHubRowTrackMinHeightClassName)}>
      <Carousel
        className="group/row"
        opts={{
          align: "start",
          slidesToScroll: "auto",
          dragFree: true,
          containScroll: "trimSnaps",
        }}
      >
        <CarouselContent
          className={catalogHubCarouselContentClassName}
          viewportClassName={cn(
            useRailPadding ? "index-rail-padding" : undefined,
            "overflow-x-clip overflow-y-visible",
          )}
        >
          {children}
        </CarouselContent>
        <CarouselPrevious
          variant="ghost"
          className={catalogHubCarouselArrowClassName(
            bleed,
            railPadding,
            "left",
          )}
          aria-label="Scroll left"
        />
        <CarouselNext
          variant="ghost"
          className={catalogHubCarouselArrowClassName(
            bleed,
            railPadding,
            "right",
          )}
          aria-label="Scroll right"
        />
      </Carousel>
    </div>
  );
}

type CatalogHubRowProps = {
  ariaLabel: string;
  bleed?: boolean;
  railPadding?: boolean;
  reveal?: boolean;
  busy?: boolean;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function CatalogHubRow({
  ariaLabel,
  bleed = false,
  railPadding,
  reveal = false,
  busy,
  header,
  children,
  className,
}: CatalogHubRowProps) {
  return (
    <section
      aria-label={ariaLabel}
      aria-busy={busy === true ? true : undefined}
      className={cn(
        reveal &&
          "max-lg:animate-none lg:animate-in lg:fade-in lg:slide-in-from-bottom-1 lg:duration-500 lg:fill-mode-both",
        bleed && "index-bleed",
        className,
      )}
    >
      {header}
      <CatalogHubRowCarousel bleed={bleed} railPadding={railPadding}>
        {children}
      </CatalogHubRowCarousel>
    </section>
  );
}

type CatalogHubRowToolbarProps = {
  bleed?: boolean;
  railPadding?: boolean;
  icon?: ReactNode;
  heading?: ReactNode;
  title?: string;
  titleAddon?: ReactNode;
  trailing?: ReactNode;
  toolbar?: boolean;
};

export function CatalogHubRowToolbar({
  bleed = false,
  railPadding,
  icon,
  heading,
  title,
  titleAddon,
  trailing,
  toolbar = false,
}: CatalogHubRowToolbarProps) {
  const useRailPadding = railPadding ?? bleed;
  const hasToolbarLayout = toolbar || Boolean(heading && trailing);

  return (
    <div
      className={cn(
        "content-row-header mb-4 flex min-w-0 gap-3 md:gap-4",
        hasToolbarLayout ? "items-end" : "items-baseline",
        heading && trailing ? "justify-between gap-x-4" : null,
        useRailPadding ? "index-rail-padding" : "px-1 md:px-0",
      )}
    >
      {icon ? <div className="shrink-0">{icon}</div> : null}

      <div
        className={cn(
          "flex gap-2.5",
          heading
            ? "min-w-0 w-fit max-w-full shrink-0 items-baseline"
            : "min-w-0 flex-1 items-baseline",
        )}
      >
        <span className="h-[1.2em] w-1 shrink-0 bg-pink-500" aria-hidden />
        {heading ?? (
          <>
            {title ? (
              <h2 className="min-w-0 truncate whitespace-nowrap text-xl font-semibold tracking-tight md:text-2xl">
                {title}
              </h2>
            ) : null}
            {titleAddon}
          </>
        )}
      </div>

      {trailing}
    </div>
  );
}
