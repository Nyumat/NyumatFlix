import "server-only";

import { ANILIST_ENDPOINT } from "@/lib/anilist";
import {
  malAnimeToRelationMedia,
  resolveFribbTmdbFranchiseSeasonIds,
} from "@/lib/anilist-franchise-fallback";
import { getMalAnimeWithRelated, MalClientError } from "@/lib/mal/client";
import {
  resolveAnilistToMalFromMappings,
  resolveMalToAnilist,
} from "@/lib/mal/id-resolver";
import {
  normalizeAnimeTitle,
  stripSeasonSuffix,
} from "@/lib/scrape/anime/title-match";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export { stripSeasonSuffix };

const ANILIST_FETCH_TIMEOUT_MS = 8000;

const _ANIME_RELATION_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "PARENT",
  "SIDE_STORY",
]);

type RelationNode = {
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

type RelationEdge = {
  relationType?: string | null;
  node?: RelationNode | null;
};

type RelationMedia = {
  id: number;
  format?: string | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
  } | null;
  seasonYear?: number | null;
  relations?: {
    edges?: RelationEdge[] | null;
  } | null;
};

export type AniListFranchiseSeason = {
  anilistId: number;
  seasonNumber: number;
};

export type AniListFranchise = {
  rootAnilistId: number;
  entryAnilistId: number;
  entrySeasonNumber: number;
  seasons: AniListFranchiseSeason[];
};

const RELATION_WALK_QUERY = `
  query AniListRelationWalk($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      format
      title {
        romaji
        english
      }
      seasonYear
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            title {
              romaji
              english
            }
            seasonYear
            episodes
          }
        }
      }
    }
  }
`;

const isAnimeRelationNode = (node: RelationNode | null | undefined) =>
  node?.type === "ANIME" &&
  node.id > 0 &&
  node.format !== "MANGA" &&
  node.format !== "NOVEL";

/**
 * AniList marks side-story OVAs/movies as PREQUEL/SEQUEL of mainline TV
 * entries (e.g. Attack on Titan: No Regrets is a "PREQUEL" of Attack on
 * Titan). Walking into those would make a 2-episode OVA the franchise root
 * and shift every real season by one. Only series-like formats participate
 * in the season chain; unknown formats stay allowed to be safe.
 */
const NON_SEASON_CHAIN_FORMATS = new Set(["OVA", "SPECIAL", "MOVIE", "MUSIC"]);

export const isSeasonChainRelationNode = (
  node: RelationNode | null | undefined,
): boolean =>
  isAnimeRelationNode(node) &&
  !NON_SEASON_CHAIN_FORMATS.has(node?.format ?? "");

const isSeasonChainMedia = (media: RelationMedia): boolean =>
  !NON_SEASON_CHAIN_FORMATS.has(media.format ?? "");

/**
 * Transient AniList failure (rate limit, timeout, 5xx) during a relation
 * walk. Distinguished from "media not found" so a mid-walk failure can't be
 * mistaken for the genuine end of a season chain and cached that way.
 */
export class AnilistFranchiseFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnilistFranchiseFetchError";
  }
}

export const isAnilistFranchiseFetchError = (
  error: unknown,
): error is AnilistFranchiseFetchError => {
  if (error instanceof AnilistFranchiseFetchError) return true;
  if (error instanceof Error && error.name === "AnilistFranchiseFetchError") {
    return true;
  }
  return (
    error instanceof Error && error.message.startsWith("AniList relation fetch")
  );
};

type RelationMediaFetcher = (
  anilistId: number,
) => Promise<RelationMedia | null>;

/** Throws AnilistFranchiseFetchError on transient failures. */
const fetchRelationMedia: RelationMediaFetcher = async (anilistId) => {
  return getCachedRelationMedia(anilistId);
};

/** Swallows transient failures — the walk truncates at that point instead. */
const fetchRelationMediaBestEffort: RelationMediaFetcher = async (
  anilistId,
) => {
  try {
    return await getCachedRelationMedia(anilistId);
  } catch (error) {
    if (isAnilistFranchiseFetchError(error)) return null;
    throw error;
  }
};

