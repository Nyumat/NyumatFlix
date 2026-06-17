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
  enrichAniListMediaItemsLightweight,
} from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";
import {
  buildAnimeHubLayout,
  type AnimeHubLayout,
  type AnimeHubPools,
} from "@/lib/server/anime-hub-layout";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export const ANIME_HOME_REVALIDATE_SECONDS = 3600;
const ANIME_ROW_PAGE_SIZE = 24;
const SEASON_ROW_TARGET = 24;
const ANIME_HUB_FETCH_TIMEOUT_MS = 8000;

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

const enrichHubRow = (items: AniListMedia[]) =>
  enrichAniListMediaItemsLightweight(items, items.length);

const enrichTrendingHubRow = (items: AniListMedia[]) =>
  enrichAniListHubRow(items, {
    fullEnrichCount: 1,
    lightweightCount: items.length,
    heroEnrichment: "fast",
  });

type AnimeHubRows = {
  trendingRaw: AniListMedia[];
  popularRaw: AniListMedia[];
  seasonPopularRaw: AniListMedia[];
  airingRaw: AniListMedia[];
  topRatedRaw: AniListMedia[];
  moviesRaw: AniListMedia[];
  genreRaws: AniListMedia[][];
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

const hubPageField = (alias: string, args: string) => `
  ${alias}: Page(page: 1, perPage: $perPage) {
    media(type: ANIME, ${args}, isAdult: false) {
      ${ANILIST_HUB_MEDIA_FIELDS}
    }
  }
`;

const fetchAnimeHubRowsBatched = async (): Promise<AnimeHubRows> => {
  const season = getAnimeSeasonContext();
  const genreVariables = ANIME_HUB_GENRES.map(
    (genre, index) => `$genre${index}: [String]`,
  ).join(",\n    ");
  const genreFields = ANIME_HUB_GENRES.map((_, index) =>
    hubPageField(
      `genre${index}`,
      `sort: POPULARITY_DESC, genre_in: $genre${index}`,
    ),
  ).join("\n");

  const query = `
    query AnimeHubRows(
      $perPage: Int!,
      $season: MediaSeason!,
      $seasonYear: Int!,
      ${genreVariables}
    ) {
      ${hubPageField("trending", "sort: TRENDING_DESC")}
      ${hubPageField("popular", "sort: POPULARITY_DESC")}
      ${hubPageField(
        "seasonPopular",
        "sort: POPULARITY_DESC, season: $season, seasonYear: $seasonYear",
      )}
      ${hubPageField("airing", "sort: POPULARITY_DESC, status: RELEASING")}
      ${hubPageField("topRated", "sort: SCORE_DESC")}
      ${hubPageField("movies", "sort: POPULARITY_DESC, format: MOVIE")}
      ${genreFields}
    }
  `;

  const variables = {
    perPage: ANIME_ROW_PAGE_SIZE,
    season: season.featuredSeason,
    seasonYear: season.featuredYear,
    ...Object.fromEntries(
      ANIME_HUB_GENRES.map((genre, index) => [`genre${index}`, [genre]]),
    ),
  };

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

  const getRow = (name: string) =>
    (payload.data?.[name]?.media ?? [])
      .filter((item) => !isAniListIdBlocked(item.id))
      .slice(0, SEASON_ROW_TARGET);

  return {
    trendingRaw: getRow("trending"),
    popularRaw: getRow("popular"),
    seasonPopularRaw: getRow("seasonPopular"),
    airingRaw: getRow("airing"),
    topRatedRaw: getRow("topRated"),
    moviesRaw: getRow("movies"),
    genreRaws: ANIME_HUB_GENRES.map((_, index) => getRow(`genre${index}`)),
  };
};

const fetchAnimeHubLayoutUncached = async (): Promise<AnimeHubLayout> => {
  const season = getAnimeSeasonContext();
  const rows = await fetchAnimeHubRowsBatched();

  const {
    trendingRaw,
    popularRaw,
    seasonPopularRaw,
    airingRaw,
    topRatedRaw,
    moviesRaw,
    genreRaws,
  } = rows;

  const [
    trending,
    popular,
    seasonPopular,
    airing,
    topRated,
    movies,
    ...genreItems
  ] = await Promise.all([
    enrichTrendingHubRow(trendingRaw),
    enrichHubRow(popularRaw),
    enrichHubRow(seasonPopularRaw),
    enrichHubRow(airingRaw),
    enrichHubRow(topRatedRaw),
    enrichHubRow(moviesRaw),
    ...genreRaws.map(enrichHubRow),
  ]);

  const genreRows = ANIME_HUB_GENRES.map((genre, index) => ({
    genre,
    items: genreItems[index] ?? [],
  }));

  const pools: AnimeHubPools = {
    trending,
    popular,
    seasonPopular,
    airing,
    topRated,
    movies,
    genreRows,
  };

  const seasonLink = (extra: Partial<AniListSearchParams> = {}) =>
    buildAniListUrl({
      medium: "ANIME",
      sort: "POPULARITY_DESC",
      ...extra,
    });

  return buildAnimeHubLayout(pools, season, {
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
    genre: (genre) => seasonLink({ genres: [genre] }),
  });
};

const getCachedAnimeHubLayout = unstable_cache(
  fetchAnimeHubLayoutUncached,
  ["anime-home-season-hub-v13"],
  { revalidate: ANIME_HOME_REVALIDATE_SECONDS },
);

export const fetchAnimeHubLayout = cache(getCachedAnimeHubLayout);

/** @deprecated Use fetchAnimeHubLayout */
export const fetchAnimeFullHubData = fetchAnimeHubLayout;
