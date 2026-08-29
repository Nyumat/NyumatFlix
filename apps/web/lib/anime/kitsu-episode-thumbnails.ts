import "server-only";

import { unstable_cache } from "next/cache";

import {
  getAniBridgeMappings,
  resolveAniBridgePlaybackCoords,
} from "@/lib/anime/anibridge-mappings";
import {
  pickAnilistIdFromSeasonChain,
  resolveAnilistSeasonChainForTmdbShow,
} from "@/lib/anilist-franchise";

const KITSU_API = "https://kitsu.io/api/edge";
const KITSU_FETCH_TIMEOUT_MS = 12_000;
const ANILIST_GRAPHQL = "https://graphql.anilist.co";

export type KitsuEpisodeThumbnailMap = Record<number, string>;

type KitsuAnimeSearchResult = {
  id: number;
  canonicalTitle: string;
};

type KitsuEpisodeRecord = {
  number: number;
  thumbnailUrl: string;
};

const kitsuFetch = async (path: string): Promise<Response> =>
  fetch(`${KITSU_API}${path}`, {
    signal: AbortSignal.timeout(KITSU_FETCH_TIMEOUT_MS),
    headers: { Accept: "application/vnd.api+json" },
    next: { revalidate: 60 * 60 * 24 },
  });

const fetchAnilistTitles = async (
  anilistId: number,
): Promise<{ romaji: string | null; english: string | null }> => {
  const response = await fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(KITSU_FETCH_TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 24 },
    body: JSON.stringify({
      query: `query ($id: Int) {
        Media(id: $id) {
          title { romaji english }
        }
      }`,
      variables: { id: anilistId },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList title fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      Media?: { title?: { romaji?: string | null; english?: string | null } };
    };
  };

  return {
    romaji: payload.data?.Media?.title?.romaji ?? null,
    english: payload.data?.Media?.title?.english ?? null,
  };
};

export const pickKitsuAnimeFromSearch = (
  results: readonly KitsuAnimeSearchResult[],
  titles: { romaji: string | null; english: string | null },
): KitsuAnimeSearchResult | null => {
  const candidates = [titles.romaji, titles.english]
    .map((title) => title?.trim())
    .filter((title): title is string => Boolean(title));

  for (const title of candidates) {
    const exact = results.find(
      (entry) =>
        entry.canonicalTitle.localeCompare(title, undefined, {
          sensitivity: "accent",
        }) === 0,
    );
    if (exact) return exact;
  }

  return results[0] ?? null;
};

const searchKitsuAnime = async (
  query: string,
): Promise<readonly KitsuAnimeSearchResult[]> => {
  const params = new URLSearchParams({
    "filter[text]": query,
    "page[limit]": "10",
  });
  const response = await kitsuFetch(`/anime?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Kitsu anime search failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      attributes?: { canonicalTitle?: string | null };
    }>;
  };

  return (payload.data ?? [])
    .map((entry) => {
      const id = Number.parseInt(entry.id, 10);
      const canonicalTitle = entry.attributes?.canonicalTitle?.trim() ?? "";
      if (!Number.isInteger(id) || id <= 0 || !canonicalTitle) return null;
      return { id, canonicalTitle };
    })
    .filter((entry): entry is KitsuAnimeSearchResult => entry !== null);
};

const fetchKitsuEpisodes = async (
  kitsuAnimeId: number,
): Promise<readonly KitsuEpisodeRecord[]> => {
  const episodes: KitsuEpisodeRecord[] = [];
  let offset = 0;

  while (offset < 500) {
    const params = new URLSearchParams({
      "filter[mediaId]": String(kitsuAnimeId),
      "page[limit]": "20",
      "page[offset]": String(offset),
    });
    const response = await kitsuFetch(`/episodes?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Kitsu episode fetch failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{
        attributes?: {
          number?: number | null;
          thumbnail?: { original?: string | null } | null;
        };
      }>;
      links?: { next?: string | null };
    };

    for (const entry of payload.data ?? []) {
      const number = entry.attributes?.number;
      const thumbnailUrl =
        entry.attributes?.thumbnail?.original?.trim() ?? null;
      if (
        typeof number === "number" &&
        Number.isInteger(number) &&
        number > 0 &&
        thumbnailUrl
      ) {
        episodes.push({ number, thumbnailUrl });
      }
    }

    if (!payload.links?.next) break;
    offset += 20;
  }

  return episodes;
};

export const buildKitsuEpisodeThumbnailMap = (
  episodes: readonly KitsuEpisodeRecord[],
): KitsuEpisodeThumbnailMap => {
  const map: KitsuEpisodeThumbnailMap = {};
  for (const episode of episodes) {
    map[episode.number] = episode.thumbnailUrl;
  }
  return map;
};

