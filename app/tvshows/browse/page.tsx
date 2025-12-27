import { Metadata } from "next";
import { Suspense } from "react";
import { ContentLoader } from "@/components/animated/load-more";
import { getGenreName } from "@/components/content/genre-helpers";
import { StaticHero } from "@/components/hero/carousel-static";
import { ContentContainer } from "@/components/layout/content-container";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { getFilterTitle } from "@/utils/content-filters";
import { InfiniteContent } from "./inf-scroll";

interface PageProps {
  searchParams: Promise<{
    filter?: string;
    type?: string;
    genre?: string;
    year?: string;
  }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const genre = searchParams.genre || "";
  const year = searchParams.year || "";
  const filterId = searchParams.filter || searchParams.type || "";

  // Generate dynamic title based on parameters
  const getPageTitle = () => {
    // Handle year filtering
    if (year) {
      return getFilterTitle("", year, "tv");
    }

    // Handle genre filtering
    if (genre) {
      const genreId = parseInt(genre, 10);
      if (!isNaN(genreId)) {
        const genreName = getGenreName(genreId, "tv");
        if (genreName !== "Unknown") {
          return `${genreName} TV Shows`;
        }
      }
    }

    // Handle filter-based titles
    if (filterId) {
      return getFilterTitle(filterId, undefined, "tv");
    }

    return "TV Shows";
  };

  const pageTitle = getPageTitle();
  const description =
    genre || year || filterId
      ? `Discover the best ${pageTitle.toLowerCase()} on NyumatFlix`
      : "Discover your next binge-worthy series on NyumatFlix";

  return {
    title: `${pageTitle} | NyumatFlix`,
    description,
    openGraph: {
      title: `${pageTitle} | NyumatFlix`,
      description,
      type: "website",
      siteName: "NyumatFlix",
    },
    twitter: {
      title: `${pageTitle} | NyumatFlix`,
      description,
    },
  };
}

export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  // Use filter parameter if provided, otherwise fall back to type for backward compatibility
  const filterId = searchParams.filter || searchParams.type || "";
  const genre = searchParams.genre || "";
  const year = searchParams.year || "";

  // Generate dynamic title based on parameters
  const getPageTitle = () => {
    // Handle year filtering
    if (year) {
      return getFilterTitle("", year, "tv");
    }

    // Handle genre filtering
    if (genre) {
      const genreId = parseInt(genre, 10);
      if (!isNaN(genreId)) {
        const genreName = getGenreName(genreId, "tv");
        if (genreName !== "Unknown") {
          return `${genreName} TV Shows`;
        }
      }
    }

    // Handle filter-based titles
    if (filterId) {
      return getFilterTitle(filterId, undefined, "tv");
    }

    return "TV Shows";
  };

  const pageTitle = getPageTitle();

  return (
    <div className="w-full flex flex-col">
      {/* Background - using static position instead of absolute */}
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      {/* Content area - using flex instead of absolute positioning */}
      <ContentContainer className="w-full flex flex-col items-center z-10">
        {/* Title Area - Center */}
        <div className="text-center my-6 sm:my-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
            {pageTitle}
          </h1>
        </div>

        {/* TV Shows Content Area */}
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pb-8 sm:pb-12">
          <Suspense
            fallback={
              <div className="mb-20">
                <ContentLoader />
              </div>
            }
          >
            <InfiniteContent filterId={filterId} genre={genre} year={year} />
          </Suspense>
        </div>
      </ContentContainer>

      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}
