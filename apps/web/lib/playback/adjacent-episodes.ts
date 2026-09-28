import type { Episode } from "@/lib/domain/typings";

export type AdjacentEpisodeTarget = {
  episodeNumber: number;
  providerEpisodeNumber: number;
  relativeEpisodeNumber: number | null;
};

/** next first, then previous — the order we prefetch in. */
export const resolveAdjacentEpisodeTargets = ({
  seasonEpisodes,
  episodeNumber,
  relativeEpisodeNumber = null,
  animeSegmentStart = null,
  animeSegmentEnd = null,
}: {
  seasonEpisodes: readonly Pick<Episode, "episode_number">[] | null;
  episodeNumber: number | null | undefined;
  relativeEpisodeNumber?: number | null;
  animeSegmentStart?: number | null;
  animeSegmentEnd?: number | null;
}): AdjacentEpisodeTarget[] => {
  if (!seasonEpisodes?.length || episodeNumber == null) {
    return [];
  }

  const sorted = [...seasonEpisodes].sort(
    (left, right) => left.episode_number - right.episode_number,
  );
  const index = sorted.findIndex(
    (episode) => episode.episode_number === episodeNumber,
  );
  if (index < 0) {
    return [];
  }

  const targets: AdjacentEpisodeTarget[] = [];
  for (const offset of [1, -1]) {
    const neighbor = sorted[index + offset];
    if (!neighbor) {
      continue;
    }

    if (relativeEpisodeNumber === null) {
      targets.push({
        episodeNumber: neighbor.episode_number,
        providerEpisodeNumber: index + offset + 1,
        relativeEpisodeNumber: null,
      });
      continue;
    }

    const relative = relativeEpisodeNumber + offset;
    const outsideSegment =
      (animeSegmentStart !== null &&
        neighbor.episode_number < animeSegmentStart) ||
      (animeSegmentEnd !== null && neighbor.episode_number > animeSegmentEnd);
    if (relative < 1 || outsideSegment) {
      continue;
    }
    targets.push({
      episodeNumber: neighbor.episode_number,
      providerEpisodeNumber: index + offset + 1,
      relativeEpisodeNumber: relative,
    });
  }
  return targets;
};