const resolveKitsuAnimeId = async (
  anilistId: number,
): Promise<number | null> => {
  const titles = await fetchAnilistTitles(anilistId);
  const searchTitle = titles.romaji ?? titles.english;
  if (!searchTitle) return null;

  const results = await searchKitsuAnime(searchTitle);
  const match = pickKitsuAnimeFromSearch(results, titles);
  return match?.id ?? null;
};

const loadKitsuEpisodeThumbnails = async (
  anilistId: number,
): Promise<KitsuEpisodeThumbnailMap> => {
  const kitsuAnimeId = await resolveKitsuAnimeId(anilistId);
  if (!kitsuAnimeId) return {};

  const episodes = await fetchKitsuEpisodes(kitsuAnimeId);
  return buildKitsuEpisodeThumbnailMap(episodes);
};

const fetchKitsuAnimeAttributes = async (
  kitsuAnimeId: number,
): Promise<{
  coverImage?: string | null;
  posterImage?: string | null;
} | null> => {
  const response = await kitsuFetch(`/anime/${kitsuAnimeId}`);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: {
      attributes?: {
        coverImage?: { large?: string | null; original?: string | null } | null;
        posterImage?: {
          large?: string | null;
          original?: string | null;
        } | null;
      };
    };
  };

  const attributes = payload.data?.attributes;
  if (!attributes) return null;

  const coverImage =
    attributes.coverImage?.original?.trim() ||
    attributes.coverImage?.large?.trim() ||
    null;
  const posterImage =
    attributes.posterImage?.original?.trim() ||
    attributes.posterImage?.large?.trim() ||
    null;

  return { coverImage, posterImage };
};

const loadKitsuCoverImage = async (
  anilistId: number,
): Promise<string | null> => {
  const kitsuAnimeId = await resolveKitsuAnimeId(anilistId);
  if (!kitsuAnimeId) return null;

  const attributes = await fetchKitsuAnimeAttributes(kitsuAnimeId);
  if (!attributes) return null;

  return attributes.coverImage ?? attributes.posterImage ?? null;
};

const loadKitsuFirstEpisodeThumbnail = async (
  anilistId: number,
): Promise<string | null> => {
  const kitsuAnimeId = await resolveKitsuAnimeId(anilistId);
  if (!kitsuAnimeId) return null;

  const episodes = await fetchKitsuEpisodes(kitsuAnimeId);
  const firstEpisode =
    episodes.find((episode) => episode.number === 1) ?? episodes[0];

  return firstEpisode?.thumbnailUrl ?? null;
};

export const getKitsuCoverImageForAnilist = unstable_cache(
  loadKitsuCoverImage,
  ["kitsu-cover-image-v1"],
  { revalidate: 60 * 60 * 24 },
);

export const getKitsuFirstEpisodeThumbnailForAnilist = unstable_cache(
  loadKitsuFirstEpisodeThumbnail,
  ["kitsu-first-episode-thumbnail-v1"],
  { revalidate: 60 * 60 * 24 },
);

export const getKitsuEpisodeThumbnails = unstable_cache(
  loadKitsuEpisodeThumbnails,
  ["kitsu-episode-thumbnails-v1"],
  { revalidate: 60 * 60 * 24 },
);

export const resolveAnilistIdForTmdbSeason = async (
  tmdbShowId: number,
  seasonNumber: number,
  options?: {
    sourceAnilistId?: number | null;
    tmdbSeasonCount?: number | null;
  },
): Promise<number | null> => {
  const mappings = await getAniBridgeMappings();
  const coords = resolveAniBridgePlaybackCoords(
    mappings,
    tmdbShowId,
    seasonNumber,
    1,
  );
  if (coords?.anilistId) return coords.anilistId;

  const sourceAnilistId = options?.sourceAnilistId;
  const tmdbSeasonCount = options?.tmdbSeasonCount;
  if (
    !sourceAnilistId ||
    !Number.isInteger(sourceAnilistId) ||
    sourceAnilistId <= 0 ||
    !tmdbSeasonCount ||
    !Number.isInteger(tmdbSeasonCount) ||
    tmdbSeasonCount <= 0
  ) {
    return null;
  }

  const chain = await resolveAnilistSeasonChainForTmdbShow(
    sourceAnilistId,
    tmdbSeasonCount,
  );
  return pickAnilistIdFromSeasonChain(chain, seasonNumber);
};

export const resolveKitsuThumbnailsForTmdbSeason = async (input: {
  tmdbShowId: number;
  seasonNumber: number;
  anilistId?: number | null;
  sourceAnilistId?: number | null;
  tmdbSeasonCount?: number | null;
}): Promise<KitsuEpisodeThumbnailMap> => {
  const anilistId =
    input.anilistId ??
    (await resolveAnilistIdForTmdbSeason(input.tmdbShowId, input.seasonNumber, {
      sourceAnilistId: input.sourceAnilistId,
      tmdbSeasonCount: input.tmdbSeasonCount,
    }));
  if (!anilistId) return {};
  return getKitsuEpisodeThumbnails(anilistId);
};