const fetchRelationMediaUncached = async (
  anilistId: number,
): Promise<RelationMedia | null> => {
  let response: Response;
  try {
    response = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: RELATION_WALK_QUERY,
        variables: { id: anilistId },
      }),
      signal: AbortSignal.timeout(ANILIST_FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
  } catch (error) {
    throw new AnilistFranchiseFetchError(
      `AniList relation fetch failed for ${anilistId}`,
      { cause: error },
    );
  }

  // AniList returns 404 for unknown media — a real "does not exist".
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new AnilistFranchiseFetchError(
      `AniList relation fetch returned ${response.status} for ${anilistId}`,
    );
  }

  try {
    const payload = (await response.json()) as {
      data?: { Media?: RelationMedia | null };
    };
    return payload.data?.Media ?? null;
  } catch (error) {
    throw new AnilistFranchiseFetchError(
      `AniList relation payload unreadable for ${anilistId}`,
      { cause: error },
    );
  }
};

const getCachedRelationMedia = cache(fetchRelationMediaUncached);

const getAnimeRelation = (
  media: RelationMedia,
  relationType: "PREQUEL" | "SEQUEL",
): RelationNode | null => {
  const matches = (media.relations?.edges ?? []).filter(
    (edge) =>
      edge.relationType === relationType &&
      isSeasonChainRelationNode(edge.node ?? undefined) &&
      areAnimeFranchiseTitlesCompatible(media.title, edge.node?.title),
  );

  if (matches.length === 0) return null;

  return (
    matches
      .map((edge) => edge.node)
      .filter((node): node is RelationNode => Boolean(node))
      .sort((a, b) => (a.seasonYear ?? 0) - (b.seasonYear ?? 0))
      .at(relationType === "PREQUEL" ? 0 : -1) ?? null
  );
};

const getAnimeRelationForSeasonChain = (
  media: RelationMedia,
  relationType: "PREQUEL" | "SEQUEL",
): RelationNode | null => {
  const matches = (media.relations?.edges ?? []).filter(
    (edge) =>
      edge.relationType === relationType &&
      isSeasonChainRelationNode(edge.node ?? undefined),
  );

  if (matches.length === 0) return null;

  return (
    matches
      .map((edge) => edge.node)
      .filter((node): node is RelationNode => Boolean(node))
      .sort((a, b) => (a.seasonYear ?? 0) - (b.seasonYear ?? 0))
      .at(relationType === "PREQUEL" ? 0 : -1) ?? null
  );
};

const findFranchiseRoot = async (
  entryAnilistId: number,
  fetchMedia: RelationMediaFetcher,
): Promise<number> => {
  let currentId = entryAnilistId;
  const visited = new Set<number>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const media = await fetchMedia(currentId);
    if (!media || !isSeasonChainMedia(media)) break;

    const prequel = getAnimeRelation(media, "PREQUEL");
    if (!prequel) break;

    currentId = prequel.id;
  }

  return currentId;
};

export const collectForwardSequelChain = async (
  entryAnilistId: number,
  fetchMedia: RelationMediaFetcher = fetchRelationMediaBestEffort,
): Promise<number[]> => {
  const seasonIds = [entryAnilistId];
  const visited = new Set<number>([entryAnilistId]);
  let currentId = entryAnilistId;

  while (true) {
    const media = await fetchMedia(currentId);
    // Non-series entries (OVAs, movies) stand alone: their "sequel" is the
    // mainline show, which has its own franchise page.
    if (!media || !isSeasonChainMedia(media)) break;

    const sequel = getAnimeRelation(media, "SEQUEL");
    if (!sequel || visited.has(sequel.id)) break;

    seasonIds.push(sequel.id);
    visited.add(sequel.id);
    currentId = sequel.id;
  }

  return seasonIds;
};

