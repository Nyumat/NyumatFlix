import { getWatchlistItem } from "@/app/watchlist/actions";
import { MediaCarousels } from "@/components/media/media-carousels";
import { MediaDetailLayout } from "@/components/media/media-detail-layout";
import { MediaErrorPage } from "@/components/media/media-error-page";
import { MediaNotFoundError } from "@/components/media/media-not-found-error";
import { SeasonTabs } from "@/components/tvshow/season-tabs";
import {
  fetchSeasonDetailsServer,
  fetchTVShowDetails,
} from "@/components/tvshow/tvshow-api";
import { TVShowOverview } from "@/components/tvshow/tvshow-overview";
import { TVShowSidebar } from "@/components/tvshow/tvshow-sidebar";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { Episode, Season } from "@/utils/typings";
import { Metadata } from "next";
import { Suspense } from "react";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const tvShow = await fetchTVShowDetails(params.id);

  return generateMediaMetadata({
    media: tvShow,
    mediaType: "tv",
    mediaId: params.id,
  });
}

function SeasonsSkeleton() {
  return (
    <section className="min-h-[400px]">
      <div className="h-6 sm:h-8 w-40 sm:w-48 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md mb-3 sm:mb-4 animate-pulse" />

      <div className="overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="mb-3 sm:mb-4 bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-1 flex w-max min-w-full shadow-xl animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 sm:h-10 w-20 sm:w-24 bg-gradient-to-r from-white/12 to-white/6 backdrop-blur-sm border border-white/10 rounded-md mr-1"
            />
          ))}
        </div>
      </div>

      <div className="flex mb-3 sm:mb-4 items-start sm:items-center animate-pulse">
        <div className="w-16 h-24 sm:w-24 sm:h-36 rounded overflow-hidden mr-3 sm:mr-4 flex-shrink-0">
          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
          </div>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-5 sm:h-6 w-28 sm:w-32 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md" />
          <div className="h-3 sm:h-4 w-20 sm:w-24 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          <div className="h-3 sm:h-4 w-14 sm:w-16 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          <div className="space-y-1 mt-1 sm:mt-2">
            <div className="h-2.5 sm:h-3 w-full bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
            <div className="h-2.5 sm:h-3 w-3/4 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4 mt-2">
        <div className="h-5 sm:h-6 w-16 sm:w-20 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md animate-pulse" />
        <div className="min-h-[200px] max-h-[300px] overflow-hidden space-y-3 sm:space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-lg p-3 sm:p-4 animate-pulse"
            >
              <div className="flex">
                <div className="w-24 h-16 sm:w-32 sm:h-20 rounded overflow-hidden mr-3 sm:mr-4 flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-white/12 to-white/6 backdrop-blur-md border border-white/20 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                  </div>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div className="h-3 sm:h-4 w-32 sm:w-48 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                    <div className="h-3 sm:h-4 w-12 sm:w-16 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm flex-shrink-0" />
                  </div>
                  <div className="h-2.5 sm:h-3 w-16 sm:w-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                  <div className="space-y-1">
                    <div className="h-2.5 sm:h-3 w-full bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
                    <div className="h-2.5 sm:h-3 w-2/3 bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
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
      return <MediaNotFoundError mediaType="tv" title="TV Show Not Found" />;
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

    const anilistId = await getAnilistIdForMedia(details);
    const watchlistItem = await getWatchlistItem(parseInt(id), "tv");

    let initialEpisode: Episode | null = null;
    if (watchlistItem?.lastWatchedSeason && watchlistItem?.lastWatchedEpisode) {
      try {
        const seasonDetails = await fetchSeasonDetailsServer(
          id,
          watchlistItem.lastWatchedSeason,
        );
        if (seasonDetails?.episodes) {
          initialEpisode =
            seasonDetails.episodes.find(
              (ep: Episode) =>
                ep.episode_number === watchlistItem.lastWatchedEpisode,
            ) || null;
        }
      } catch (error) {
        console.error("Error fetching initial episode:", error);
      }
    }

    return (
      <MediaDetailLayout
        media={[
          {
            ...details,
            title: details.name,
            videos: details.videos?.results || [],
          },
        ]}
        mediaType="tv"
        anilistId={anilistId}
        watchlistItem={watchlistItem}
        initialEpisode={initialEpisode}
        initialSeasonNumber={watchlistItem?.lastWatchedSeason || null}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <TVShowSidebar
            details={details}
            firstAirDate={firstAirDate}
            contentRating={contentRating}
          />

          <div className="lg:col-span-2 space-y-2 sm:space-y-3 lg:space-y-2">
            <TVShowOverview details={details} />

            <Suspense fallback={<SeasonsSkeleton />}>
              <SeasonTabs
                details={details}
                tvId={id}
                firstSeason={firstSeason}
                watchlistItem={watchlistItem}
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
      </MediaDetailLayout>
    );
  } catch (error) {
    console.error("TVShowPage error:", error);
    return <MediaErrorPage mediaType="tv" title="Error Loading TV Show" />;
  }
}
