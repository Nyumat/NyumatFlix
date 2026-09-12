import "server-only";

import { KITSU_API_BASE, type KitsuAnimeResource } from "@/lib/kitsu/client";

const KITSU_FETCH_TIMEOUT_MS = 8_000;

const KITSU_DETAIL_FIELDS = [
  "canonicalTitle",
  "titles",
  "synopsis",
  "description",
  "startDate",
  "subtype",
  "status",
  "episodeCount",
  "episodeLength",
  "youtubeVideoId",
  "averageRating",
  "popularityRank",
  "ratingRank",
  "userCount",
  "favoritesCount",
  "nsfw",
  "ageRating",
  "posterImage",
  "coverImage",
].join(",");

export type KitsuDetailResult = {
  item: KitsuAnimeResource;
  anilistId: number | null;
  malId: number | null;
};

type KitsuDetailResponse = {
  data?: KitsuAnimeResource | null;
  included?: Array<{
    type?: string;
    attributes?: {
      externalSite?: string | null;
      externalId?: string | null;
    } | null;
  }>;
};

const parsePositiveInt = (
  value: string | number | null | undefined,
): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const readMappings = (
  included: KitsuDetailResponse["included"],
): { anilistId: number | null; malId: number | null } => {
  let anilistId: number | null = null;
  let malId: number | null = null;
  for (const entry of included ?? []) {
    if (entry?.type !== "mappings") continue;
    const site = entry.attributes?.externalSite?.trim().toLowerCase();
    const externalId = parsePositiveInt(entry.attributes?.externalId);
    if (!externalId) continue;
    if (site === "anilist/anime" && !anilistId) anilistId = externalId;
    if (site === "myanimelist/anime" && !malId) malId = externalId;
  }
  return { anilistId, malId };
};

const fetchKitsuDetail = async (
  path: string,
): Promise<KitsuDetailResult | null> => {
  let response: Response;
  try {
    response = await fetch(`${KITSU_API_BASE}${path}`, {
      signal: AbortSignal.timeout(KITSU_FETCH_TIMEOUT_MS),
      headers: { Accept: "application/vnd.api+json" },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let payload: KitsuDetailResponse;
  try {
    payload = (await response.json()) as KitsuDetailResponse;
  } catch {
    return null;
  }
  if (!payload.data || payload.data.type !== "anime") return null;

  const { anilistId, malId } = readMappings(payload.included);
  return { item: payload.data, anilistId, malId };
};

export const readKitsuAnimeById = async (
  kitsuId: number,
): Promise<KitsuDetailResult | null> => {
  if (!Number.isInteger(kitsuId) || kitsuId <= 0) return null;
  const params = new URLSearchParams({
    "fields[anime]": KITSU_DETAIL_FIELDS,
    "fields[mappings]": "externalSite,externalId",
    include: "mappings",
  });
  return fetchKitsuDetail(`/anime/${kitsuId}?${params.toString()}`);
};

export const readKitsuAnimeByMalId = async (
  malId: number,
): Promise<KitsuDetailResult | null> => {
  if (!Number.isInteger(malId) || malId <= 0) return null;
  const params = new URLSearchParams({
    "filter[externalSite]": "myanimelist/anime",
    "filter[externalId]": String(malId),
    "fields[anime]": KITSU_DETAIL_FIELDS,
    "fields[mappings]": "externalSite,externalId",
    include: "item",
    "page[limit]": "1",
  });

  let response: Response;
  try {
    response = await fetch(`${KITSU_API_BASE}/mappings?${params.toString()}`, {
      signal: AbortSignal.timeout(KITSU_FETCH_TIMEOUT_MS),
      headers: { Accept: "application/vnd.api+json" },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let payload: {
    data?: Array<{
      relationships?: {
        item?: {
          data?: { type?: string | null; id?: string | null } | null;
        } | null;
      } | null;
    }>;
    included?: KitsuAnimeResource[];
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return null;
  }

  const kitsuId = parsePositiveInt(
    payload.data?.[0]?.relationships?.item?.data?.type === "anime"
      ? (payload.data[0]?.relationships?.item?.data?.id ?? null)
      : null,
  );
  if (!kitsuId) return null;
  const detail = await readKitsuAnimeById(kitsuId);
  if (!detail) return null;
  return { ...detail, malId: detail.malId ?? malId };
};
