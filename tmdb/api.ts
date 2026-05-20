import type {
  Cast,
  CombinedCreditsResponse,
  Crew,
  Genre,
  Image,
  Video,
} from "@/tmdb/models";
import {
  Credits,
  DetailedCollection,
  Episode,
  GetAvailableRegionsResponse,
  GetImagesResponse,
  GetVideosResponse,
  Movie,
  MovieDetails,
  MovieWithMediaType,
  Person,
  PersonDetails,
  PersonWithMediaType,
  Review,
  SeasonDetails,
  TvShow,
  TvShowDetails,
  TvShowWithMediaType,
  WatchProvider,
  WatchProviders,
} from "@/tmdb/models";

export type MovieListType =
  | "popular"
  | "top_rated"
  | "now_playing"
  | "upcoming";

export type MovieListRequestParams = {
  list: MovieListType;
  page?: string;
  region?: string;
};

export type MovieDetailsRequestParams = {
  id: string | number;
  append?: string;
};

export type MovieCreditsRequestParams = {
  id: string | number;
};

export type MovieRecommendationsRequestParams = {
  id: string | number;
  page?: string;
};

export type MovieSimilarRequestParams = {
  id: string | number;
  page?: string;
};

export type MovieImagesRequestParams = {
  id: string | number;
  langs?: string;
};

export type MovieVideosRequestParams = {
  id: string | number;
};

export type MovieReviewsRequestParams = {
  id: string | number;
  page?: string;
};

export type MovieProvidersRequestParams = {
  id: string | number;
  region?: string;
};

export type TvListType =
  | "popular"
  | "top_rated"
  | "on_the_air"
  | "airing_today";

export type TvListRequestParams = {
  list: TvListType;
  page?: string;
  region?: string;
  timezone?: string;
};

export type TvDetailsRequestParams = {
  id: string | number;
  append?: string;
};

export type TvCreditsRequestParams = {
  id: string | number;
};

export type TvRecommendationsRequestParams = {
  id: string | number;
  page?: string;
};

export type TvSimilarRequestParams = {
  id: string | number;
  page?: string;
};

export type TvImagesRequestParams = {
  id: string | number;
  langs?: string;
};

export type TvVideosRequestParams = {
  id: string | number;
};

export type TvReviewsRequestParams = {
  id: string | number;
  page?: string;
};

export type TvProvidersRequestParams = {
  id: string | number;
  region?: string;
  season?: string | number;
};

export type TrendingRequestParams = {
  time: "day" | "week";
  page?: string;
};

export type PersonListType = "popular";

export type PersonDetailsRequestParams = {
  id: string | number;
  append?: string;
};

export type PersonListRequestParams = {
  list: PersonListType;
  page?: string;
};

export type WithCombinedCredits = {
  combined_credits: CombinedCreditsResponse;
};

export type CollectionRequestParams = {
  id: string | number;
};

export type SearchRequestParams = {
  query: string;
  page?: string;
  adult?: boolean;
};

export type SortByType =
  | "popularity.asc"
  | "popularity.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc";

export type SortByTypeMovie =
  | SortByType
  | "primary_release_date.asc"
  | "primary_release_date.desc"
  | "release_date.asc"
  | "release_date.desc"
  | "revenue.asc"
  | "revenue.desc"
  | "original_title.asc"
  | "original_title.desc";

export type SortByTypeTv =
  | SortByType
  | "first_air_date.asc"
  | "first_air_date.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc"
  | "original_name.asc"
  | "original_name.desc";

export type DiscoverRequestParams = {
  page?: string;
  sort_by?: SortByTypeMovie | SortByTypeTv;
  certification?: string;
  "certification.gte"?: string;
  "certification.lte"?: string;
  certification_country?: string;
  include_adult?: boolean;
  include_video?: boolean;
  "vote_average.gte"?: string;
  "vote_average.lte"?: string;
  "vote_count.gte"?: string;
  "vote_count.lte"?: string;
  "with_runtime.gte"?: string;
  "with_runtime.lte"?: string;
  with_cast?: string;
  with_crew?: string;
  with_companies?: string;
  with_genres?: string;
  with_keywords?: string;
  with_people?: string;
  with_networks?: string;
  with_original_language?: string;
  with_release_type?: string;
  with_watch_providers?: string;
  with_watch_monetization_types?: string;
  watch_region?: string;
  without_genres?: string;
  without_keywords?: string;
  year?: string;
};

