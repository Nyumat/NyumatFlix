import type { EpisodeCoordinates, EpisodeInfo } from "@/lib/domain/episodes";
import type { WatchlistItem } from "@/lib/domain/watchlist";

export type UpNextCandidate = {
  contentId: number;
  watchlistItem: WatchlistItem;
  episodeInfo: EpisodeInfo;
};

export const buildUpNextHref = (
  contentId: number,
  nextUnwatchedEpisode: EpisodeCoordinates | null,
  fallbackSeason?: number | null,
  fallbackEpisode?: number | null,
): string => {
  if (nextUnwatchedEpisode) {
    return `/tvshows/${contentId}?season=${nextUnwatchedEpisode.seasonNumber}&episode=${nextUnwatchedEpisode.episodeNumber}&autoplay=true`;
  }

  const season = fallbackSeason && fallbackSeason > 0 ? fallbackSeason : 1;
  const episode =
    fallbackEpisode && fallbackEpisode > 0 ? fallbackEpisode + 1 : 1;

  return `/tvshows/${contentId}?season=${season}&episode=${episode}&autoplay=true`;
};

export const isUpNextInboxCandidate = (
  item: WatchlistItem,
  episodeInfo: EpisodeInfo | undefined,
): episodeInfo is EpisodeInfo =>
  item.mediaType === "tv" &&
  item.status === "watching" &&
  Boolean(episodeInfo?.hasUnwatchedEpisodes);

export const collectUpNextCandidates = (
  watchlistItems: WatchlistItem[],
  episodeData: Record<number, EpisodeInfo>,
): UpNextCandidate[] =>
  watchlistItems
    .filter((item) => isUpNextInboxCandidate(item, episodeData[item.contentId]))
    .map((item) => ({
      contentId: item.contentId,
      watchlistItem: item,
      episodeInfo: episodeData[item.contentId],
    }))
    .sort((left, right) => {
      const leftDate = left.episodeInfo.latestEpisodeAirDate?.getTime() ?? 0;
      const rightDate = right.episodeInfo.latestEpisodeAirDate?.getTime() ?? 0;
      if (leftDate !== rightDate) {
        return rightDate - leftDate;
      }

      return (
        right.episodeInfo.unwatchedEpisodeCount -
        left.episodeInfo.unwatchedEpisodeCount
      );
    });

export const parseEpisodeDataResponse = (
  raw: Record<string, unknown>,
): Record<number, EpisodeInfo> => {
  const parsed: Record<number, EpisodeInfo> = {};

  for (const [contentId, info] of Object.entries(raw)) {
    if (!info || typeof info !== "object") {
      continue;
    }

    const typed = info as EpisodeInfo & {
      nextEpisodeDate?: string | Date | null;
      latestEpisodeAirDate?: string | Date | null;
    };

    parsed[Number(contentId)] = {
      ...typed,
      nextEpisodeDate: typed.nextEpisodeDate
        ? new Date(typed.nextEpisodeDate)
        : null,
      latestEpisodeAirDate: typed.latestEpisodeAirDate
        ? new Date(typed.latestEpisodeAirDate)
        : null,
    };
  }

  return parsed;
};
