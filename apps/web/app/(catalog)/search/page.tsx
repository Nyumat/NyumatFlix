import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
import { SearchPageClient } from "@/components/search/search";
import { Suspense } from "react";

export default function SearchPage() {
  return (
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" />
      <ContentContainer className="z-10 flex w-full flex-col items-center pt-12">
        <div className="index-container">
          <div className="my-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
              Search
            </h1>
          </div>
          <div className="mx-auto w-full max-w-[68rem]">
            <Suspense
              fallback={
                <div className="flex w-full flex-col gap-8">
                  <div className="relative mx-auto w-full max-w-2xl">
                    <div className="h-12 animate-pulse rounded-xl bg-muted/30" />
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
        </div>
      </ContentContainer>
    </div>
  );
}