export type DiscoverMovieRequestParams = DiscoverRequestParams & {
  primary_release_year?: string;
  "primary_release_date.gte"?: string;
  "primary_release_date.lte"?: string;
  "release_date.gte"?: string;
  "release_date.lte"?: string;
};

export type DiscoverTvRequestParams = DiscoverRequestParams & {
  first_air_date_year?: string;
  "first_air_date.gte"?: string;
  "first_air_date.lte"?: string;
};

export type GenreResponse = {
  genres: Genre[];
};

export type WatchProvidersRequestParams = {
  region?: string;
};

export type TvEpisodeDetailsRequestParams = {
  id: number | string;
  season: number;
  episode: number;
  append?: string;
};

export type TvSeasonsDetailsRequestParams = {
  id: number | string;
  season: number;
  append?: string;
  langs?: string;
};

export type TvSeasonsImagesRequestParams = {
  id: number | string;
  season: number;
  langs?: string;
};

export type ListResponse<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

export type WithImages = {
  images: {
    posters: Image[];
    backdrops: Image[];
    logos: Image[];
    profiles: Image[];
    stills: Image[];
  };
};

export type WithVideos = {
  videos: {
    results: Video[];
  };
};

export type WithCredits = {
  credits: {
    cast: Cast[];
    crew: Crew[];
  };
};

const baseUrl = "https://api.themoviedb.org/3";
const apiKey = process.env.TMDB_API_KEY ?? "";

const apiConfig = {
  baseUrl,
  defaultHeaders: {
    "Content-Type": "application/json",
  } as Record<string, string>,
  defaultParams: {
    ...(apiKey ? { api_key: apiKey } : {}),
  } as Record<string, string>,
};

type FetcherOptions = {
  endpoint: string;
  params?: Record<string, string | undefined>;
};

type Fetcher = <T>(options: FetcherOptions, init?: RequestInit) => Promise<T>;

const emptyListResponse = {
  page: 1,
  results: [],
  total_pages: 0,
  total_results: 0,
};

const isNetworkFetchError = (error: unknown): boolean => {
  if (!(error instanceof TypeError)) {
    return false;
  }

  return error.message === "fetch failed";
};

const sanitizeParams = (params?: Record<string, string | undefined>) => {
  return Object.fromEntries(
    Object.entries(params ?? {}).filter(([, value]) => value !== undefined),
  );
};

const createSearchParams = (params: Record<string, string | undefined>) => {
  const sanitizedParams = sanitizeParams(params);
  const mergedParams: Record<string, string> = {
    ...apiConfig.defaultParams,
    ...sanitizedParams,
  } as Record<string, string>;

  return new URLSearchParams(mergedParams).toString();
};

const createHeaders = (init?: RequestInit): Headers => {
  const headers = init?.headers ?? {};
  const mergedHeaders = { ...apiConfig.defaultHeaders, ...headers };
  return new Headers(mergedHeaders);
};

const fetcher: Fetcher = async ({ endpoint, params }, init) => {
  const sanitizedParams = sanitizeParams(params);
  const _params = createSearchParams(sanitizedParams);
  const _headers = createHeaders(init);

  const _init = {
    ...init,
    next: { revalidate: 3600, ...init?.next },
    headers: _headers,
  };

  const url = `${apiConfig.baseUrl}/${endpoint}?${_params}`;
  let response: Response;
  try {
    response = await fetch(url, _init);
  } catch (error) {
    if (isNetworkFetchError(error)) {
      return emptyListResponse;
    }
    throw error;
  }

  return await response.json();
};

export const api = {
  fetcher,
};

