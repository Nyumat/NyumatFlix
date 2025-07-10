"use client";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { Episode, SeasonDetails } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { useCallback, useEffect, useState } from "react";
import { fetchSeasonDetails } from "./tvshow-api";

type SeasonEpisodesProps = {
  tvId: string;
  seasonNumber: number;
};

// Glassmorphism skeleton for episodes loading
function EpisodeCardSkeleton() {
  return (
    <div className="bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-lg p-4 animate-pulse">
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
  );
}

export function SeasonEpisodes({ tvId, seasonNumber }: SeasonEpisodesProps) {
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const { selectedEpisode, setSelectedEpisode } = useEpisodeStore();

  useEffect(() => {
    const loadSeasonDetails = async () => {
      setLoading(true);
      try {
        const details = await fetchSeasonDetails(tvId, seasonNumber);
        setSeasonDetails(details);
      } catch (error) {
        console.error("Error loading season details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSeasonDetails();
  }, [tvId, seasonNumber]);

  const handleEpisodeClick = useCallback(
    (episode: Episode) => {
      setSelectedEpisode(episode, tvId, seasonNumber);
    },
    [setSelectedEpisode, tvId, seasonNumber],
  );

  // Always maintain the same JSX structure to prevent re-renders
  return (
    <div className="space-y-4 mt-2">
      <h3 className="text-xl font-semibold text-foreground">Episodes</h3>
      <div className="min-h-[200px] max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <EpisodeCardSkeleton key={i} />
            ))}
          </div>
        ) : !seasonDetails ||
          !seasonDetails.episodes ||
          seasonDetails.episodes.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center">
                <Tv size={24} className="text-muted-foreground" />
              </div>
              <div className="text-muted-foreground">
                No episodes available for this season.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {seasonDetails.episodes.map((episode: Episode) => (
              <div
                key={episode.id}
                onClick={() => handleEpisodeClick(episode)}
                className={`bg-card/50 rounded-lg p-4 transition cursor-pointer border-2 ${
                  selectedEpisode?.id === episode.id
                    ? "border-primary bg-primary/10 hover:bg-primary/20"
                    : "border-transparent hover:bg-card hover:border-border"
                }`}
              >
                <div className="flex">
                  <div className="w-32 h-20 rounded overflow-hidden mr-4 flex-shrink-0">
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
                        <Tv size={20} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <h4 className="text-foreground font-medium">
                        {episode.episode_number}. {episode.name}
                      </h4>
                      <div className="text-muted-foreground text-sm">
                        {episode.runtime ? `${episode.runtime} min` : ""}
                      </div>
                    </div>
                    {episode.air_date && (
                      <div className="text-muted-foreground text-xs mb-1">
                        {new Date(episode.air_date).toLocaleDateString()}
                      </div>
                    )}
                    <p className="text-muted-foreground text-sm line-clamp-2">
                      {episode.overview}
                    </p>
                    {selectedEpisode?.id === episode.id && (
                      <div className="mt-2 text-primary text-sm font-medium">
                        Selected for viewing
                      </div>
                    )}
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
