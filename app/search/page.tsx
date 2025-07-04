import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { SearchPageClient } from "@/components/search/search";
import { Suspense } from "react";

export default function SearchPage() {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    console.error("TMDB API key is missing for SearchPage");
    throw new Error(
      "TMDB API key is missing. Search functionality is unavailable.",
    );
  }

  return (
    <div className="w-full flex flex-col">
      {/* Background - using static position instead of absolute */}
      <StaticHero imageUrl="/movie-banner.jpg" title="" route="" />

      {/* Content area - using flex instead of absolute positioning */}
      <ContentContainer className="w-full flex flex-col items-center z-10">
        {/* Title Area */}
        <div className="text-center my-8 mt-20">
          <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight">
            Search
          </h1>
        </div>

        {/* Search input with integrated results */}
        <div className="w-full max-w-6xl mx-auto">
          <Suspense
            fallback={
              <div className="w-full flex flex-col gap-8">
                {/* Search Input Skeleton */}
                <div className="relative max-w-2xl mx-auto">
                  <div className="h-12 bg-muted/30 rounded-xl animate-pulse" />
                </div>
                {/* Loading message */}
                <div className="text-center text-muted-foreground">
                  Loading search...
                </div>
              </div>
            }
          >
            <SearchPageClient />
          </Suspense>
        </div>
      </ContentContainer>
    </div>
  );
}