export const movie = {
  list: ({ list, page, region }: MovieListRequestParams) =>
    api.fetcher<ListResponse<Movie>>({
      endpoint: `movie/${list}`,
      params: {
        page,
        region,
      },
    }),

  detail: <T>({ id, append }: MovieDetailsRequestParams) =>
    api.fetcher<MovieDetails & T>({
      endpoint: `movie/${id}`,
      params: {
        append_to_response: append,
      },
    }),

  credits: ({ id }: MovieCreditsRequestParams) =>
    api.fetcher<Credits>({
      endpoint: `movie/${id}/credits`,
    }),

  recommendations: ({ id, page }: MovieRecommendationsRequestParams) =>
    api.fetcher<ListResponse<Movie>>({
      endpoint: `movie/${id}/recommendations`,
      params: {
        page,
      },
    }),

  similar: ({ id, page }: MovieSimilarRequestParams) =>
    api.fetcher<ListResponse<Movie>>({
      endpoint: `movie/${id}/similar`,
      params: {
        page,
      },
    }),

  images: ({ id, langs }: MovieImagesRequestParams) =>
    api.fetcher<GetImagesResponse>({
      endpoint: `movie/${id}/images`,
      params: {
        include_image_language: langs,
      },
    }),

  videos: ({ id }: MovieVideosRequestParams) =>
    api.fetcher<GetVideosResponse>({
      endpoint: `movie/${id}/videos`,
    }),

  reviews: ({ id, page }: MovieReviewsRequestParams) =>
    api.fetcher<ListResponse<Review>>({
      endpoint: `movie/${id}/reviews`,
      params: {
        page,
      },
    }),

  providers: ({ id, region }: MovieProvidersRequestParams) =>
    api.fetcher<WatchProviders>({
      endpoint: `movie/${id}/watch/providers`,
      params: {
        watch_region: region,
      },
    }),
};

export const tv = {
  list: ({ list, page = "1", region, timezone }: TvListRequestParams) =>
    api.fetcher<ListResponse<TvShow>>({
      endpoint: `tv/${list}`,
      params: {
        page,
        region,
        timezone,
      },
    }),

  detail: <T>({ id, append }: TvDetailsRequestParams) =>
    api.fetcher<TvShowDetails & T>({
      endpoint: `tv/${id}`,
      params: {
        append_to_response: append,
      },
    }),

  credits: ({ id }: TvCreditsRequestParams) =>
    api.fetcher<Credits>({
      endpoint: `tv/${id}/credits`,
    }),

  aggregateCredits: ({ id }: TvCreditsRequestParams) =>
    api.fetcher<Credits>({
      endpoint: `tv/${id}/aggregate_credits`,
    }),

  recommendations: ({ id, page }: TvRecommendationsRequestParams) =>
    api.fetcher<ListResponse<TvShow>>({
      endpoint: `tv/${id}/recommendations`,
      params: {
        page,
      },
    }),

  similar: ({ id, page }: TvSimilarRequestParams) =>
    api.fetcher<ListResponse<TvShow>>({
      endpoint: `tv/${id}/similar`,
      params: {
        page,
      },
    }),

  images: ({ id, langs }: TvImagesRequestParams) =>
    api.fetcher<GetImagesResponse>({
      endpoint: `tv/${id}/images`,
      params: {
        include_image_language: langs,
      },
    }),

  videos: ({ id }: TvVideosRequestParams) =>
    api.fetcher<GetVideosResponse>({
      endpoint: `tv/${id}/videos`,
    }),

  reviews: ({ id, page }: TvReviewsRequestParams) =>
    api.fetcher<ListResponse<Review>>({
      endpoint: `tv/${id}/reviews`,
      params: {
        page,
      },
    }),

  providers: ({ id, region, season }: TvProvidersRequestParams) =>
    api.fetcher<WatchProviders>({
      endpoint: `tv/${id}/${season ? `season/${season}/` : ""}watch/providers`,
      params: {
        watch_region: region,
      },
    }),
};

export const trending = {
  movie: ({ time, page = "1" }: TrendingRequestParams) =>
    api.fetcher<ListResponse<MovieWithMediaType>>({
      endpoint: `trending/movie/${time}`,
      params: {
        page,
      },
    }),

  tv: ({ time, page = "1" }: TrendingRequestParams) =>
    api.fetcher<ListResponse<TvShowWithMediaType>>({
      endpoint: `trending/tv/${time}`,
      params: {
        page,
      },
    }),

  people: ({ time, page = "1" }: TrendingRequestParams) =>
    api.fetcher<ListResponse<PersonWithMediaType>>({
      endpoint: `trending/person/${time}`,
      params: {
        page,
      },
    }),
};