const collectForwardSeasonChainForTmdb = async (
  entryAnilistId: number,
): Promise<number[]> => {
  const seasonIds = [entryAnilistId];
  const visited = new Set<number>([entryAnilistId]);
  let currentId = entryAnilistId;

  while (true) {
    const media = await fetchRelationMediaBestEffort(currentId);
    if (!media) break;

    const sequel = getAnimeRelationForSeasonChain(media, "SEQUEL");
    if (!sequel || visited.has(sequel.id)) break;

    seasonIds.push(sequel.id);
    visited.add(sequel.id);
    currentId = sequel.id;
  }

  return seasonIds;
};

export const mergeBidirectionalSeasonChain = (
  backwardPrequels: readonly number[],
  forwardFromEntry: readonly number[],
  tmdbSeasonCount: number,
): number[] =>
  [...backwardPrequels, ...forwardFromEntry].slice(0, tmdbSeasonCount);

export const pickAnilistIdFromSeasonChain = (
  chain: readonly number[],
  seasonNumber: number,
): number | null => {
  const index = seasonNumber - 1;
  if (index < 0 || index >= chain.length) return null;
  return chain[index] ?? null;
};

export const resolveAnilistSeasonChainForTmdbShow = async (
  entryAnilistId: number,
  tmdbSeasonCount: number,
): Promise<number[]> => {
  if (tmdbSeasonCount <= 0) return [];

  const forward = await collectForwardSeasonChainForTmdb(entryAnilistId);
  const backwardNeeded = Math.max(0, tmdbSeasonCount - forward.length);
  const backward: number[] = [];
  let current = entryAnilistId;

  for (let index = 0; index < backwardNeeded; index++) {
    const media = await fetchRelationMediaBestEffort(current);
    if (!media) break;

    const prequel = getAnimeRelationForSeasonChain(media, "PREQUEL");
    if (
      !prequel ||
      forward.includes(prequel.id) ||
      backward.includes(prequel.id)
    ) {
      break;
    }

    backward.unshift(prequel.id);
    current = prequel.id;
  }

  return mergeBidirectionalSeasonChain(backward, forward, tmdbSeasonCount);
};

export const buildFranchiseFromSeasonIds = (
  entryAnilistId: number,
  seasonIds: readonly number[],
): AniListFranchise => {
  const ids = seasonIds.length > 0 ? [...seasonIds] : [entryAnilistId];
  const entrySeasonNumber = Math.max(
    1,
    ids.findIndex((id) => id === entryAnilistId) + 1,
  );

  return {
    rootAnilistId: ids[0] ?? entryAnilistId,
    entryAnilistId,
    entrySeasonNumber,
    seasons: ids.map((anilistId, index) => ({
      anilistId,
      seasonNumber: index + 1,
    })),
  };
};

const resolveAniListFranchiseUncached = async (
  entryAnilistId: number,
  fetchMedia: RelationMediaFetcher,
): Promise<AniListFranchise> => {
  const rootAnilistId = await findFranchiseRoot(entryAnilistId, fetchMedia);
  const seasonIds = await collectForwardSequelChain(rootAnilistId, fetchMedia);
  return buildFranchiseFromSeasonIds(entryAnilistId, seasonIds);
};

const fetchRelationMediaFromMalUncached: RelationMediaFetcher = async (
  anilistId,
) => {
  const malId = await resolveAnilistToMalFromMappings(anilistId);
  if (!malId) return null;

  const mal = await getMalAnimeWithRelated(malId);
  if (!mal) return null;

  const malToAnilist = new Map<number, number>([[mal.id, anilistId]]);
  for (const edge of mal.related_anime ?? []) {
    const relatedAnilistId = await resolveMalToAnilist(edge.node.id);
    if (relatedAnilistId) {
      malToAnilist.set(edge.node.id, relatedAnilistId);
    }
  }

  return malAnimeToRelationMedia(anilistId, mal, malToAnilist);
};

const fetchRelationMediaFromMal = cache(fetchRelationMediaFromMalUncached);

