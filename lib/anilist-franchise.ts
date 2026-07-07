import { ANILIST_ENDPOINT } from "@/lib/anilist";
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
      isAnimeRelationNode(edge.node ?? undefined),
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
    if (!media) break;

    const prequel = getAnimeRelation(media, "PREQUEL");
    if (!prequel) break;

    currentId = prequel.id;
  }

  return currentId;
};

const collectSequelChain = async (rootAnilistId: number): Promise<number[]> => {
  const seasonIds = [rootAnilistId];
  const visited = new Set<number>([rootAnilistId]);
  let currentId = rootAnilistId;

  while (true) {
    const media = await fetchRelationMedia(currentId);
    if (!media) break;

    const sequel = getAnimeRelation(media, "SEQUEL");
    if (!sequel || visited.has(sequel.id)) break;

    seasonIds.push(sequel.id);
    visited.add(sequel.id);
    currentId = sequel.id;
  }

  return seasonIds;
};

export const resolveAniListFranchise = async (
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

export const stripSeasonSuffix = (title: string) =>
  title
    .replace(
      /\s*(?:season|cour)\s*\d+(?:nd|rd|th|st)?(?:\s*(?:season|cour))?.*$/i,
      "",
    )
    .replace(/\s+\d(?:st|nd|rd|th)\s+season.*$/i, "")
    .trim();
