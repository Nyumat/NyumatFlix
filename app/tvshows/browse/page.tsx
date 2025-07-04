import { ContentLoader } from "@/components/animated/load-more";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { Suspense } from "react";
import { InfiniteContent } from "./inf-scroll";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    filter?: string;
    type?: string;
    genre?: string;
  };
}) {
  // Use filter parameter if provided, otherwise fall back to type for backward compatibility
  const filterId = searchParams.filter || searchParams.type || "";
  const genre = searchParams.genre || "";

  return (
    <div className="w-full flex flex-col">
      {/* Background - using static position instead of absolute */}
      <StaticHero imageUrl="/movie-banner.jpg" title="" route="" />

      {/* Content area - using flex instead of absolute positioning */}
      <ContentContainer className="w-full flex flex-col items-center z-10">
        {/* Title Area - Center */}
        <div className="text-center my-12 mt-44">
          <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight">
            TV Shows
          </h1>
        </div>

        {/* TV Shows Content Area */}
        <div className="w-full max-w-7xl mx-auto px-4 pb-12">
          <Suspense
            fallback={
              <div className="mb-20">
                <ContentLoader />
              </div>
            }
          >
            <InfiniteContent filterId={filterId} genre={genre} />
          </Suspense>
        </div>
      </ContentContainer>

      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}
