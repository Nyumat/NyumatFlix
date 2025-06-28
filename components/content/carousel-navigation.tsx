"use client";

import { UseEmblaCarouselType } from "embla-carousel-react";
import useMedia from "@/hooks/useMedia";

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
          className="absolute -left-4 md:-left-6 top-1/2 -translate-y-1/2 bg-gray-400/30 hover:bg-gray-400/50 p-1.5 rounded-full text-white disabled:opacity-30 z-10 flex"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!emblaApi?.canScrollPrev()}
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
          className="absolute -right-4 md:-right-6 top-1/2 -translate-y-1/2 bg-gray-400/30 hover:bg-gray-400/50 p-1.5 rounded-full text-white disabled:opacity-30 z-10 flex"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!emblaApi?.canScrollNext()}
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
        className="absolute left-0 md:-left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white disabled:opacity-30 z-10 transition-all scale-90 md:scale-100"
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!emblaApi?.canScrollPrev()}
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
        className="absolute right-0 md:-right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white disabled:opacity-30 z-10 transition-all scale-90 md:scale-100"
        onClick={() => emblaApi?.scrollNext()}
        disabled={!emblaApi?.canScrollNext()}
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
