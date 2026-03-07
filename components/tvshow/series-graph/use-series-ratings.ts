"use client";

import { SeasonDetails } from "@/utils/typings";
import { useMemo } from "react";
import { EpisodeRating, SeasonRatings } from "./types";

type UseSeriesRatingsResult = {
  seasonRatings: SeasonRatings[];
  loading: boolean;
  error: string | null;
};

export function useSeriesRatings(
  allSeasonDetails: Record<number, SeasonDetails>,
): UseSeriesRatingsResult {
  const seasonRatings = useMemo(() => {
    const seasonNumbers = Object.keys(allSeasonDetails)
      .map(Number)
      .sort((a, b) => a - b);

    if (seasonNumbers.length === 0) {
      return [];
    }

    const ratings: SeasonRatings[] = seasonNumbers
      .map((seasonNum) => {
        const seasonDetail = allSeasonDetails[seasonNum];
        if (!seasonDetail) return null;

        const episodes: EpisodeRating[] = seasonDetail.episodes
          .filter((ep) => ep.vote_average !== undefined && ep.vote_average > 0)
          .map((ep) => ({
            seasonNumber: seasonDetail.season_number,
            episodeNumber: ep.episode_number,
            rating: ep.vote_average ?? 0,
            name: ep.name,
            id: ep.id,
          }));

        const average =
          episodes.length > 0
            ? episodes.reduce((sum, ep) => sum + ep.rating, 0) / episodes.length
            : 0;

        return {
          seasonNumber: seasonDetail.season_number,
          seasonName:
            seasonDetail.name || `Season ${seasonDetail.season_number}`,
          episodes,
          average,
        };
      })
      .filter(
        (season): season is SeasonRatings =>
          season !== null && season.episodes.length > 0,
      );

    return ratings;
  }, [allSeasonDetails]);

  return {
    seasonRatings,
    loading: false,
    error: null,
  };
}
