import type { AniListFranchiseSeason } from "@/lib/anilist-franchise";
import type { FribbAnimeRow, FribbTmdbEntry } from "@/lib/fribb-mapping";
import { normalizeFribbTmdbShowId } from "@/lib/fribb-mapping";
import type { Episode, Season } from "@/lib/domain/typings";
import type { AniListTvMedia } from "@/lib/anilist-tv-detail";

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

export const groupFranchiseSeasonsByTmdb = (
  franchiseSeasons: readonly AniListFranchiseSeason[],
  fribbByAnilistId: Record<number, FribbTmdbEntry>,
  tmdbShowId: number,
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

  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([seasonNumber, anilistIds]) => ({ seasonNumber, anilistIds }));
};

export const buildMergedEpisodesForTmdbSeason = (input: {
  tmdbShowId: number;
  seasonNumber: number;
  anilistIds: readonly number[];
  seasonsByAnilistId: ReadonlyMap<number, AniListTvMedia>;
  fribbRows: readonly FribbAnimeRow[];
  buildEpisodes: (media: AniListTvMedia) => Episode[];
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
      ? seasonRows.map((row) => row.anilist_id)
      : [...input.anilistIds];

  const episodes: Episode[] = [];

  for (const anilistId of segments) {
    const media = input.seasonsByAnilistId.get(anilistId);
    if (!media) continue;

    const row = seasonRows.find(
      (candidate) => candidate.anilist_id === anilistId,
    );
    const offset = row?.episode_offset?.tmdb ?? 0;
    const segmentStart = offset > 0 ? offset + 1 : episodes.length + 1;

    for (const episode of input.buildEpisodes(media)) {
      episodes.push({
        ...episode,
        episode_number: segmentStart + episode.episode_number - 1,
        id: media.id * 10_000 + segmentStart + episode.episode_number - 1,
      });
    }
  }

  return episodes;
};

export const collapseSeasonSummariesForTmdb = (input: {
  franchiseSeasons: readonly AniListFranchiseSeason[];
  groupedSeasons: readonly TmdbGroupedFranchiseSeason[];
  seasonsByAnilistId: ReadonlyMap<number, AniListTvMedia>;
  buildSeason: (media: AniListTvMedia, seasonNumber: number) => Season;
  tmdbSeasons?: readonly Season[];
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

    return {
      ...base,
      name: tmdbSeason?.name ?? base.name,
      episode_count: tmdbSeason?.episode_count ?? base.episode_count,
      air_date: tmdbSeason?.air_date ?? base.air_date,
      overview: tmdbSeason?.overview ?? base.overview,
      poster_path: tmdbSeason?.poster_path ?? base.poster_path,
    };
  });
