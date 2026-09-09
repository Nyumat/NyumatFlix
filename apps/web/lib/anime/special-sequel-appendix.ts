import type { MappingSegment } from "@/lib/anime/tmdb-anilist-map";

export type TmdbZeroSeasonSpecialRef = {
  tmdbShowId: number;
  tmdbEpisode: number;
};

const KNOWN_SPECIAL_SEQUEL_IDS: ReadonlyMap<number, readonly number[]> = new Map([
  [146984, [162314]],
]);

const KNOWN_TMDB_ZERO_SEASON_SPECIALS: ReadonlyMap<
  number,
  TmdbZeroSeasonSpecialRef
> = new Map([
  [146984, { tmdbShowId: 1429, tmdbEpisode: 36 }],
  [162314, { tmdbShowId: 1429, tmdbEpisode: 37 }],
]);

export const getKnownSpecialSequelIds = (anilistId: number): readonly number[] =>
  KNOWN_SPECIAL_SEQUEL_IDS.get(anilistId) ?? [];

export const isKnownTmdbZeroSeasonSpecial = (anilistId: number): boolean =>
  KNOWN_TMDB_ZERO_SEASON_SPECIALS.has(anilistId);

export const getKnownTmdbZeroSeasonSpecialRef = (
  anilistId: number,
): TmdbZeroSeasonSpecialRef | null =>
  KNOWN_TMDB_ZERO_SEASON_SPECIALS.get(anilistId) ?? null;

export const resolveKnownSpecialSequelAppendixIds = (
  tailAnilistId: number,
): number[] => {
  const appendix: number[] = [];
  let currentId: number | null = tailAnilistId;

  for (let depth = 0; depth < 3 && currentId; depth += 1) {
    const sequels = getKnownSpecialSequelIds(currentId);
    const nextId = sequels[0];
    if (!nextId || appendix.includes(nextId)) {
      break;
    }
    appendix.push(nextId);
    currentId = nextId;
  }

  return appendix;
};

export const appendKnownSpecialSequelIds = (
  anilistIds: readonly number[],
): number[] => {
  if (anilistIds.length === 0) {
    return [];
  }

  const merged = [...anilistIds];
  const tailId = merged[merged.length - 1];
  if (!tailId) {
    return merged;
  }

  for (const sequelId of resolveKnownSpecialSequelAppendixIds(tailId)) {
    if (!merged.includes(sequelId)) {
      merged.push(sequelId);
    }
  }

  return merged;
};

export const extendMappingSegmentsWithKnownSpecialSequels = (
  segments: readonly MappingSegment[],
): MappingSegment[] => {
  if (segments.length === 0) {
    return [];
  }

  const extended = [...segments];
  let tail = extended[extended.length - 1]!;

  for (const sequelId of resolveKnownSpecialSequelAppendixIds(
    tail.anilistMediaId,
  )) {
    if (extended.some((segment) => segment.anilistMediaId === sequelId)) {
      break;
    }

    const startEpisode = tail.endEpisode + 1;
    const appendixSegment: MappingSegment = {
      startEpisode,
      endEpisode: startEpisode,
      anilistMediaId: sequelId,
    };
    extended.push(appendixSegment);
    tail = appendixSegment;
  }

  return extended;
};
