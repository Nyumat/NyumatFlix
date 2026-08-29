"use server";

import {
  fetchCollectionDetails as fetchCollectionDetailsImpl,
  fetchMovieCredits as fetchMovieCreditsImpl,
  fetchMovieImages as fetchMovieImagesImpl,
  fetchMovieRecommendationsPage as fetchMovieRecommendationsPageImpl,
  fetchMovieReviewsPage as fetchMovieReviewsPageImpl,
  fetchMovieSimilarPage as fetchMovieSimilarPageImpl,
  fetchMovieVideos as fetchMovieVideosImpl,
  fetchTvCredits as fetchTvCreditsImpl,
  fetchTvImages as fetchTvImagesImpl,
  fetchTvRecommendationsPage as fetchTvRecommendationsPageImpl,
  fetchTvReviewsPage as fetchTvReviewsPageImpl,
  fetchTvSimilarPage as fetchTvSimilarPageImpl,
  fetchTvVideos as fetchTvVideosImpl,
  getMovieDetailsForQuery as getMovieDetailsForQueryImpl,
  getTvAllSeasonsForQuery as getTvAllSeasonsForQueryImpl,
  getTvShowDetailsForQuery as getTvShowDetailsForQueryImpl,
} from "@/lib/server/media-detail-tab-data";

export async function fetchCollectionDetails(collectionId: number) {
  return fetchCollectionDetailsImpl(collectionId);
}

export async function getTvShowDetailsForQuery(id: string) {
  return getTvShowDetailsForQueryImpl(id);
}

export async function getTvAllSeasonsForQuery(id: string) {
  return getTvAllSeasonsForQueryImpl(id);
}

export async function getMovieDetailsForQuery(id: string) {
  return getMovieDetailsForQueryImpl(id);
}

export async function fetchTvReviewsPage(id: string, page: string) {
  return fetchTvReviewsPageImpl(id, page);
}

export async function fetchTvRecommendationsPage(id: string, page: string) {
  return fetchTvRecommendationsPageImpl(id, page);
}

export async function fetchTvSimilarPage(id: string, page: string) {
  return fetchTvSimilarPageImpl(id, page);
}

export async function fetchTvCredits(id: string) {
  return fetchTvCreditsImpl(id);
}

export async function fetchTvImages(id: string) {
  return fetchTvImagesImpl(id);
}

export async function fetchTvVideos(id: string) {
  return fetchTvVideosImpl(id);
}

export async function fetchMovieReviewsPage(id: string, page: string) {
  return fetchMovieReviewsPageImpl(id, page);
}

export async function fetchMovieRecommendationsPage(id: string, page: string) {
  return fetchMovieRecommendationsPageImpl(id, page);
}

export async function fetchMovieSimilarPage(id: string, page: string) {
  return fetchMovieSimilarPageImpl(id, page);
}

export async function fetchMovieCredits(id: string) {
  return fetchMovieCreditsImpl(id);
}

export async function fetchMovieImages(id: string) {
  return fetchMovieImagesImpl(id);
}

export async function fetchMovieVideos(id: string) {
  return fetchMovieVideosImpl(id);
}
