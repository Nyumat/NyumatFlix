import type { AniListFranchiseSeason } from "@/lib/anilist-franchise";
import type { FribbAnimeRow, FribbTmdbEntry } from "@/lib/fribb-mapping";
import { normalizeFribbTmdbShowId } from "@/lib/fribb-mapping";
import type { Episode, Season } from "@/lib/domain/typings";

export type SeasonEpisodeSource = {
  id: number;
  episodes?: number | null;
  format?: string | null;
  title?: {
    english?: string | null;
    romaji?: string | null;
  };
};

export type TmdbGroupedFranchiseSeason = {
  seasonNumber: number;
  anilistIds: number[];
};

const fribbTmdbSeasonNumber = (entry: FribbTmdbEntry): number => {
  const season = entry.season;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

const fribbTmdbSeasonNumberForRow = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

export const collectFribbAnilistIdsForTmdbSeason = (
  fribbRows: readonly FribbAnimeRow[],
  tmdbShowId: number,
  seasonNumber: number,
): number[] =>
  fribbRows
    .filter(
      (row) =>
        normalizeFribbTmdbShowId(row.themoviedb_id) === tmdbShowId &&
        fribbTmdbSeasonNumberForRow(row) === seasonNumber,
    )
    .sort((left, right) => {
      const offsetDiff =
        (left.episode_offset?.tmdb ?? 0) - (right.episode_offset?.tmdb ?? 0);
      if (offsetDiff !== 0) return offsetDiff;
      return left.anilist_id - right.anilist_id;
    })
    .map((row) => row.anilist_id);

export const mergeAnilistIdsByFribbOffset = (
  franchiseIds: readonly number[],
  fribbIds: readonly number[],
  fribbRows: readonly FribbAnimeRow[],
): number[] => {
  const merged = [...new Set([...franchiseIds, ...fribbIds])];
  const offsetFor = (anilistId: number): number =>
    fribbRows.find((row) => row.anilist_id === anilistId)?.episode_offset
      ?.tmdb ?? 0;

  return merged.sort(
    (left, right) => offsetFor(left) - offsetFor(right) || left - right,
  );
};

export const groupFranchiseSeasonsByTmdb = (
  franchiseSeasons: readonly AniListFranchiseSeason[],
  fribbByAnilistId: Record<number, FribbTmdbEntry>,
  tmdbShowId: number,
  fribbRows?: readonly FribbAnimeRow[],
): TmdbGroupedFranchiseSeason[] | null => {
  const groups = new Map<number, number[]>();
  let mappedCount = 0;

  for (const { anilistId } of franchiseSeasons) {
    const entry = fribbByAnilistId[anilistId];
    if (!entry?.tv || entry.tv !== tmdbShowId) continue;

    mappedCount += 1;
    const tmdbSeason = fribbTmdbSeasonNumber(entry);
    const bucket = groups.get(tmdbSeason) ?? [];
    bucket.push(anilistId);
    groups.set(tmdbSeason, bucket);
  }

  if (mappedCount === 0 || groups.size >= franchiseSeasons.length) {
    return null;
  }

  const grouped = [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([seasonNumber, anilistIds]) => ({ seasonNumber, anilistIds }));

  if (!fribbRows?.length) {
    return grouped;
  }

  return grouped.map(({ seasonNumber, anilistIds }) => ({
    seasonNumber,
    anilistIds: mergeAnilistIdsByFribbOffset(
      anilistIds,
      collectFribbAnilistIdsForTmdbSeason(fribbRows, tmdbShowId, seasonNumber),
      fribbRows,
    ),
  }));
};

export const buildMergedEpisodesForTmdbSeason = (input: {
  tmdbShowId: number;
  seasonNumber: number;
  anilistIds: readonly number[];
  seasonsByAnilistId: ReadonlyMap<number, SeasonEpisodeSource>;
  fribbRows: readonly FribbAnimeRow[];
  buildEpisodes: (media: SeasonEpisodeSource) => Episode[];
}): Episode[] => {
  const seasonRows = input.fribbRows
    .filter(
      (row) =>
        normalizeFribbTmdbShowId(row.themoviedb_id) === input.tmdbShowId &&
        fribbTmdbSeasonNumberForRow(row) === input.seasonNumber &&
        input.anilistIds.includes(row.anilist_id),
    )
    .sort(
      (left, right) =>
        (left.episode_offset?.tmdb ?? 0) - (right.episode_offset?.tmdb ?? 0),
    );

  const segments =
    seasonRows.length > 0
      ? [
          ...seasonRows.map((row) => row.anilist_id),
          ...input.anilistIds.filter(
            (anilistId) =>
              !seasonRows.some((row) => row.anilist_id === anilistId),
          ),
        ]
      : [...input.anilistIds];

  const episodes: Episode[] = [];

  for (const anilistId of segments) {
    const media = input.seasonsByAnilistId.get(anilistId);
    if (!media) continue;

    const row = seasonRows.find(
      (candidate) => candidate.anilist_id === anilistId,
    );
    const offset = row?.episode_offset?.tmdb ?? 0;
    const segmentStart =
      offset > 0
        ? offset + 1
        : episodes.length > 0
          ? (episodes[episodes.length - 1]?.episode_number ?? 0) + 1
          : 1;

    for (const episode of input.buildEpisodes(media)) {
      episodes.push({
        ...episode,
        episode_number: segmentStart + episode.episode_number - 1,
        id: media.id * 10_000 + segmentStart + episode.episode_number - 1,
        sourceAnilistId: media.id,
        sourceEpisodeNumber: episode.episode_number,
      });
    }
  }

  return episodes;
};

export const collapseSeasonSummariesForTmdb = (input: {
  franchiseSeasons: readonly AniListFranchiseSeason[];
  groupedSeasons: readonly TmdbGroupedFranchiseSeason[];
  seasonsByAnilistId: ReadonlyMap<number, SeasonEpisodeSource>;
  buildSeason: (media: SeasonEpisodeSource, seasonNumber: number) => Season;
  tmdbSeasons?: readonly Season[];
  mergedEpisodeCountBySeason?: ReadonlyMap<number, number>;
}): Season[] =>
  input.groupedSeasons.map(({ seasonNumber, anilistIds }) => {
    const primaryId = anilistIds[0];
    const media =
      (primaryId ? input.seasonsByAnilistId.get(primaryId) : undefined) ??
      input.seasonsByAnilistId.get(
        input.franchiseSeasons[seasonNumber - 1]?.anilistId ?? 0,
      );
    if (!media) {
      return {
        id: seasonNumber,
        name: `Season ${seasonNumber}`,
        season_number: seasonNumber,
        episode_count: 0,
        air_date: null,
        overview: "",
        poster_path: null,
      };
    }

    const tmdbSeason = input.tmdbSeasons?.find(
      (season) => season.season_number === seasonNumber,
    );
    const base = input.buildSeason(media, seasonNumber);

    const mergedEpisodeCount =
      input.mergedEpisodeCountBySeason?.get(seasonNumber) ?? 0;

    return {
      ...base,
      name: tmdbSeason?.name ?? base.name,
      episode_count: Math.max(
        mergedEpisodeCount,
        tmdbSeason?.episode_count ?? 0,
        base.episode_count,
      ),
      air_date: tmdbSeason?.air_date ?? base.air_date,
      overview: tmdbSeason?.overview ?? base.overview,
      poster_path: tmdbSeason?.poster_path ?? base.poster_path,
    };
  });