const resolveFranchiseFromMalRelations = async (
  entryAnilistId: number,
): Promise<AniListFranchise | null> => {
  try {
    return await resolveAniListFranchiseUncached(
      entryAnilistId,
      fetchRelationMediaFromMal,
    );
  } catch (error) {
    if (error instanceof MalClientError) return null;
    throw error;
  }
};

/**
 * Multi-season fallbacks only. A 1-id result is indistinguishable from a
 * truncated chain, so we never let unstable_cache store that.
 */
export const pickCachedFranchiseFallback = (
  entryAnilistId: number,
  fribbSeasonIds: readonly number[] | null,
  malFranchise: AniListFranchise | null,
): AniListFranchise | null => {
  if (fribbSeasonIds && fribbSeasonIds.length >= 2) {
    return buildFranchiseFromSeasonIds(entryAnilistId, fribbSeasonIds);
  }
  if (malFranchise && malFranchise.seasons.length >= 2) {
    return malFranchise;
  }
  return null;
};

const resolveMultiSeasonFranchiseFallback = async (
  entryAnilistId: number,
): Promise<AniListFranchise | null> => {
  const fribbSeasonIds =
    await resolveFribbTmdbFranchiseSeasonIds(entryAnilistId);
  if (fribbSeasonIds && fribbSeasonIds.length >= 2) {
    return pickCachedFranchiseFallback(entryAnilistId, fribbSeasonIds, null);
  }

  const malFranchise = await resolveFranchiseFromMalRelations(entryAnilistId);
  return pickCachedFranchiseFallback(
    entryAnilistId,
    fribbSeasonIds,
    malFranchise,
  );
};

/**
 * Strict walk: any transient AniList failure throws, so unstable_cache never
 * stores a chain that was truncated by a rate limit or timeout (that bug
 * hid whole seasons — e.g. AOT showing 3 of 4 seasons — for the full TTL).
 * TMDB/Fribb and MAL relation graphs are complete alternate sources, so
 * those results are safe to cache when AniList 429s.
 */
const resolveAniListFranchiseCached = unstable_cache(
  async (entryAnilistId: number) => {
    try {
      return await resolveAniListFranchiseUncached(
        entryAnilistId,
        fetchRelationMedia,
      );
    } catch (error) {
      if (!isAnilistFranchiseFetchError(error)) throw error;
      const fallback =
        await resolveMultiSeasonFranchiseFallback(entryAnilistId);
      if (fallback) return fallback;
      throw error;
    }
  },
  ["anilist-franchise-resolve-v4"],
  { revalidate: 3600 },
);

export const resolveAniListFranchise = async (
  entryAnilistId: number,
): Promise<AniListFranchise> => {
  try {
    return await resolveAniListFranchiseCached(entryAnilistId);
  } catch (error) {
    if (!isAnilistFranchiseFetchError(error)) throw error;
    const fallback = await resolveMultiSeasonFranchiseFallback(entryAnilistId);
    if (fallback) return fallback;
    return buildFranchiseFromSeasonIds(entryAnilistId, [entryAnilistId]);
  }
};

type AnimeTitle =
  | {
      romaji?: string | null;
      english?: string | null;
    }
  | null
  | undefined;

const normalizedFranchiseTitles = (title: AnimeTitle): string[] =>
  [...new Set([title?.english, title?.romaji])]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => normalizeAnimeTitle(stripSeasonSuffix(value)))
    .filter(Boolean);

/**
 * AniList can label unrelated specials as sequels. Keep a relation in the
 * season chain only when its English or Romaji title shares the same base.
 */
export const areAnimeFranchiseTitlesCompatible = (
  current: AnimeTitle,
  related: AnimeTitle,
): boolean => {
  const currentTitles = normalizedFranchiseTitles(current);
  const relatedTitles = normalizedFranchiseTitles(related);

  return currentTitles.some((currentTitle) =>
    relatedTitles.some(
      (relatedTitle) =>
        currentTitle === relatedTitle ||
        relatedTitle.startsWith(`${currentTitle} `) ||
        currentTitle.startsWith(`${relatedTitle} `),
    ),
  );
};
