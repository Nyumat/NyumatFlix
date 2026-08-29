import "server-only";

import type { MalAnimeWithRelated } from "@/lib/mal/client";
import type { FribbAnimeRow } from "@/lib/fribb-mapping";
import {
  getFribbAnimeList,
  normalizeFribbTmdbShowId,
} from "@/lib/fribb-mapping";

export type FallbackRelationNode = {
  id: number;
  type?: string | null;
  format?: string | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
  } | null;
  seasonYear?: number | null;
  episodes?: number | null;
};

export type FallbackRelationMedia = {
  id: number;
  format?: string | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
  } | null;
  seasonYear?: number | null;
  relations?: {
    edges?: Array<{
      relationType?: string | null;
      node?: FallbackRelationNode | null;
    }> | null;
  } | null;
};

const fribbTmdbSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

/**
 * All AniList IDs that Fribb maps onto the same TMDB TV show, ordered by
 * TMDB season then episode offset (split cours stay separate entries).
 */
export const collectFribbTmdbFranchiseSeasonIds = (
  rows: readonly FribbAnimeRow[],
  entryAnilistId: number,
): number[] | null => {
  const entry = rows.find((row) => row.anilist_id === entryAnilistId);
  if (!entry) return null;

  const tmdbShowId = normalizeFribbTmdbShowId(entry.themoviedb_id);
  if (!tmdbShowId) return null;

  const siblings = rows
    .filter((row) => normalizeFribbTmdbShowId(row.themoviedb_id) === tmdbShowId)
    .sort((left, right) => {
      const seasonDiff =
        fribbTmdbSeasonNumber(left) - fribbTmdbSeasonNumber(right);
      if (seasonDiff !== 0) return seasonDiff;
      const offsetDiff =
        (left.episode_offset?.tmdb ?? 0) - (right.episode_offset?.tmdb ?? 0);
      if (offsetDiff !== 0) return offsetDiff;
      return left.anilist_id - right.anilist_id;
    });

  const seasonIds = [...new Set(siblings.map((row) => row.anilist_id))];
  if (!seasonIds.includes(entryAnilistId)) return null;
  return seasonIds;
};

export const resolveFribbTmdbFranchiseSeasonIds = async (
  entryAnilistId: number,
): Promise<number[] | null> => {
  try {
    return collectFribbTmdbFranchiseSeasonIds(
      await getFribbAnimeList(),
      entryAnilistId,
    );
  } catch {
    return null;
  }
};

const malMediaTypeToAniListFormat = (
  mediaType: string | undefined,
): string | null => {
  if (!mediaType) return null;
  switch (mediaType) {
    case "tv":
      return "TV";
    case "ona":
      return "ONA";
    case "ova":
      return "OVA";
    case "movie":
      return "MOVIE";
    case "special":
    case "tv_special":
      return "SPECIAL";
    case "music":
      return "MUSIC";
    default:
      return mediaType.toUpperCase();
  }
};

const malRelationToAniList = (relationType: string): string | null => {
  switch (relationType.toLowerCase()) {
    case "prequel":
      return "PREQUEL";
    case "sequel":
      return "SEQUEL";
    case "parent_story":
      return "PARENT";
    case "side_story":
      return "SIDE_STORY";
    default:
      return null;
  }
};

export const malAnimeToRelationMedia = (
  anilistId: number,
  mal: MalAnimeWithRelated,
  malToAnilist: ReadonlyMap<number, number>,
): FallbackRelationMedia => {
  const edges = (mal.related_anime ?? [])
    .map((edge) => {
      const relationType = malRelationToAniList(edge.relation_type);
      const relatedAnilistId = malToAnilist.get(edge.node.id);
      if (!relationType || !relatedAnilistId) return null;

      return {
        relationType,
        node: {
          id: relatedAnilistId,
          type: "ANIME",
          format: malMediaTypeToAniListFormat(edge.node.media_type),
          title: {
            romaji: edge.node.title,
            english: edge.node.alternative_titles?.en ?? null,
          },
          seasonYear: edge.node.start_season?.year ?? null,
        } satisfies FallbackRelationNode,
      };
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

  return {
    id: anilistId,
    format: malMediaTypeToAniListFormat(mal.media_type),
    title: {
      romaji: mal.title,
      english: mal.alternative_titles?.en ?? null,
    },
    seasonYear: mal.start_season?.year ?? null,
    relations: { edges },
  };
};
