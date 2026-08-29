import type { Episode } from "@/lib/domain/typings";

/**
 * Streaming providers expect a 1-based episode index within the season
 * (S11E03), but TMDB sometimes uses absolute/global numbering (e.g. One Piece
 * season 11 episodes 382–407). Map the TMDB episode_number to the provider slot.
 */
export function episodeNumberForProviders(
  seasonEpisodes: readonly Episode[],
  episodeNumber: number,
): number {
  if (seasonEpisodes.length === 0) {
    return episodeNumber;
  }

  const sorted = [...seasonEpisodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const index = sorted.findIndex((ep) => ep.episode_number === episodeNumber);

  if (index >= 0) {
    return index + 1;
  }

  const minEpisode = sorted[0]?.episode_number;
  if (minEpisode !== undefined && minEpisode > 1) {
    return episodeNumber - minEpisode + 1;
  }

  return episodeNumber;
}
