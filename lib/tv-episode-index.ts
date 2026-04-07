import { Episode, SeasonDetails } from "@/utils/typings";

export type IndexedEpisode = {
  episode: Episode;
  seasonNumber: number;
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
