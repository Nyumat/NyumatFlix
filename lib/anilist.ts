import type { MediaItem } from "@/utils/typings";
import { unstable_cache } from "next/cache";

export const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export const ANILIST_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
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
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  siteUrl?: string | null;
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

type AniListResponse = {
  data?: {
    Page?: AniListPage;
  };
  errors?: Array<{ message: string }>;
};

const ANILIST_PAGE_QUERY = `
  query AniListCatalog(
    $page: Int,
    $perPage: Int,
    $type: MediaType,
    $sort: [MediaSort],
    $countryOfOrigin: CountryCode,
    $genres: [String],
    $formats: [MediaFormat],
    $status: MediaStatus,
    $season: MediaSeason,
    $seasonYear: Int,
    $search: String
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        lastPage
        hasNextPage
        total
        perPage
      }
      media(
        type: $type,
        sort: $sort,
        countryOfOrigin: $countryOfOrigin,
        genre_in: $genres,
        format_in: $formats,
        status: $status,
        season: $season,
        seasonYear: $seasonYear,
        search: $search,
        isAdult: false
      ) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        type
        format
        status
        description(asHtml: false)
        season
        seasonYear
        episodes
        chapters
        volumes
        countryOfOrigin
        coverImage {
          large
          extraLarge
          color
        }
        bannerImage
        genres
        averageScore
        popularity
        trending
        startDate {
          year
          month
          day
        }
        siteUrl
      }
    }
  }
`;

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

const compact = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) =>
        value !== undefined &&
        value !== "" &&
        (!Array.isArray(value) || value.length > 0),
    ),
  );

const ANILIST_REVALIDATE_SECONDS = 3600;

const fetchAniListPageUncached = async ({
  page = 1,
  perPage = 24,
  params,
}: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
}): Promise<AniListPage> => {
  const variables = compact({
    page,
    perPage,
    type: "ANIME",
    sort: [params.sort],
    genres: params.genres,
    formats: params.format ? [params.format] : undefined,
    status: params.status,
    season: params.season,
    seasonYear: params.year,
    search: params.query,
  });

  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: ANILIST_PAGE_QUERY, variables }),
    next: { revalidate: ANILIST_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`AniList request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as AniListResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return (
    payload.data?.Page ?? {
      pageInfo: {
        currentPage: page,
        lastPage: page,
        hasNextPage: false,
        total: 0,
        perPage,
      },
      media: [],
    }
  );
};

const getCachedAniListPage = unstable_cache(
  fetchAniListPageUncached,
  ["anilist-page"],
  { revalidate: ANILIST_REVALIDATE_SECONDS },
);

export const fetchAniListPage = getCachedAniListPage;

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

export const buildAniListUrl = (
  params: Partial<AniListSearchParams> & { mode?: "results"; page?: number },
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
  return query ? `/anime/browse?${query}` : "/anime/browse";
};

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
    original_name: item.title.romaji ?? title,
    media_type: "tv",
    poster_path: poster,
    backdrop_path: item.bannerImage ?? poster,
    first_air_date: date,
    release_date: date,
    overview: cleanAniListDescription(item.description),
    popularity: item.popularity ?? item.trending ?? 0,
    vote_average: item.averageScore ? item.averageScore / 10 : 0,
    vote_count: item.popularity ?? 0,
    original_language: item.countryOfOrigin === "KR" ? "ko" : "ja",
    origin_country: item.countryOfOrigin ? [item.countryOfOrigin] : [],
    genre_ids: [],
    genres: item.genres?.map((genre, index) => ({
      id: index + 1,
      name: genre,
    })),
    content_rating: item.format?.replace(/_/g, " ") ?? null,
    href,
  } as MediaItem;
};

export const mapAniListPageToMediaItems = (page: AniListPage): MediaItem[] =>
  page.media.map(mapAniListMediaToMediaItem);
