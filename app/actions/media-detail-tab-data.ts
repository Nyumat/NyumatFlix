"use server";

import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import { tmdb } from "@/tmdb/api";

export async function fetchCollectionDetails(collectionId: number) {
  return tmdb.collection.details({ id: collectionId });
}

export async function getTvShowDetailsForQuery(id: string) {
  return getCachedTvShowDetail(id);
}

export async function getTvAllSeasonsForQuery(id: string) {
  const details = await getCachedTvShowDetail(id);
  if (!details) {
    return {};
  }
  return fetchAllSeasonDetails(id, details.seasons);
}

export async function getMovieDetailsForQuery(id: string) {
  return getCachedMovieDetail(id);
}

export async function fetchTvReviewsPage(id: string, page: string) {
  return tmdb.tv.reviews({ id, page });
}

export async function fetchTvRecommendationsPage(id: string, page: string) {
  return tmdb.tv.recommendations({ id, page });
}

export async function fetchTvSimilarPage(id: string, page: string) {
  return tmdb.tv.similar({ id, page });
}

export async function fetchTvCredits(id: string) {
  return tmdb.tv.credits({ id });
}

export async function fetchTvImages(id: string) {
  return tmdb.tv.images({ id, langs: "en,null" });
}

export async function fetchTvVideos(id: string) {
  return tmdb.tv.videos({ id });
}

export async function fetchMovieReviewsPage(id: string, page: string) {
  return tmdb.movie.reviews({ id, page });
}

export async function fetchMovieRecommendationsPage(id: string, page: string) {
  return tmdb.movie.recommendations({ id, page });
}

export async function fetchMovieSimilarPage(id: string, page: string) {
  return tmdb.movie.similar({ id, page });
}

export async function fetchMovieCredits(id: string) {
  return tmdb.movie.credits({ id });
}

export async function fetchMovieImages(id: string) {
  return tmdb.movie.images({ id, langs: "en,null" });
}

export async function fetchMovieVideos(id: string) {
  return tmdb.movie.videos({ id });
}
