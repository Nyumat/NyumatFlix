import "server-only";

import type { EpisodeCoordinates, EpisodeInfo } from "@/lib/domain/episodes";
import { fetchSeasonDetailsServer } from "@/lib/server/tvshow-api";
import { formatCountdown } from "@/lib/utils/countdown";
import { tmdb } from "@/tmdb/api";
import type { LastEpisodeToAir, NextEpisodeToAir } from "@/tmdb/models";

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

const isCaughtUpOnAiredEpisodes = (
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
  lastEpisodeToAir: LastEpisodeToAir | null | undefined,
): boolean => {
  if (!lastEpisodeToAir?.air_date) {
    return false;
  }

  if (lastWatchedSeason === null || lastWatchedEpisode === null) {
    return false;
  }

  if (lastWatchedSeason > lastEpisodeToAir.season_number) {
    return true;
  }

  return (
    lastWatchedSeason === lastEpisodeToAir.season_number &&
    lastWatchedEpisode >= lastEpisodeToAir.episode_number
  );
};

const readNextEpisodeSchedule = (
  nextEpisodeToAir: NextEpisodeToAir | null | undefined,
  now: Date,
): { nextEpisodeDate: Date | null; countdown: string | null } => {
  if (!nextEpisodeToAir?.air_date) {
    return { nextEpisodeDate: null, countdown: null };
  }

  const nextEpisodeDate = new Date(nextEpisodeToAir.air_date);
  if (Number.isNaN(nextEpisodeDate.getTime()) || nextEpisodeDate <= now) {
    return { nextEpisodeDate: null, countdown: null };
  }

  return {
    nextEpisodeDate,
    countdown: formatCountdown(nextEpisodeDate),
  };
};

const buildCaughtUpEpisodeInfo = (
  lastEpisodeToAir: LastEpisodeToAir | null | undefined,
  nextEpisodeToAir: NextEpisodeToAir | null | undefined,
  now: Date,
): EpisodeInfo => {
  const { nextEpisodeDate, countdown } = readNextEpisodeSchedule(
    nextEpisodeToAir,
    now,
  );

  return {
    hasNewEpisodes: false,
    newEpisodeCount: 0,
    hasUnwatchedEpisodes: false,
    unwatchedEpisodeCount: 0,
    nextUnwatchedEpisode: null,
    nextEpisodeDate,
    countdown,
    latestEpisodeAirDate: lastEpisodeToAir?.air_date
      ? new Date(lastEpisodeToAir.air_date)
      : null,
  };
};

const processSeasonEpisodes = (
  seasonNumber: number,
  episodes: Array<{
    air_date?: string;
    episode_number: number;
  }>,
  now: Date,
  sevenDaysAgo: Date,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
) => {
  let newEpisodeCount = 0;
  let unwatchedEpisodeCount = 0;
  let nextUnwatchedEpisode: EpisodeCoordinates | null = null;
  let latestEpisodeAirDate: Date | null = null;

  for (const episode of episodes) {
    if (!episode.air_date) {
      continue;
    }

    const episodeDate = new Date(episode.air_date);
    if (Number.isNaN(episodeDate.getTime()) || episodeDate > now) {
      continue;
    }

    const isAfterLastWatched = isEpisodeAfterLastWatched(
      seasonNumber,
      episode.episode_number,
      lastWatchedSeason,
      lastWatchedEpisode,
    );

    if (!isAfterLastWatched) {
      continue;
    }

    unwatchedEpisodeCount += 1;
    const candidate: EpisodeCoordinates = {
      seasonNumber,
      episodeNumber: episode.episode_number,
    };

    if (
      !nextUnwatchedEpisode ||
      compareEpisodeCoordinates(candidate, nextUnwatchedEpisode) < 0
    ) {
      nextUnwatchedEpisode = candidate;
    }

    if (episodeDate >= sevenDaysAgo) {
      newEpisodeCount += 1;
      if (!latestEpisodeAirDate || episodeDate > latestEpisodeAirDate) {
        latestEpisodeAirDate = episodeDate;
      }
    }
  }

  return {
    newEpisodeCount,
    unwatchedEpisodeCount,
    nextUnwatchedEpisode,
    latestEpisodeAirDate,
  };
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
    const { nextEpisodeDate, countdown } = readNextEpisodeSchedule(
      tvShowDetails.next_episode_to_air,
      now,
    );

    if (
      isCaughtUpOnAiredEpisodes(
        lastWatchedSeason,
        lastWatchedEpisode,
        tvShowDetails.last_episode_to_air,
      )
    ) {
      return buildCaughtUpEpisodeInfo(
        tvShowDetails.last_episode_to_air,
        tvShowDetails.next_episode_to_air,
        now,
      );
    }

    const lastEpisodeToAirSeason =
      tvShowDetails.last_episode_to_air?.season_number;

    const seasons = (tvShowDetails.seasons ?? [])
      .filter((season) => season.season_number > 0)
      .filter((season) =>
        lastWatchedSeason === null
          ? true
          : season.season_number >= lastWatchedSeason,
      )
      .filter((season) =>
        lastEpisodeToAirSeason === undefined
          ? true
          : season.season_number <= lastEpisodeToAirSeason,
      )
      .sort((left, right) => left.season_number - right.season_number);

    if (seasons.length === 0) {
      return {
        hasNewEpisodes: false,
        newEpisodeCount: 0,
        hasUnwatchedEpisodes: false,
        unwatchedEpisodeCount: 0,
        nextUnwatchedEpisode: null,
        nextEpisodeDate,
        countdown,
        latestEpisodeAirDate: tvShowDetails.last_episode_to_air?.air_date
          ? new Date(tvShowDetails.last_episode_to_air.air_date)
          : null,
      };
    }

    let newEpisodeCount = 0;
    let unwatchedEpisodeCount = 0;
    let nextUnwatchedEpisode: EpisodeCoordinates | null = null;
    let latestEpisodeAirDate: Date | null = null;

    for (const season of seasons) {
      const details = await fetchSeasonDetailsServer(
        String(contentId),
        season.season_number,
      );
      const episodes = details?.episodes ?? [];

      const processed = processSeasonEpisodes(
        season.season_number,
        episodes,
        now,
        sevenDaysAgo,
        lastWatchedSeason,
        lastWatchedEpisode,
      );

      newEpisodeCount += processed.newEpisodeCount;
      unwatchedEpisodeCount += processed.unwatchedEpisodeCount;

      if (
        processed.nextUnwatchedEpisode &&
        (!nextUnwatchedEpisode ||
          compareEpisodeCoordinates(
            processed.nextUnwatchedEpisode,
            nextUnwatchedEpisode,
          ) < 0)
      ) {
        nextUnwatchedEpisode = processed.nextUnwatchedEpisode;
      }

      if (
        processed.latestEpisodeAirDate &&
        (!latestEpisodeAirDate ||
          processed.latestEpisodeAirDate > latestEpisodeAirDate)
      ) {
        latestEpisodeAirDate = processed.latestEpisodeAirDate;
      }

      if (nextUnwatchedEpisode) {
        const atLastAiredSeason =
          lastEpisodeToAirSeason !== undefined &&
          season.season_number >= lastEpisodeToAirSeason;
        const seasonHasSevenDayUnwatched = processed.newEpisodeCount > 0;

        if (atLastAiredSeason || !seasonHasSevenDayUnwatched) {
          break;
        }
      }
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
