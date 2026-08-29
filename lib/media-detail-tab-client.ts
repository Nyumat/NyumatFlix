import type { ListResponse } from "@/tmdb/api";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import type {
  Credits,
  GetImagesResponse,
  GetVideosResponse,
  Movie,
  MovieDetails,
  Review,
  SeasonDetails,
  TvShow,
  TvShowDetails,
} from "@/tmdb/models";

import {
  TV_DETAIL_CATALOG_ANIME,
  TV_DETAIL_CATALOG_QUERY,
  withTvDetailCatalogQuery,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";

type MediaType = "movie" | "tv";
type Resource =
  | "above-fold"
  | "details"
  | "all-seasons"
  | "credits"
  | "images"
  | "videos"
  | "reviews"
  | "recommendations"
  | "similar";

async function readJsonOrThrow<T>(response: Response, fallbackMessage: string) {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

async function fetchMediaTabResource<T>(
  mediaType: MediaType,
  id: string,
  resource: Resource,
  page?: string,
  catalog?: TvDetailCatalog | null,
): Promise<T> {
  const params = new URLSearchParams();
  if (page) {
    params.set("page", page);
  }
  if (catalog === "anime") {
    params.set(TV_DETAIL_CATALOG_QUERY, TV_DETAIL_CATALOG_ANIME);
  }

  const query = params.toString();
  const response = await fetch(
    `/api/media/${mediaType}/${id}/${resource}${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Failed to fetch ${mediaType} ${resource}`;
    throw new Error(message);
  }

  return readJsonOrThrow<T>(
    response,
    `Invalid response while fetching ${mediaType} ${resource}`,
  );
}

export const fetchMovieCreditsClient = (id: string) =>
  fetchMediaTabResource<Credits>("movie", id, "credits");

export const fetchMovieAboveFoldClient = (id: string) =>
  fetchMediaTabResource<MediaAboveFoldDetail>("movie", id, "above-fold");

export const fetchMovieDetailsClient = (id: string) =>
  fetchMediaTabResource<MovieDetails>("movie", id, "details");

export const fetchMovieImagesClient = (id: string) =>
  fetchMediaTabResource<GetImagesResponse>("movie", id, "images");

export const fetchMovieVideosClient = (id: string) =>
  fetchMediaTabResource<GetVideosResponse>("movie", id, "videos");

export const fetchMovieReviewsPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<Review>>("movie", id, "reviews", page);

export const fetchMovieRecommendationsPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<Movie>>(
    "movie",
    id,
    "recommendations",
    page,
  );

export const fetchMovieSimilarPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<Movie>>("movie", id, "similar", page);

export const fetchTvCreditsClient = (
  id: string,
  catalog?: TvDetailCatalog | null,
) => fetchMediaTabResource<Credits>("tv", id, "credits", undefined, catalog);

export const fetchTvAboveFoldClient = (
  id: string,
  catalog?: TvDetailCatalog | null,
) =>
  fetchMediaTabResource<MediaAboveFoldDetail>(
    "tv",
    id,
    "above-fold",
    undefined,
    catalog,
  );

export const fetchTvDetailsClient = (
  id: string,
  catalog?: TvDetailCatalog | null,
) =>
  fetchMediaTabResource<TvShowDetails>("tv", id, "details", undefined, catalog);

export const fetchTvAllSeasonsClient = (
  id: string,
  catalog?: TvDetailCatalog | null,
) =>
  fetchMediaTabResource<Record<number, SeasonDetails>>(
    "tv",
    id,
    "all-seasons",
    undefined,
    catalog,
  );

export const fetchTvImagesClient = (id: string) =>
  fetchMediaTabResource<GetImagesResponse>("tv", id, "images");

export const fetchTvVideosClient = (id: string) =>
  fetchMediaTabResource<GetVideosResponse>("tv", id, "videos");

export const fetchTvReviewsPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<Review>>("tv", id, "reviews", page);

export const fetchTvRecommendationsPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<TvShow>>(
    "tv",
    id,
    "recommendations",
    page,
  );

export const fetchTvSimilarPageClient = (id: string, page: string) =>
  fetchMediaTabResource<ListResponse<TvShow>>("tv", id, "similar", page);
