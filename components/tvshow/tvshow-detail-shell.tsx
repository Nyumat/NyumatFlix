"use client";

import { WatchlistItem } from "@/app/watchlist/actions";
import { MediaDetailRouteTabs } from "@/components/media/media-detail-route-tabs";
import { MediaDetailLayout } from "@/components/media/media-server";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import { Episode, SeasonDetails, TvShowDetails } from "@/utils/typings";
import { useMemo } from "react";

type TvShowDetailShellProps = {
  details: TvShowDetails;
  tvId: string;
  anilistId: number | null | undefined;
  allSeasonDetails: Record<number, SeasonDetails>;
  children: React.ReactNode;
};

export const TvShowDetailShell = ({
  details,
  tvId,
  anilistId,
  allSeasonDetails,
  children,
}: TvShowDetailShellProps) => {
  const { watchlistItem, isLoading } = useWatchlistItem(
    parseInt(tvId, 10),
    "tv",
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
      contentContainerClassName="mx-auto px-4 relative z-10 max-w-7xl !pt-4 sm:!pt-6 lg:!pt-8"
      sectionNav={<MediaDetailRouteTabs mediaType="tv" id={tvId} />}
      tvHeroEpisodeData={{
        tvId,
        details,
        allSeasonDetails,
      }}
    >
      <div className="mt-4">{children}</div>
    </MediaDetailLayout>
  );
};
