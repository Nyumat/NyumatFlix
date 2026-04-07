"use client";

import { WatchlistItem } from "@/app/watchlist/actions";
import { EpisodeProgressIndicator } from "@/components/watchlist/watchlist";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { Episode, SeasonDetails } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { useCallback, useEffect } from "react";

type SeasonEpisodesProps = {
  tvId: string;
  seasonNumber: number;
  episodeRange?: {
    start: number;
    end: number;
  };
  animeInfo?: {
    anilistId: number;
    startEpisode: number;
    endEpisode: number;
  };
  watchlistItem: WatchlistItem | null;
  initialSeasonDetails?: SeasonDetails | null;
};

export function SeasonEpisodes({
  tvId,
  seasonNumber,
  episodeRange,
  animeInfo,
  watchlistItem,
  initialSeasonDetails,
}: SeasonEpisodesProps) {
  const { selectedEpisode, setSelectedEpisode } = useEpisodeStore();

  // use pre-fetched data directly - no loading state needed
  const seasonDetails = initialSeasonDetails ?? null;

  useEffect(() => {
    if (!seasonDetails?.episodes || seasonDetails.episodes.length === 0) {
      return;
    }

    const currentSelected = useEpisodeStore.getState().selectedEpisode;
    const currentTvShowId = useEpisodeStore.getState().tvShowId;
    const currentSeasonNumber = useEpisodeStore.getState().seasonNumber;

    if (
      currentSelected &&
      currentTvShowId === tvId &&
      currentSeasonNumber === seasonNumber
    ) {
      return;
    }

    if (
      watchlistItem &&
      watchlistItem.lastWatchedSeason === seasonNumber &&
      watchlistItem.lastWatchedEpisode !== null
    ) {
      const lastWatchedEpisode = seasonDetails.episodes.find(
        (ep: Episode) => ep.episode_number === watchlistItem.lastWatchedEpisode,
      );

      if (lastWatchedEpisode) {
        setSelectedEpisode(
          lastWatchedEpisode,
          tvId,
          seasonNumber,
          animeInfo,
          true,
        );
      }
    }
  }, [
    seasonDetails,
    tvId,
    seasonNumber,
    setSelectedEpisode,
    animeInfo,
    watchlistItem,
  ]);

  const handleEpisodeClick = useCallback(
    (episode: Episode) => {
      setSelectedEpisode(episode, tvId, seasonNumber, animeInfo);
    },
    [setSelectedEpisode, tvId, seasonNumber, animeInfo],
  );

  return (
    <div className="mt-2 space-y-3 sm:space-y-4">
      <h3 className="text-lg font-semibold text-foreground sm:text-xl">
        Episodes
      </h3>
      <div className="min-h-[200px]">
        {!seasonDetails ||
        !seasonDetails.episodes ||
        seasonDetails.episodes.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center">
                <Tv size={20} className="sm:size-6 text-muted-foreground" />
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">
                No episodes available for this season.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {seasonDetails.episodes
              .filter((episode: Episode) => {
                if (!episodeRange) return true;
                return (
                  episode.episode_number >= episodeRange.start &&
                  episode.episode_number <= episodeRange.end
                );
              })
              .map((episode: Episode) => (
                <div
                  key={episode.id}
                  onClick={() => handleEpisodeClick(episode)}
                  className={`bg-card/50 rounded-lg p-3 sm:p-4 transition cursor-pointer border-2 ${
                    selectedEpisode?.id === episode.id
                      ? "border-primary bg-primary/10 hover:bg-primary/20"
                      : "border-transparent hover:bg-card hover:border-border"
                  }`}
                >
                  <div className="flex">
                    <div className="w-24 h-16 sm:w-32 sm:h-20 rounded overflow-hidden mr-3 sm:mr-4 flex-shrink-0">
                      {episode.still_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                          alt={episode.name}
                          width={300}
                          height={169}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Tv
                            size={16}
                            className="sm:size-5 text-muted-foreground"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="text-foreground font-medium text-sm sm:text-base leading-tight">
                          {episode.episode_number}. {episode.name}
                        </h4>
                        <div className="text-muted-foreground text-xs sm:text-sm flex-shrink-0">
                          {episode.runtime ? `${episode.runtime} min` : ""}
                        </div>
                      </div>
                      {episode.air_date && (
                        <div className="text-muted-foreground text-[10px] sm:text-xs mb-1">
                          {new Date(episode.air_date).toLocaleDateString()}
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs sm:text-sm line-clamp-2 leading-relaxed">
                        {episode.overview}
                      </p>
                      <div className="mt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                        {selectedEpisode?.id === episode.id && (
                          <div className="text-primary text-xs sm:text-sm font-medium">
                            Selected for viewing
                          </div>
                        )}
                        <EpisodeProgressIndicator
                          seasonNumber={seasonNumber}
                          episodeNumber={episode.episode_number}
                          watchlistItem={watchlistItem}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
