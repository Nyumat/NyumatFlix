import { ContentLoader } from "@/components/animated/load-more";
import { getGenreName } from "@/components/content/genre-helpers";
import { StaticHero } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { BackButton } from "@/components/ui/back-button";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { getFilterTitle } from "@/utils/content-filters";
import { Metadata } from "next";
import { Suspense } from "react";
import { FilteredMovieContent } from "./filtered-content";

interface PageProps {
  searchParams: {
    filter?: string;
    type?: string;
    genre?: string;
    year?: string;
    director?: string;
    studio?: string;
  };
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const genre = searchParams.genre || "";
  const year = searchParams.year || "";
  const filterId = searchParams.filter || searchParams.type || "";

  // Generate dynamic title based on parameters
  const getPageTitle = () => {
    // Handle year filtering
    if (year) {
      return getFilterTitle("", year, "movie");
    }

    // Handle genre filtering
    if (genre) {
      const genreId = parseInt(genre, 10);
      if (!isNaN(genreId)) {
        const genreName = getGenreName(genreId, "movie");
        if (genreName !== "Unknown") {
          return `${genreName} Movies`;
        }
      }
    }

    // Handle filter-based titles
    if (filterId) {
      return getFilterTitle(filterId, undefined, "movie");
    }

    return "Movies";
  };

  const pageTitle = getPageTitle();
  const description =
    genre || year || filterId
      ? `Discover the best ${pageTitle.toLowerCase()} on NyumatFlix`
      : "Discover popular and top-rated movies on NyumatFlix";

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

export default async function Page({ searchParams }: PageProps) {
  // Use filter parameter if provided, otherwise fall back to type for backward compatibility
  const filterId = searchParams.filter || searchParams.type || "";

  // Legacy support for old URL parameters
  const genre = searchParams.genre || "";
  const year = searchParams.year || "";
  // const director = searchParams.director || "";
  // const studio = searchParams.studio || "";

  // Generate dynamic title based on parameters
  const getPageTitle = () => {
    // Handle year filtering
    if (year) {
      return getFilterTitle("", year, "movie");
    }

    // Handle genre filtering
    if (genre) {
      const genreId = parseInt(genre, 10);
      if (!isNaN(genreId)) {
        const genreName = getGenreName(genreId, "movie");
        if (genreName !== "Unknown") {
          return `${genreName} Movies`;
        }
      }
    }

    // Handle filter-based titles
    if (filterId) {
      return getFilterTitle(filterId, undefined, "movie");
    }

    return "Movies";
  };

  const pageTitle = getPageTitle();

  return (
    <div className="w-full flex flex-col">
      {/* Back Button */}
      <BackButton fallbackUrl="/movies" />

      {/* Background - using static position instead of absolute */}
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      {/* Content area - using flex instead of absolute positioning */}
      <ContentContainer className="w-full flex flex-col items-center z-10">
        {/* Title Area - Center */}
        <div className="text-center my-6 sm:my-12">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold text-foreground tracking-tight">
            {pageTitle}
          </h1>
        </div>

        {/* Movies Content Area */}
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pb-8 sm:pb-12">
          <Suspense
            fallback={
              <div className="mb-20">
                <ContentLoader />
              </div>
            }
          >
            <FilteredMovieContent
              filterId={filterId}
              genre={genre}
              year={year}
            />
          </Suspense>
        </div>
      </ContentContainer>

      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}
