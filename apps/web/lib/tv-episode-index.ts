import { Episode, SeasonDetails } from "@/lib/domain/typings";
import { isPlaceholderEpisodeName } from "@/lib/anime/episode-thumbnail-url";

export type IndexedEpisode = {
  episode: Episode;
  seasonNumber: number;
};

export const maxLoadedEpisodeNumber = (
  episodes: Episode[] | undefined,
): number =>
  (episodes ?? []).reduce(
    (max, episode) => Math.max(max, episode.episode_number),
    0,
  );

export const seasonEpisodeMetadataScore = (
  season: SeasonDetails | undefined,
): number => {
  const episodes = season?.episodes ?? [];
  const uniqueStills = new Set(
    episodes
      .map((episode) => episode.still_path?.trim())
      .filter((path): path is string => Boolean(path)),
  );
  const namedCount = episodes.filter(
    (episode) => !isPlaceholderEpisodeName(episode.name),
  ).length;
  return uniqueStills.size + namedCount;
};

export const shouldPreferSeasonDetails = (
  existing: SeasonDetails | undefined,
  incoming: SeasonDetails,
): boolean => {
  const existingMax = maxLoadedEpisodeNumber(existing?.episodes);
  const incomingMax = maxLoadedEpisodeNumber(incoming.episodes);
  if (incomingMax !== existingMax) {
    return incomingMax > existingMax;
  }

  const existingLength = existing?.episodes?.length ?? 0;
  const incomingLength = incoming.episodes?.length ?? 0;
  if (incomingLength !== existingLength) {
    return incomingLength > existingLength;
  }

  return (
    seasonEpisodeMetadataScore(incoming) > seasonEpisodeMetadataScore(existing)
  );
};

export function buildEpisodeIndex(
  allSeasonDetails: Record<number, SeasonDetails>,
): IndexedEpisode[] {
  const seasonKeys = Object.keys(allSeasonDetails)
    .map(Number)
    .sort((a, b) => a - b);
  const out: IndexedEpisode[] = [];
  for (const seasonNumber of seasonKeys) {
    const eps = allSeasonDetails[seasonNumber]?.episodes ?? [];
    for (const episode of eps) {
      out.push({ episode, seasonNumber });
    }
  }
  return out;
}
