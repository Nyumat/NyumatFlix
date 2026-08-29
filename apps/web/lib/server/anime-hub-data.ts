import "server-only";

import { isAniListIdBlocked } from "@/lib/anime-blocklist";
import { getAnimeSeasonContext } from "@/lib/anime-season";
import {
  ANILIST_ENDPOINT,
  buildAniListUrl,
  type AniListMedia,
  type AniListSearchParams,
} from "@/lib/anilist";
import {
  enrichAniListHubRow,
  enrichAniListSearchCatalogItems,
  enrichAniListMediaItemsLightweight,
} from "@/lib/anilist-tmdb";
import { withDevelopmentDataCache } from "@/lib/server/development-data-cache";
import { cache } from "react";

export const ANIME_HOME_REVALIDATE_SECONDS = 3600;
const ANIME_ROW_PAGE_SIZE = 24;
const SEASON_ROW_TARGET = 24;
const ANIME_HUB_FETCH_TIMEOUT_MS = 12_000;
const ANIME_HUB_HENTAI_PAGE_SIZE = 18;
const ANIME_HUB_GENRE_BATCH_SIZE = 4;
const ANIME_HUB_CACHE_VERSION = "v18";

/** Genre rows on the anime hub — AniList genre names, display order. */
export const ANIME_HUB_GENRES = [
  "Action",
  "Supernatural",
  "Comedy",
  "Adventure",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Horror",
  "Slice of Life",
  "Drama",
  "Mystery",
  "Sports",
] as const;

export type AnimeHubLinks = {
  trending: string;
  popular: string;
  seasonPopular: string;
  airing: string;
  topRated: string;
  movies: string;
  hentai: string;
  genre: (name: string) => string;
};

type AnimeHubBatchResponse = {
  data?: Record<string, { media?: AniListMedia[] } | undefined>;
  errors?: Array<{ message: string }>;
};

const ANILIST_HUB_MEDIA_FIELDS = `
  id
  title {
    romaji
    english
    native
  }
  type
  format
  description(asHtml: false)
  seasonYear
  coverImage {
    large
    extraLarge
  }
  bannerImage
  genres
  averageScore
  popularity
  startDate {
    year
    month
    day
  }
`;

const hubPageField = (alias: string, args: string, isAdult = false) => `
  ${alias}: Page(page: 1, perPage: $perPage) {
    media(type: ANIME, ${args}, isAdult: ${isAdult}) {
      ${ANILIST_HUB_MEDIA_FIELDS}
    }
  }
`;

const filterHubRow = (items: AniListMedia[]) =>
  items
    .filter((item) => !isAniListIdBlocked(item.id))
    .slice(0, SEASON_ROW_TARGET);

const buildHubRowQuery = (mediaArgs: string, isAdult: boolean) => {
  const variableDefs = ["$perPage: Int!"];
  if (/\$season\b/.test(mediaArgs)) {
    variableDefs.push("$season: MediaSeason!", "$seasonYear: Int!");
  }
  if (/\$genre\b/.test(mediaArgs)) {
    variableDefs.push("$genre: [String]");
  }

  return `
    query AnimeHubRow(${variableDefs.join(", ")}) {
      row: Page(page: 1, perPage: $perPage) {
        media(type: ANIME, ${mediaArgs}, isAdult: ${isAdult}) {
          ${ANILIST_HUB_MEDIA_FIELDS}
        }
      }
    }
  `;
};

