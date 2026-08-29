import "server-only";

import type { EpisodeCoordinates, EpisodeInfo } from "@/lib/domain/episodes";
import { fetchSeasonDetailsServer } from "@/lib/server/tvshow-api";
import { formatCountdown } from "@/lib/utils/countdown";
import { tmdb } from "@/tmdb/api";

const isEpisodeAfterLastWatched = (
  seasonNumber: number,
  episodeNumber: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
): boolean => {
  if (lastWatchedSeason === null || lastWatchedEpisode === null) {
    return true;
  }

  if (seasonNumber > lastWatchedSeason) {
    return true;
  }

  if (
    seasonNumber === lastWatchedSeason &&
    episodeNumber > lastWatchedEpisode
  ) {
    return true;
  }

  return false;
};

const compareEpisodeCoordinates = (
  left: EpisodeCoordinates,
  right: EpisodeCoordinates,
): number => {
  if (left.seasonNumber !== right.seasonNumber) {
    return left.seasonNumber - right.seasonNumber;
  }

  return left.episodeNumber - right.episodeNumber;
};

export async function checkEpisodesForShow(
  contentId: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
): Promise<EpisodeInfo | null> {
  try {
    const tvShowDetails = await tmdb.tv.detail({ id: String(contentId) });

    if (!tvShowDetails || tvShowDetails.status === "Ended") {
      return null;
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const seasons = (tvShowDetails.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .sort((a, b) => b.season_number - a.season_number);

    if (seasons.length === 0) {
      return null;
    }

    let newEpisodeCount = 0;
    let unwatchedEpisodeCount = 0;
    let nextUnwatchedEpisode: EpisodeCoordinates | null = null;
    let latestEpisodeAirDate: Date | null = null;
    let nextEpisodeDate: Date | null = null;

    for (const season of seasons) {
      const seasonDetails = await fetchSeasonDetailsServer(
        String(contentId),
        season.season_number,
      );

      if (!seasonDetails?.episodes) {
        continue;
      }

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

      for (const episode of airedEpisodes) {
        if (!episode.air_date) continue;

        const episodeDate = new Date(episode.air_date);
        const isAfterLastWatched = isEpisodeAfterLastWatched(
          season.season_number,
          episode.episode_number,
          lastWatchedSeason,
          lastWatchedEpisode,
        );

        if (isAfterLastWatched) {
          unwatchedEpisodeCount++;
          const candidate: EpisodeCoordinates = {
            seasonNumber: season.season_number,
            episodeNumber: episode.episode_number,
          };

          if (
            !nextUnwatchedEpisode ||
            compareEpisodeCoordinates(candidate, nextUnwatchedEpisode) < 0
          ) {
            nextUnwatchedEpisode = candidate;
          }
        }

        const isNewEpisode = episodeDate >= sevenDaysAgo && isAfterLastWatched;

        if (isNewEpisode) {
          newEpisodeCount++;
          if (!latestEpisodeAirDate || episodeDate > latestEpisodeAirDate) {
            latestEpisodeAirDate = episodeDate;
          }
        }
      }

      if (!nextEpisodeDate && upcomingEpisodes.length > 0) {
        const nextEpisode = upcomingEpisodes[0];
        if (nextEpisode.air_date) {
          nextEpisodeDate = new Date(nextEpisode.air_date);
        }
      }
    }

    let countdown: string | null = null;
    if (nextEpisodeDate) {
      countdown = formatCountdown(nextEpisodeDate);
    }

    return {
      hasNewEpisodes: newEpisodeCount > 0,
      newEpisodeCount,
      hasUnwatchedEpisodes: unwatchedEpisodeCount > 0,
      unwatchedEpisodeCount,
      nextUnwatchedEpisode,
      nextEpisodeDate,
      countdown,
      latestEpisodeAirDate,
    };
  } catch (error) {
    console.error(`Error checking episodes for show ${contentId}:`, error);
    return null;
  }
}
