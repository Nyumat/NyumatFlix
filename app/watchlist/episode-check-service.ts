"use server";

import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";
import { fetchSeasonDetailsServer } from "@/components/tvshow/tvshow-api";
import { formatCountdown } from "@/lib/utils/countdown";

export interface EpisodeInfo {
  hasNewEpisodes: boolean;
  newEpisodeCount: number;
  nextEpisodeDate: Date | null;
  countdown: string | null;
  latestEpisodeAirDate: Date | null;
}

/**
 * Check for new episodes and upcoming episodes for a TV show
 * @param contentId - TMDB TV show ID
 * @param lastWatchedSeason - User's last watched season number
 * @param lastWatchedEpisode - User's last watched episode number
 * @returns Episode information including new episode count and countdown
 */
export async function checkEpisodesForShow(
  contentId: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
): Promise<EpisodeInfo | null> {
  try {
    // Fetch TV show details
    const tvShowDetails = await fetchTVShowDetails(contentId.toString());

    if (!tvShowDetails || tvShowDetails.status === "Ended") {
      return null;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all seasons sorted by season number
    const seasons = tvShowDetails.seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => b.season_number - a.season_number);

    if (seasons.length === 0) {
      return null;
    }

    let newEpisodeCount = 0;
    let latestEpisodeAirDate: Date | null = null;
    let nextEpisodeDate: Date | null = null;

    // Check each season from latest to earliest
    for (const season of seasons) {
      const seasonDetails = await fetchSeasonDetailsServer(
        contentId.toString(),
        season.season_number,
      );

      if (!seasonDetails || !seasonDetails.episodes) {
        continue;
      }

      // Get all aired episodes (air_date <= today)
      const airedEpisodes = seasonDetails.episodes
        .filter(
          (ep) =>
            ep.air_date &&
            new Date(ep.air_date) <= now &&
            new Date(ep.air_date).getTime() > 0,
        )
        .sort((a, b) => {
          if (!a.air_date || !b.air_date) return 0;
          return (
            new Date(b.air_date).getTime() - new Date(a.air_date).getTime()
          );
        });

      // Get upcoming episodes (air_date > today)
      const upcomingEpisodes = seasonDetails.episodes
        .filter(
          (ep) =>
            ep.air_date &&
            new Date(ep.air_date) > now &&
            new Date(ep.air_date).getTime() > 0,
        )
        .sort((a, b) => {
          if (!a.air_date || !b.air_date) return 0;
          return (
            new Date(a.air_date).getTime() - new Date(b.air_date).getTime()
          );
        });

      // Check for new episodes in this season
      for (const episode of airedEpisodes) {
        if (!episode.air_date) continue;

        const episodeDate = new Date(episode.air_date);
        const isNewEpisode =
          episodeDate >= sevenDaysAgo &&
          (lastWatchedSeason === null ||
            lastWatchedEpisode === null ||
            season.season_number > lastWatchedSeason ||
            (season.season_number === lastWatchedSeason &&
              episode.episode_number > lastWatchedEpisode));

        if (isNewEpisode) {
          newEpisodeCount++;
          if (!latestEpisodeAirDate || episodeDate > latestEpisodeAirDate) {
            latestEpisodeAirDate = episodeDate;
          }
        }
      }

      // Find next episode (only if we haven't found one yet)
      if (!nextEpisodeDate && upcomingEpisodes.length > 0) {
        const nextEpisode = upcomingEpisodes[0];
        if (nextEpisode.air_date) {
          nextEpisodeDate = new Date(nextEpisode.air_date);
        }
      }

      // If we found new episodes and next episode, we can stop checking older seasons
      if (newEpisodeCount > 0 && nextEpisodeDate) {
        break;
      }
    }

    // Calculate countdown if there's a next episode
    let countdown: string | null = null;
    if (nextEpisodeDate) {
      countdown = formatCountdown(nextEpisodeDate);
    }

    return {
      hasNewEpisodes: newEpisodeCount > 0,
      newEpisodeCount,
      nextEpisodeDate,
      countdown,
      latestEpisodeAirDate,
    };
  } catch (error) {
    console.error(`Error checking episodes for show ${contentId}:`, error);
    return null;
  }
}
