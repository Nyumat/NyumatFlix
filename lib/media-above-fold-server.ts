import {
  type MediaAboveFoldDetail,
  type MediaAboveFoldType,
} from "@/lib/media-above-fold";
import { selectPrimaryTrailerVideo } from "@/lib/select-primary-trailer-video";
import type { GetImagesResponse, GetVideosResponse } from "@/tmdb/models";
import type { Logo } from "@/utils/typings";
import { cache } from "react";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const REVALIDATE_SECONDS = 3600;

type RawAboveFoldDetail = Record<string, unknown> & {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  external_ids?: { imdb_id?: string | null };
  imdb_id?: string | null;
  adult?: boolean;
  seasons?: MediaAboveFoldDetail["seasons"];
  images?: GetImagesResponse;
  videos?: GetVideosResponse;
  release_dates?: {
    results?: Array<{
      iso_3166_1?: string;
      release_dates?: Array<{ certification?: string }>;
    }>;
  };
  content_ratings?: {
    results?: Array<{ iso_3166_1?: string; rating?: string }>;
  };
};

function pickEnglishLogo(
  images: GetImagesResponse | undefined,
): Logo | undefined {
  const logos = images?.logos ?? [];
  return (logos.find((logo) => logo.iso_639_1 === "en") ?? logos[0]) as
    | Logo
    | undefined;
}

function pickMovieCertification(raw: RawAboveFoldDetail): string | null {
  const us = raw.release_dates?.results?.find(
    (result) => result.iso_3166_1 === "US",
  );
  return (
    us?.release_dates?.find((release) => release.certification)
      ?.certification ?? null
  );
}

function pickTvCertification(raw: RawAboveFoldDetail): string | null {
  const us = raw.content_ratings?.results?.find(
    (result) => result.iso_3166_1 === "US",
  );
  return us?.rating || null;
}

function toAboveFoldDetail(
  raw: RawAboveFoldDetail,
  mediaType: MediaAboveFoldType,
): MediaAboveFoldDetail {
  const videos = raw.videos?.results ?? [];
  const primaryTrailer = selectPrimaryTrailerVideo(videos);

  return {
    id: raw.id,
    media_type: mediaType,
    title: raw.title ?? raw.name,
    name: raw.name,
    overview: raw.overview,
    poster_path: raw.poster_path,
    backdrop_path: raw.backdrop_path,
    logo: pickEnglishLogo(raw.images),
    release_date: raw.release_date,
    first_air_date: raw.first_air_date,
    runtime: raw.runtime,
    episode_run_time: raw.episode_run_time,
    number_of_episodes: raw.number_of_episodes,
    number_of_seasons: raw.number_of_seasons,
    genres: raw.genres,
    vote_average: raw.vote_average,
    vote_count: raw.vote_count,
    content_rating:
      mediaType === "movie"
        ? pickMovieCertification(raw)
        : pickTvCertification(raw),
    external_ids: raw.external_ids,
    imdb_id: raw.imdb_id ?? raw.external_ids?.imdb_id ?? null,
    adult: raw.adult,
    seasons: raw.seasons,
    videos: primaryTrailer ? [primaryTrailer] : videos.slice(0, 3),
  };
}

export const getCachedMediaAboveFoldDetail = cache(
  async (
    mediaType: MediaAboveFoldType,
    id: string,
  ): Promise<MediaAboveFoldDetail | null> => {
    const append =
      mediaType === "movie"
        ? "images,videos,external_ids,release_dates"
        : "images,videos,external_ids,content_ratings";
    const url = new URL(`${TMDB_BASE_URL}/${mediaType}/${id}`);
    url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("append_to_response", append);

    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return null;
    }

    return toAboveFoldDetail(await response.json(), mediaType);
  },
);

export const getCachedMovieAboveFoldDetail = (id: string) =>
  getCachedMediaAboveFoldDetail("movie", id);

export const getCachedTvAboveFoldDetail = (id: string) =>
  getCachedMediaAboveFoldDetail("tv", id);
