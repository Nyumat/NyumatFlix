"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { pages } from "@/config";
import { Season } from "@/tmdb/models";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TvEpisodeNavigationProps {
  id: string;
  season: number;
  episode: number;
  episodes: {
    episode_number: number;
  }[];
}

export const TvEpisodeNavigation = ({
  id,
  season,
  episode,
  episodes,
}: TvEpisodeNavigationProps) => {
  const router = useRouter();

  const previousEpisode = episodes.find(
    (e) => e.episode_number === Number(episode) - 1,
  );
  const nextEpisode = episodes.find(
    (e) => e.episode_number === Number(episode) + 1,
  );

  const goEpisode = (e: number) => {
    router.push(`${pages.tv.root.link}/${id}/seasons/${season}/episodes/${e}`);
  };

  return (
    <div className="flex justify-between">
      <Button
        variant="ghost"
        disabled={!previousEpisode}
        onClick={() => goEpisode(Number(episode) - 1)}
      >
        <ChevronLeft className="mr-2 size-4" />
        Previous Episode
      </Button>

      <Button
        variant="ghost"
        disabled={!nextEpisode}
        onClick={() => goEpisode(Number(episode) + 1)}
      >
        Next Episode
        <ChevronRight className="ml-2 size-4" />
      </Button>
    </div>
  );
};

interface TvSeasonNavigationProps {
  id: string;
  seasons: Season[];
  season: number;
}

export const TvSeasonNavigation: React.FC<TvSeasonNavigationProps> = ({
  id,
  season,
  seasons,
}) => {
  const router = useRouter();

  const previousSeason = seasons.find(
    (s) => s.season_number === Number(season) - 1,
  );
  const nextSeason = seasons.find(
    (s) => s.season_number === Number(season) + 1,
  );

  const goSeason = (s: number) => {
    router.push(`${pages.tv.root.link}/${id}/seasons/${s}`);
  };

  return (
    <div className="flex justify-between">
      <Button
        variant="ghost"
        disabled={!previousSeason}
        onClick={() => goSeason(Number(season) - 1)}
      >
        <ChevronLeft className="mr-2 size-4" />
        Previous Season
      </Button>

      <Button
        variant="ghost"
        disabled={!nextSeason}
        onClick={() => goSeason(Number(season) + 1)}
      >
        Next Season
        <ChevronRight className="ml-2 size-4" />
      </Button>
    </div>
  );
};
