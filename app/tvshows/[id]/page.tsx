import { Metadata } from "next";
import Link from "next/link";
import { memo, Suspense } from "react";
import { HeroSection } from "@/components/hero/exports";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { MediaCarousels } from "@/components/media/media-carousels";
import { SeasonTabs } from "@/components/tvshow/season-tabs";
import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";
import { TVShowOverview } from "@/components/tvshow/tvshow-overview";
import { TVShowSidebar } from "@/components/tvshow/tvshow-sidebar";
import { Season } from "@/utils/typings";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const tvShow = await fetchTVShowDetails(params.id);

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

const StableBackground = memo(function StableBackground() {
  return (
    <div className="absolute inset-0 w-full min-h-full">
      <div
        className="w-full min-h-full bg-repeat bg-center"
        style={{
          backgroundImage: "url('/movie-banner.webp')",
          filter: "blur(8px)",
          opacity: 0.3,
        }}
      />
      <div className="absolute inset-0 bg-black/50 -mt-4 -mb-4" />
    </div>
  );
});

function SeasonsSkeleton() {
  return (
    <section className="min-h-[400px]">
      <div className="h-8 w-48 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md mb-4 animate-pulse" />

      <div className="overflow-x-auto pb-2">
        <div className="mb-4 bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-1 flex w-max min-w-full shadow-xl animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-24 bg-gradient-to-r from-white/12 to-white/6 backdrop-blur-sm border border-white/10 rounded-md mr-1"
            />
          ))}
        </div>
      </div>

      <div className="flex mb-4 items-center animate-pulse">
        <div className="w-24 h-36 rounded overflow-hidden mr-4 flex-shrink-0">
          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-6 w-32 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md" />
          <div className="h-4 w-24 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          <div className="h-4 w-16 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          <div className="space-y-1 mt-2">
            <div className="h-3 w-full bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
            <div className="h-3 w-3/4 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          </div>
        </div>
      </div>

      <div className="space-y-4 mt-2">
        <div className="h-6 w-20 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md animate-pulse" />
        <div className="min-h-[200px] max-h-[300px] overflow-hidden space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-lg p-4 animate-pulse"
            >
              <div className="flex">
                <div className="w-32 h-20 rounded overflow-hidden mr-4 flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-white/12 to-white/6 backdrop-blur-md border border-white/20 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-48 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                    <div className="h-4 w-16 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                  </div>
                  <div className="h-3 w-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                  <div className="space-y-1">
                    <div className="h-3 w-full bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
                    <div className="h-3 w-2/3 bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default async function TVShowPage(props: Props) {
  const params = await props.params;
  const { id } = params;

  try {
    const details = await fetchTVShowDetails(id);

    if (!details) {
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

    const firstSeason = details.seasons?.find(
      (season: Season) => season.season_number > 0,
    );

    const contentRating =
      details.content_ratings?.results?.find(
        (rating) => rating.iso_3166_1 === "US",
      )?.rating || "";

    const firstAirDate = details.first_air_date
      ? new Date(details.first_air_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unknown";

    return (
      <PageContainer className="pb-16">
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
          mediaType="tv"
        />

        <div className="relative">
          <StableBackground />
          <div className="relative">
            <ContentContainer className="container mx-auto px-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <TVShowSidebar
                  details={details}
                  firstAirDate={firstAirDate}
                  contentRating={contentRating}
                />

                <div className="lg:col-span-2 space-y-2">
                  <TVShowOverview details={details} />

                  <Suspense fallback={<SeasonsSkeleton />}>
                    <SeasonTabs
                      details={details}
                      tvId={id}
                      firstSeason={firstSeason}
                    />
                  </Suspense>

                  <MediaCarousels
                    cast={details.credits?.cast}
                    videos={details.videos?.results}
                    recommendations={details.recommendations?.results}
                    mediaType="tv"
                  />
                </div>
              </div>
            </ContentContainer>
          </div>
        </div>
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
