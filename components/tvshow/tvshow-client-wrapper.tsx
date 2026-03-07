"use client";

import { WatchlistItem } from "@/app/watchlist/actions";
import { MediaCarousels } from "@/components/media/media-carousels";
import { MediaDetailLayout } from "@/components/media/media-detail-layout";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import { Episode, SeasonDetails, TvShowDetails } from "@/utils/typings";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { TVShowOverview } from "./tvshow-overview";
import { TVShowSidebar } from "./tvshow-sidebar";

const SeasonTabs = dynamic(
  () => {
    return import("./season-tabs").then((mod) => mod.SeasonTabs);
  },
  { ssr: false },
);

type TVShowClientWrapperProps = {
  details: TvShowDetails;
  tvId: string;
  firstAirDate: string;
  contentRating: string;
  anilistId: number | null | undefined;
  allSeasonDetails: Record<number, SeasonDetails>;
};

export function TVShowClientWrapper({
  details,
  tvId,
  firstAirDate,
  contentRating,
  anilistId,
  allSeasonDetails,
}: TVShowClientWrapperProps) {
  const [, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { watchlistItem, isLoading } = useWatchlistItem(parseInt(tvId), "tv");

  const firstSeason = details.seasons?.find(
    (season) => season.season_number > 0,
  );

  const initialEpisode = useMemo((): Episode | null => {
    if (!watchlistItem?.lastWatchedSeason || !watchlistItem?.lastWatchedEpisode)
      return null;

    const seasonDetail = allSeasonDetails[watchlistItem.lastWatchedSeason];
    if (!seasonDetail?.episodes) return null;

    return (
      seasonDetail.episodes.find(
        (ep: Episode) => ep.episode_number === watchlistItem.lastWatchedEpisode,
      ) || null
    );
  }, [watchlistItem, allSeasonDetails]);

  const passedWatchlistItem: WatchlistItem | null = isLoading
    ? null
    : watchlistItem;

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
      watchlistItem={passedWatchlistItem}
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

          <SeasonTabs
            details={details}
            tvId={tvId}
            firstSeason={firstSeason}
            watchlistItem={passedWatchlistItem}
            allSeasonDetails={allSeasonDetails}
          />

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
}
