import { fetchMediaDetails } from "@/app/actions";
import { Metadata } from "next";
import { HeroSection } from "@/components/hero/exports";
import { Suspense } from "react";
import { Season } from "@/utils/typings";
import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";
import { TVShowSidebar } from "@/components/tvshow/tvshow-sidebar";
import { TVShowOverview } from "@/components/tvshow/tvshow-overview";
import { SeasonTabs } from "@/components/tvshow/season-tabs";
import {
  CastCarousel,
  RecommendedCarousel,
  VideoCarousel,
} from "@/components/tvshow/media-carousels";
import { PageContainer } from "@/components/layout/page-container";
import { ContentContainer } from "@/components/layout/content-container";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tvShow = await fetchMediaDetails(params.id);

  if (!tvShow) {
    return {
      title: "TV Show Not Found | NyumatFlix",
      description: "The requested TV show could not be found.",
    };
  }

  const title = tvShow.name || "TV Show";
  const description = tvShow.overview || "Watch this TV show on NyumatFlix";
  const firstAirYear = tvShow.first_air_date
    ? new Date(tvShow.first_air_date).getFullYear()
    : "";

  const titleWithYear = firstAirYear ? `${title} (${firstAirYear})` : title;

  return {
    title: `${titleWithYear} | NyumatFlix`,
    description,
    openGraph: {
      title: titleWithYear,
      description,
      type: "video.tv_show",
      images: tvShow.backdrop_path
        ? [
            {
              url: `https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`,
              width: 1280,
              height: 720,
              alt: title,
            },
            {
              url: `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}`,
              width: 1920,
              height: 1080,
              alt: title,
            },
          ]
        : [],
    },
  };
}

export default async function TVShowPage({ params }: Props) {
  const { id } = params;
  const details = await fetchTVShowDetails(id);

  // Get first season details for initial view
  const firstSeason = details.seasons?.find(
    (season: Season) => season.season_number > 0,
  );

  // Get content rating
  const contentRating =
    details.content_ratings?.results?.find(
      (rating) => rating.iso_3166_1 === "US",
    )?.rating || "";

  // Format release date
  const firstAirDate = details.first_air_date
    ? new Date(details.first_air_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <PageContainer className="bg-black/95 pb-16">
      <HeroSection
        media={[
          {
            ...details,
            title: details.name,
            videos: details.videos?.results || [],
          },
        ]}
        noSlide
        isWatch
      />

      {/* Additional content below hero */}
      <ContentContainer
        className="container mx-auto px-4 -mt-10 relative z-10"
        topSpacing={false}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left sidebar - Poster and quick info */}
          <TVShowSidebar
            details={details}
            firstAirDate={firstAirDate}
            contentRating={contentRating}
          />

          {/* Main content - Overview, cast, similar */}
          <div className="lg:col-span-2 space-y-8">
            <TVShowOverview details={details} />

            {/* Seasons and Episodes */}
            <Suspense fallback={<div>Loading seasons...</div>}>
              <SeasonTabs
                details={details}
                tvId={id}
                firstSeason={firstSeason}
              />
            </Suspense>

            {/* Cast section */}
            {details.credits?.cast?.length > 0 && (
              <CastCarousel cast={details.credits.cast} />
            )}

            {/* Videos section */}
            {details.videos?.results?.length > 0 && (
              <VideoCarousel videos={details.videos.results} />
            )}

            {/* Recommended section */}
            {details.recommendations?.results?.length > 0 && (
              <RecommendedCarousel shows={details.recommendations.results} />
            )}
          </div>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
