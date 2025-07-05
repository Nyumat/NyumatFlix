import { fetchMediaDetails } from "@/app/actions";
import { HeroSection } from "@/components/hero/exports";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { MediaCarousels } from "@/components/media/media-carousels";
import { SeasonTabs } from "@/components/tvshow/season-tabs";
import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";
import { TVShowOverview } from "@/components/tvshow/tvshow-overview";
import { TVShowSidebar } from "@/components/tvshow/tvshow-sidebar";
import { Season } from "@/utils/typings";
import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

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

  const title = tvShow.name;
  const description = tvShow.overview || `Watch ${title} on NyumatFlix`;
  const firstAirYear = tvShow.first_air_date
    ? new Date(tvShow.first_air_date).getFullYear()
    : "";

  const titleWithYear = firstAirYear
    ? `${title} (${firstAirYear}) | NyumatFlix`
    : `${title} | NyumatFlix`;

  return {
    title: titleWithYear,
    description,
    openGraph: {
      title: titleWithYear,
      description,
      type: "video.tv_show",
      images: [
        {
          url: `https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`,
          width: 1280,
          height: 720,
          alt: title,
        },
      ],
    },
    twitter: {
      title: titleWithYear,
      description,
      images: [`https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`],
    },
  };
}

export default async function TVShowPage({ params }: Props) {
  const { id } = params;

  console.log("TVShowPage debug: Fetching details for ID:", id);

  try {
    const details = await fetchTVShowDetails(id);

    console.log("TVShowPage debug: Details fetched successfully:", {
      id: details?.id,
      name: details?.name,
      has_details: !!details,
    });

    if (!details) {
      console.log("TVShowPage debug: No details found, returning not found");
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            TV Show Not Found
          </h1>
          <p className="text-muted-foreground">
            The requested TV show could not be found.
          </p>
          <Link href="/tvshows" className="mt-4 text-primary hover:underline">
            Back to TV Shows
          </Link>
        </div>
      );
    }

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
      <PageContainer className="bg-background/95 dark:bg-background/95 pb-16">
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

              {/* Media Carousels - Cast, Videos, Recommendations */}
              <MediaCarousels
                cast={details.credits?.cast}
                videos={details.videos?.results}
                recommendations={details.recommendations?.results}
                mediaType="tv"
              />
            </div>
          </div>
        </ContentContainer>
      </PageContainer>
    );
  } catch (error) {
    console.error("TVShowPage error:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Error Loading TV Show
        </h1>
        <p className="text-muted-foreground">
          There was an error loading this TV show.
        </p>
        <Link href="/tvshows" className="mt-4 text-primary hover:underline">
          Back to TV Shows
        </Link>
      </div>
    );
  }
}
