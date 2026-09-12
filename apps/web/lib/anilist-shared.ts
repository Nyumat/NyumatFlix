import type { MediaItem } from "@/lib/domain/typings";

/**
 * Client-safe AniList helpers: constants, types, and pure functions only.
 *
 * This module must never import `server-only`, `next/cache`, or any
 * server-keyed client (TMDB, Kitsu/Jikan fetchers). It is imported by client
 * components (`"use client"`), `config/*`, and server modules alike.
 * Server-side fetching lives in `@/lib/anilist`, which re-exports this file.
 */

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export const ANILIST_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Hentai",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const;

export const ANILIST_SORT_OPTIONS = [
  { label: "Trending", value: "TRENDING_DESC" },
  { label: "Popular", value: "POPULARITY_DESC" },
  { label: "Highest Rated", value: "SCORE_DESC" },
  { label: "Most Favorited", value: "FAVOURITES_DESC" },
  { label: "Newest", value: "START_DATE_DESC" },
] as const;

export const ANILIST_FORMAT_OPTIONS = [
  { label: "Any format", value: "" },
  { label: "TV", value: "TV" },
  { label: "Movie", value: "MOVIE" },
  { label: "ONA", value: "ONA" },
  { label: "Special", value: "SPECIAL" },
] as const;

export const ANILIST_STATUS_OPTIONS = [
  { label: "Any status", value: "" },
  { label: "Releasing", value: "RELEASING" },
  { label: "Finished", value: "FINISHED" },
  { label: "Upcoming", value: "NOT_YET_RELEASED" },
  { label: "Cancelled", value: "CANCELLED" },
] as const;

export const ANILIST_SEASON_OPTIONS = [
  { label: "Any season", value: "" },
  { label: "Winter", value: "WINTER" },
  { label: "Spring", value: "SPRING" },
  { label: "Summer", value: "SUMMER" },
  { label: "Fall", value: "FALL" },
] as const;

export type AniListMedium = "ANIME";
export type AniListSort = (typeof ANILIST_SORT_OPTIONS)[number]["value"];

export type AniListMedia = {
  id: number;
  idMal?: number | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  type: "ANIME" | "MANGA";
  format?: string | null;
  status?: string | null;
  description?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  countryOfOrigin?: string | null;
  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
    color?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[];
  averageScore?: number | null;
  popularity?: number | null;
  trending?: number | null;
  isAdult?: boolean | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  siteUrl?: string | null;
  tmdbFallback?: {
    id: number;
    type: "movie" | "tv";
  };
};

export type AniListPageInfo = {
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
  total: number;
  perPage: number;
};

export type AniListPage = {
  pageInfo: AniListPageInfo;
  media: AniListMedia[];
};

export type AniListSearchParams = {
  medium: AniListMedium;
  sort: AniListSort;
  query?: string;
  genres: string[];
  format?: string;
  status?: string;
  season?: string;
  year?: number;
};

const ANILIST_ADULT_GENRES = new Set(["Hentai"]);

export const requiresAdultAniListContent = (genres: string[]) =>
  genres.some((genre) => ANILIST_ADULT_GENRES.has(genre));

const isAniListSort = (value: string | undefined): value is AniListSort =>
  ANILIST_SORT_OPTIONS.some((option) => option.value === value);

const parseCsv = (value: string | undefined) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const parseYear = (value: string | undefined) => {
  if (!value) return undefined;
  const year = Number.parseInt(value, 10);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return undefined;
  return year;
};

export const parseAniListSearchParams = (
  sp: Record<string, string>,
): AniListSearchParams => ({
  medium: "ANIME",
  sort: isAniListSort(sp.sort) ? sp.sort : "TRENDING_DESC",
  query: sp.query?.trim() || undefined,
  genres: parseCsv(sp.genres),
  format: sp.format?.trim() || undefined,
  status: sp.status?.trim() || undefined,
  season: sp.season?.trim() || undefined,
  year: parseYear(sp.year),
});

export const ANIME_BROWSE_PATH = "/anime/browse";

export const hasActiveAniListFilters = (sp: Record<string, string>) =>
  Boolean(
    sp.query ||
      sp.genres ||
      sp.format ||
      sp.status ||
      sp.season ||
      sp.year ||
      (sp.sort && sp.sort !== "TRENDING_DESC"),
  );

/** Grid layout when any AniList filter param is present (no URL mode flag). */
export const isAniListResultsLayout = hasActiveAniListFilters;

export const buildAniListUrl = (
  params: Partial<AniListSearchParams> & { page?: number },
) => {
  const search = new URLSearchParams();
  if (params.sort && params.sort !== "TRENDING_DESC") {
    search.set("sort", params.sort);
  }
  if (params.query) search.set("query", params.query);
  if (params.genres?.length) search.set("genres", params.genres.join(","));
  if (params.format) search.set("format", params.format);
  if (params.status) search.set("status", params.status);
  if (params.season) search.set("season", params.season);
  if (params.year) search.set("year", String(params.year));
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/anime?${query}` : ANIME_BROWSE_PATH;
};

export const getAniListTitle = (item: AniListMedia) =>
  item.title.english || item.title.romaji || item.title.native || "Untitled";

export const getAniListYear = (item: AniListMedia) =>
  item.seasonYear ?? item.startDate?.year ?? undefined;

export const getAniListPoster = (item: AniListMedia) =>
  item.coverImage?.extraLarge || item.coverImage?.large || undefined;

export const cleanAniListDescription = (value: string | null | undefined) =>
  value
    ?.replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const toAniListDate = (item: AniListMedia) => {
  const year = item.startDate?.year ?? item.seasonYear;
  if (!year) return "";
  const month = String(item.startDate?.month ?? 1).padStart(2, "0");
  const day = String(item.startDate?.day ?? 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const mapAniListMediaToMediaItem = (item: AniListMedia): MediaItem => {
  const title = getAniListTitle(item);
  const poster = getAniListPoster(item) ?? null;
  const date = toAniListDate(item);
  const href =
    item.siteUrl ?? `https://anilist.co/${item.type.toLowerCase()}/${item.id}`;

  return {
    id: item.id,
    name: title,
    original_language: "ja",
    original_name: item.title.romaji ?? title,
    title,
    original_title: item.title.romaji ?? title,
    overview: cleanAniListDescription(item.description),
    poster_path: poster,
    backdrop_path: item.bannerImage ?? poster,
    release_date: date,
    first_air_date: date,
    vote_average: item.averageScore ? item.averageScore / 10 : 0,
    vote_count: item.popularity,
    popularity: item.popularity,
    genre_ids: item.genres?.length ? [16] : [], // Map AniList genres to TMDB later if needed
    media_type: item.format === "MOVIE" ? "movie" : "tv",
    href,
    tmdbFallback: item.tmdbFallback,
  } as MediaItem & { tmdbFallback?: { id: number; type: "movie" | "tv" } };
};

export const mapAniListPageToMediaItems = (page: AniListPage): MediaItem[] =>
  page.media.map(mapAniListMediaToMediaItem);
