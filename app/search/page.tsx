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
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="w-full flex flex-col items-center z-10">
        <div className="text-center my-12">
          <h1 className="text-4xl md:text-7xl font-bold text-foreground tracking-tight">
            Search
          </h1>
        </div>
        <div className="w-full max-w-6xl mx-auto">
          <Suspense
            fallback={
              <div className="w-full flex flex-col gap-8">
                <div className="relative max-w-2xl mx-auto">
                  <div className="h-12 bg-muted/30 rounded-xl animate-pulse" />
                </div>
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
