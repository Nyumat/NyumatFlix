import type {
  AniListMedia,
  AniListPage,
  AniListSearchParams,
} from "@/lib/anilist";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { tmdb } from "@/tmdb/api";
import type {
  Movie,
  MovieWithMediaType,
  TvShow,
  TvShowWithMediaType,
} from "@/tmdb/models";

const ANIME_GENRE_ID = "16";

const ANILIST_TO_TMDB_GENRES: Record<string, string> = {
  Action: "10759",
  Adventure: "10759",
  Comedy: "35",
  Drama: "18",
  Fantasy: "10765",
  Horror: "9648",
  Mecha: "10765",
  Music: "16",
  Mystery: "9648",
  Psychological: "9648",
  Romance: "10749",
  "Sci-Fi": "10765",
  "Slice of Life": "18",
  Sports: "16",
  Supernatural: "10765",
  Thriller: "9648",
};

const toSortBy = (sort: AniListSearchParams["sort"]) => {
  switch (sort) {
    case "SCORE_DESC":
      return "vote_average.desc";
    case "START_DATE_DESC":
      return "first_air_date.desc";
    case "FAVOURITES_DESC":
    case "POPULARITY_DESC":
    case "TRENDING_DESC":
    default:
      return "popularity.desc";
  }
};

const toMovieSortBy = (sort: AniListSearchParams["sort"]) => {
  switch (sort) {
    case "SCORE_DESC":
      return "vote_average.desc";
    case "START_DATE_DESC":
      return "primary_release_date.desc";
    case "FAVOURITES_DESC":
    case "POPULARITY_DESC":
    case "TRENDING_DESC":
    default:
      return "popularity.desc";
  }
};

const toGenreFilter = (genres: string[]) => {
  const tmdbGenres = genres
    .map((genre) => ANILIST_TO_TMDB_GENRES[genre])
    .filter((genre): genre is string => Boolean(genre));
  return [ANIME_GENRE_ID, ...tmdbGenres].join(",");
};

const getTitle = (
  item: Movie | TvShow | MovieWithMediaType | TvShowWithMediaType,
) => ("title" in item ? item.title : item.name);

const getDate = (
  item: Movie | TvShow | MovieWithMediaType | TvShowWithMediaType,
) => ("release_date" in item ? item.release_date : item.first_air_date);

const getOriginalTitle = (
  item: Movie | TvShow | MovieWithMediaType | TvShowWithMediaType,
) => ("original_title" in item ? item.original_title : item.original_name);

const toAniListFallbackMedia = (
  item: Movie | TvShow | MovieWithMediaType | TvShowWithMediaType,
  type: "movie" | "tv",
): AniListMedia => {
  const title = getTitle(item) || getOriginalTitle(item) || "Untitled";
  const date = getDate(item) ?? "";
  const year = Number.parseInt(date.slice(0, 4), 10);

  return {
    id: type === "movie" ? -item.id : -1000000 - item.id,
    title: {
      english: title,
      romaji: title,
      native: getOriginalTitle(item) || title,
    },
    type: "ANIME",
    format: type === "movie" ? "MOVIE" : "TV",
    status: undefined,
    description: item.overview,
    seasonYear: Number.isInteger(year) ? year : undefined,
    coverImage: {
      large: item.poster_path ?? undefined,
      extraLarge: item.poster_path ?? undefined,
    },
    bannerImage: item.backdrop_path ?? item.poster_path ?? undefined,
    genres: [],
    averageScore: item.vote_average ? Math.round(item.vote_average * 10) : null,
    popularity: item.popularity,
    startDate: Number.isInteger(year) ? { year } : undefined,
    siteUrl: undefined,
    tmdbFallback: {
      id: item.id,
      type,
    },
  };
};

const toPageInfo = ({
  page,
  perPage,
  totalPages,
  totalResults,
}: {
  page: number;
  perPage: number;
  totalPages: number;
  totalResults: number;
}): AniListPage["pageInfo"] => ({
  currentPage: page,
  lastPage: totalPages,
  hasNextPage: page < totalPages,
  total: totalResults,
  perPage,
});

const searchTmdbAnime = async ({
  page,
  perPage,
  params,
}: {
  page: number;
  perPage: number;
  params: AniListSearchParams;
}): Promise<AniListPage> => {
  const response = await tmdb.search.multi({
    query: params.query ?? "",
    page: String(page),
    adult: false,
  });
  const media = (response.results ?? [])
    .filter(
      (item): item is MovieWithMediaType | TvShowWithMediaType =>
        (item.media_type === "movie" || item.media_type === "tv") &&
        item.genre_ids?.includes(16) &&
        (item.original_language === "ja" || item.original_language === "ko"),
    )
    .slice(0, perPage)
    .map((item) => toAniListFallbackMedia(item, item.media_type));

  return {
    pageInfo: toPageInfo({
      page,
      perPage,
      totalPages: response.total_pages ?? page,
      totalResults: response.total_results ?? media.length,
    }),
    media,
  };
};

export const fetchTmdbAnimeFallbackPage = async ({
  page = 1,
  perPage = 24,
  params,
  reason,
}: {
  page?: number;
  perPage?: number;
  params: AniListSearchParams;
  reason?: string;
}): Promise<AniListPage> => {
  console.warn(
    `AniList unavailable${reason ? ` (${reason})` : ""}; using TMDB anime fallback.`,
  );

  if (params.query) {
    return searchTmdbAnime({ page, perPage, params });
  }

  if (params.format === "MOVIE") {
    const response = await tmdb.discover.movie({
      page: String(page),
      watch_region: TMDB_WATCH_REGION,
      sort_by: toMovieSortBy(params.sort),
      with_genres: ANIME_GENRE_ID,
      with_original_language: "ja|ko",
      ...(params.year ? { primary_release_year: String(params.year) } : {}),
    });

    return {
      pageInfo: toPageInfo({
        page,
        perPage,
        totalPages: response.total_pages ?? page,
        totalResults: response.total_results ?? response.results?.length ?? 0,
      }),
      media: (response.results ?? [])
        .slice(0, perPage)
        .map((item) => toAniListFallbackMedia(item, "movie")),
    };
  }

  const response = await tmdb.discover.tv({
    page: String(page),
    watch_region: TMDB_WATCH_REGION,
    sort_by: toSortBy(params.sort),
    with_genres: toGenreFilter(params.genres),
    with_original_language: "ja|ko",
    ...(params.year ? { first_air_date_year: String(params.year) } : {}),
  });

  return {
    pageInfo: toPageInfo({
      page,
      perPage,
      totalPages: response.total_pages ?? page,
      totalResults: response.total_results ?? response.results?.length ?? 0,
    }),
    media: (response.results ?? [])
      .slice(0, perPage)
      .map((item) => toAniListFallbackMedia(item, "tv")),
  };
};
