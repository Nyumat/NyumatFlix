import { ANILIST_ENDPOINT } from "@/lib/anilist";
import { normalizeAnimeTitle } from "@/lib/scrape/anime/title-match";
import { unstable_cache } from "next/cache";
import { cache } from "react";

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

const fetchRelationMedia = async (
  anilistId: number,
): Promise<RelationMedia | null> => {
  return getCachedRelationMedia(anilistId);
};

const fetchRelationMediaUncached = async (
  anilistId: number,
): Promise<RelationMedia | null> => {
  try {
    const response = await fetch(ANILIST_ENDPOINT, {
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

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      data?: { Media?: RelationMedia | null };
    };

    return payload.data?.Media ?? null;
  } catch {
    return null;
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

const findFranchiseRoot = async (entryAnilistId: number): Promise<number> => {
  let currentId = entryAnilistId;
  const visited = new Set<number>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const media = await fetchRelationMedia(currentId);
    if (!media || !isSeasonChainMedia(media)) break;

    const prequel = getAnimeRelation(media, "PREQUEL");
    if (!prequel) break;

    currentId = prequel.id;
  }

  return currentId;
};

export const collectForwardSequelChain = async (
  entryAnilistId: number,
): Promise<number[]> => {
  const seasonIds = [entryAnilistId];
  const visited = new Set<number>([entryAnilistId]);
  let currentId = entryAnilistId;

  while (true) {
    const media = await fetchRelationMedia(currentId);
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
    const media = await fetchRelationMedia(currentId);
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
    const media = await fetchRelationMedia(current);
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

const collectSequelChain = async (rootAnilistId: number): Promise<number[]> =>
  collectForwardSequelChain(rootAnilistId);

const resolveAniListFranchiseUncached = async (
  entryAnilistId: number,
): Promise<AniListFranchise> => {
  const rootAnilistId = await findFranchiseRoot(entryAnilistId);
  const seasonIds = await collectSequelChain(rootAnilistId);
  const entrySeasonNumber = Math.max(
    1,
    seasonIds.findIndex((id) => id === entryAnilistId) + 1,
  );

  return {
    rootAnilistId,
    entryAnilistId,
    entrySeasonNumber,
    seasons: seasonIds.map((anilistId, index) => ({
      anilistId,
      seasonNumber: index + 1,
    })),
  };
};

export const resolveAniListFranchise = unstable_cache(
  resolveAniListFranchiseUncached,
  ["anilist-franchise-resolve-v2"],
  { revalidate: 3600 },
);

export const stripSeasonSuffix = (title: string) =>
  title
    .replace(
      /\s*(?:season|cour)\s*\d+(?:nd|rd|th|st)?(?:\s*(?:season|cour))?.*$/i,
      "",
    )
    .replace(/\s+\d(?:st|nd|rd|th)\s+season.*$/i, "")
    .trim();

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
