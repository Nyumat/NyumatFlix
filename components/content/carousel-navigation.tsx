"use client";

import useMedia from "@/hooks/useMedia";
import { UseEmblaCarouselType } from "embla-carousel-react";

interface CarouselNavigationProps {
  emblaApi: UseEmblaCarouselType[1] | undefined;
  variant?: "standard" | "ranked";
}

export function CarouselNavigation({
  emblaApi,
  variant = "standard",
}: CarouselNavigationProps) {
  const isMobile = useMedia("(max-width: 768px)", false);

  if (variant === "ranked" && !isMobile) {
    return (
      <>
        <button
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!emblaApi?.canScrollPrev()}
          className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm p-1.5 rounded-full text-foreground disabled:opacity-30 z-10 flex border border-border"
          aria-label="Previous items"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          disabled={!emblaApi?.canScrollNext()}
          className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm p-1.5 rounded-full text-foreground disabled:opacity-30 z-10 flex border border-border"
          aria-label="Next items"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!emblaApi?.canScrollPrev()}
        className="absolute left-0 md:-left-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm p-2 rounded-full text-foreground disabled:opacity-30 z-10 transition-all scale-90 md:scale-100 border border-border"
        aria-label="Previous items"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 19l-7-7 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        onClick={() => emblaApi?.scrollNext()}
        disabled={!emblaApi?.canScrollNext()}
        className="absolute right-0 md:-right-3 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90 backdrop-blur-sm p-2 rounded-full text-foreground disabled:opacity-30 z-10 transition-all scale-90 md:scale-100 border border-border"
        aria-label="Next items"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5l7 7-7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