const fetchAniListHubBatch = async (
  query: string,
  variables: Record<string, unknown>,
): Promise<AnimeHubBatchResponse> => {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(ANIME_HUB_FETCH_TIMEOUT_MS),
    next: { revalidate: ANIME_HOME_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(
      `AniList hub request failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as AnimeHubBatchResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return payload;
};

const fetchHubRowRaw = async (
  mediaArgs: string,
  {
    isAdult = false,
    perPage = ANIME_ROW_PAGE_SIZE,
    variables = {},
  }: {
    isAdult?: boolean;
    perPage?: number;
    variables?: Record<string, unknown>;
  } = {},
): Promise<AniListMedia[]> => {
  const query = buildHubRowQuery(mediaArgs, isAdult);

  const payload = await fetchAniListHubBatch(query, {
    perPage,
    ...variables,
  });

  return filterHubRow(payload.data?.row?.media ?? []);
};

const safeFetchHubRowRaw = async (
  mediaArgs: string,
  options?: {
    isAdult?: boolean;
    perPage?: number;
    variables?: Record<string, unknown>;
  },
): Promise<AniListMedia[]> => {
  try {
    return await fetchHubRowRaw(mediaArgs, options);
  } catch {
    return [];
  }
};

const seasonVariables = () => {
  const season = getAnimeSeasonContext();
  return {
    season: season.featuredSeason,
    seasonYear: season.featuredYear,
  };
};

const hasHubMedia = (items: AniListMedia[]) => items.length > 0;

const hasHubGenreBatch = (rows: AniListMedia[][]) =>
  rows.some((row) => row.length > 0);

const withHubRowCache = (key: string, load: () => Promise<AniListMedia[]>) =>
  cache(() => {
    const season = getAnimeSeasonContext();
    return withDevelopmentDataCache({
      key: `${key}:${season.featuredSeason}:${season.featuredYear}`,
      load,
      cacheResult: hasHubMedia,
    });
  });

const withHubGenreBatchCache = (
  key: string,
  load: () => Promise<AniListMedia[][]>,
) =>
  cache(() => {
    const season = getAnimeSeasonContext();
    return withDevelopmentDataCache({
      key: `${key}:${season.featuredSeason}:${season.featuredYear}`,
      load,
      cacheResult: hasHubGenreBatch,
    });
  });

const fetchGenreBatchRaw = async (startIndex: number, count: number) => {
  const genres = ANIME_HUB_GENRES.slice(startIndex, startIndex + count);
  const genreVariables = genres
    .map((_, index) => `$genre${index}: [String]`)
    .join(",\n      ");
  const genreFields = genres
    .map((_, index) =>
      hubPageField(
        `genre${index}`,
        `sort: POPULARITY_DESC, genre_in: $genre${index}`,
      ),
    )
    .join("\n");

  const query = `
    query AnimeHubGenreBatch(
      $perPage: Int!,
      ${genreVariables}
    ) {
      ${genreFields}
    }
  `;

  const variables = {
    perPage: ANIME_ROW_PAGE_SIZE,
    ...Object.fromEntries(
      genres.map((genre, index) => [`genre${index}`, [genre]]),
    ),
  };

  const payload = await fetchAniListHubBatch(query, variables);

  return genres.map((_, index) =>
    filterHubRow(payload.data?.[`genre${index}`]?.media ?? []),
  );
};

const safeFetchGenreBatchRaw = async (
  startIndex: number,
  count: number,
): Promise<AniListMedia[][]> => {
  try {
    return await fetchGenreBatchRaw(startIndex, count);
  } catch {
    return Array.from({ length: count }, () => []);
  }
};

export const fetchAnimeHubTrendingRaw = withHubRowCache(
  `anime-hub-row-trending-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchHubRowRaw("sort: TRENDING_DESC"),
);

export const fetchAnimeHubPopularRaw = withHubRowCache(
  `anime-hub-row-popular-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchHubRowRaw("sort: POPULARITY_DESC"),
);

export const fetchAnimeHubSeasonPopularRaw = withHubRowCache(
  `anime-hub-row-season-${ANIME_HUB_CACHE_VERSION}`,
  () =>
    safeFetchHubRowRaw(
      "sort: POPULARITY_DESC, season: $season, seasonYear: $seasonYear",
      { variables: seasonVariables() },
    ),
);

export const fetchAnimeHubAiringRaw = withHubRowCache(
  `anime-hub-row-airing-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchHubRowRaw("sort: POPULARITY_DESC, status: RELEASING"),
);

export const fetchAnimeHubTopRatedRaw = withHubRowCache(
  `anime-hub-row-top-rated-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchHubRowRaw("sort: SCORE_DESC"),
);

export const fetchAnimeHubMoviesRaw = withHubRowCache(
  `anime-hub-row-movies-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchHubRowRaw("sort: POPULARITY_DESC, format: MOVIE"),
);

export const fetchAnimeHubHentaiRaw = withHubRowCache(
  `anime-hub-row-hentai-${ANIME_HUB_CACHE_VERSION}`,
  () =>
    safeFetchHubRowRaw('sort: POPULARITY_DESC, genre_in: ["Hentai"]', {
      isAdult: true,
      perPage: ANIME_HUB_HENTAI_PAGE_SIZE,
    }),
);

export const fetchAnimeHubGenreBatch0Raw = withHubGenreBatchCache(
  `anime-hub-genres-0-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchGenreBatchRaw(0, ANIME_HUB_GENRE_BATCH_SIZE),
);

export const fetchAnimeHubGenreBatch4Raw = withHubGenreBatchCache(
  `anime-hub-genres-4-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchGenreBatchRaw(4, ANIME_HUB_GENRE_BATCH_SIZE),
);

export const fetchAnimeHubGenreBatch8Raw = withHubGenreBatchCache(
  `anime-hub-genres-8-${ANIME_HUB_CACHE_VERSION}`,
  () => safeFetchGenreBatchRaw(8, ANIME_HUB_GENRE_BATCH_SIZE),
);

export const enrichAnimeHubTrendingRow = async (items: AniListMedia[]) =>
  enrichAniListHubRow(items, {
    fullEnrichCount: 1,
    lightweightCount: items.length,
    heroEnrichment: "fast",
  });

export const enrichAnimeHubStandardRow = async (items: AniListMedia[]) =>
  enrichAniListMediaItemsLightweight(items, items.length);

/** Adult hub rows: AniList posters only — skip weak TMDB remaps. */
export const enrichAnimeHubAdultRow = async (items: AniListMedia[]) =>
  enrichAniListSearchCatalogItems(items, items.length);

export const getAnimeHubLinks = cache((): AnimeHubLinks => {
  const season = getAnimeSeasonContext();
  const seasonLink = (extra: Partial<AniListSearchParams> = {}) =>
    buildAniListUrl({
      medium: "ANIME",
      sort: "POPULARITY_DESC",
      ...extra,
    });

  return {
    trending: seasonLink({ sort: "TRENDING_DESC" }),
    popular: seasonLink({ sort: "POPULARITY_DESC" }),
    seasonPopular: seasonLink({
      sort: "POPULARITY_DESC",
      season: season.featuredSeason,
      year: season.featuredYear,
    }),
    airing: seasonLink({ sort: "POPULARITY_DESC", status: "RELEASING" }),
    topRated: seasonLink({ sort: "SCORE_DESC" }),
    movies: seasonLink({ sort: "POPULARITY_DESC", format: "MOVIE" }),
    hentai: seasonLink({ sort: "POPULARITY_DESC", genres: ["Hentai"] }),
    genre: (genre) => seasonLink({ genres: [genre] }),
  };
});

export const getAnimeHubSeasonLabel = cache(
  () => getAnimeSeasonContext().featuredLabel,
);