export const person = {
  list: ({ list, page }: PersonListRequestParams) =>
    api.fetcher<ListResponse<Person>>({
      endpoint: `person/${list}`,
      params: {
        page,
      },
    }),

  detail: <T>({ id, append }: PersonDetailsRequestParams) =>
    api.fetcher<PersonDetails & T>({
      endpoint: `person/${id}`,
      params: {
        append_to_response: append,
      },
    }),

  combinedCredits: ({ id }: PersonDetailsRequestParams) =>
    api.fetcher<CombinedCreditsResponse>({
      endpoint: `person/${id}/combined_credits`,
    }),
};

export const collection = {
  details: ({ id }: CollectionRequestParams) =>
    api.fetcher<DetailedCollection>({
      endpoint: `collection/${id}`,
    }),
};

export const search = {
  multi: ({ query, adult = false, page = "1" }: SearchRequestParams) =>
    api.fetcher<
      ListResponse<
        MovieWithMediaType | TvShowWithMediaType | PersonWithMediaType
      >
    >({
      endpoint: "search/multi",
      params: {
        query,
        page,
        include_adult: String(adult),
      },
    }),
};

export const discover = {
  movie: (args: DiscoverMovieRequestParams) =>
    api.fetcher<ListResponse<Movie>>({
      endpoint: "discover/movie",
      params: args as Record<string, string>,
    }),

  tv: (args: DiscoverTvRequestParams) =>
    api.fetcher<ListResponse<TvShow>>({
      endpoint: "discover/tv",
      params: args as Record<string, string>,
    }),
};

export const genres = {
  movie: () =>
    api.fetcher<GenreResponse>({
      endpoint: "genre/movie/list",
    }),

  tv: () =>
    api.fetcher<GenreResponse>({
      endpoint: "genre/tv/list",
    }),
};

export const watchProviders = {
  regions: () =>
    api.fetcher<GetAvailableRegionsResponse>({
      endpoint: `watch/providers/regions`,
    }),

  movie: ({ region }: WatchProvidersRequestParams) =>
    api.fetcher<ListResponse<WatchProvider>>({
      endpoint: `watch/providers/movie`,
      params: {
        watch_region: region,
      },
    }),

  tv: ({ region }: WatchProvidersRequestParams) =>
    api.fetcher<ListResponse<WatchProvider>>({
      endpoint: `watch/providers/tv`,
      params: {
        watch_region: region,
      },
    }),
};

export const tvEpisodes = {
  details: <T>({
    id,
    season: seasonNumber,
    episode: episodeNumber,
    append,
  }: TvEpisodeDetailsRequestParams) => {
    return api.fetcher<Episode & T>({
      endpoint: `tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`,
      params: {
        append_to_response: append,
      },
    });
  },

  images: ({
    id,
    season: seasonNumber,
    episode: episodeNumber,
  }: Omit<TvEpisodeDetailsRequestParams, "append">) => {
    return api.fetcher<GetImagesResponse>({
      endpoint: `tv/${id}/season/${seasonNumber}/episode/${episodeNumber}/images`,
    });
  },

  videos: ({
    id,
    season: seasonNumber,
    episode: episodeNumber,
  }: Omit<TvEpisodeDetailsRequestParams, "append">) => {
    return api.fetcher<GetVideosResponse>({
      endpoint: `tv/${id}/season/${seasonNumber}/episode/${episodeNumber}/videos`,
    });
  },
};

export const tvSeasons = {
  details: <T>({ id, season, append, langs }: TvSeasonsDetailsRequestParams) =>
    api.fetcher<SeasonDetails & T>({
      endpoint: `tv/${id}/season/${season}`,
      params: {
        append_to_response: append,
        include_image_language: langs,
      },
    }),

  credits: ({ id, season }: TvSeasonsDetailsRequestParams) =>
    api.fetcher<Credits>({
      endpoint: `tv/${id}/season/${season}/credits`,
    }),

  aggregateCredits: ({ id, season }: TvSeasonsDetailsRequestParams) =>
    api.fetcher<Credits>({
      endpoint: `tv/${id}/season/${season}/aggregate_credits`,
    }),

  images: ({ id, season, langs }: TvSeasonsImagesRequestParams) =>
    api.fetcher<{ posters: Image[]; backdrops: Image[] }>({
      endpoint: `tv/${id}/season/${season}/images`,
      params: {
        include_image_language: langs,
      },
    }),
};

export const tmdb = {
  collection,
  discover,
  genres,
  movie,
  person,
  search,
  trending,
  tv,
  tvSeasons,
  tvEpisodes,
  watchProviders,
};
