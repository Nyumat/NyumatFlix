"use client";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { Episode } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { useEffect, useState } from "react";
import { fetchSeasonDetails } from "./tvshow-api";

type SeasonEpisodesProps = {
  tvId: string;
  seasonNumber: number;
};

export function SeasonEpisodes({ tvId, seasonNumber }: SeasonEpisodesProps) {
  const [seasonDetails, setSeasonDetails] = useState<any>(null);
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

  const handleEpisodeClick = (episode: Episode) => {
    setSelectedEpisode(episode, tvId, seasonNumber);
  };

  if (loading) {
    return (
      <div className="text-muted-foreground py-4">Loading episodes...</div>
    );
  }

  if (
    !seasonDetails ||
    !seasonDetails.episodes ||
    seasonDetails.episodes.length === 0
  ) {
    return (
      <div className="text-muted-foreground py-4">
        No episodes available for this season.
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2">
      <h3 className="text-xl font-semibold text-foreground">Episodes</h3>
      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
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
      </div>
    </div>
  );
}
