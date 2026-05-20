import type { GetVideosResponse, Video } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";
import type { Logo, MediaItem } from "@/utils/typings";

export type MediaAboveFoldType = "movie" | "tv";

export type MediaAboveFoldDetail = Partial<MediaItem> & {
  id: number;
  media_type: MediaAboveFoldType;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  logo?: Logo;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  content_rating?: string | null;
  external_ids?: { imdb_id?: string | null };
  imdb_id?: string | null;
  adult?: boolean;
  seasons?: MediaItem["seasons"];
  videos?: Video[] | GetVideosResponse;
};

export function getMediaAboveFoldHref(
  mediaType: MediaAboveFoldType,
  id: string | number,
) {
  return mediaType === "movie" ? `/movies/${id}` : `/tvshows/${id}`;
}

export function getMediaAboveFoldApiHref(
  mediaType: MediaAboveFoldType,
  id: string | number,
) {
  return `/api/media/${mediaType}/${id}/above-fold`;
}

export function getMediaAboveFoldImageUrls(media: MediaAboveFoldDetail) {
  const urls = new Set<string>();

  if (media.poster_path) {
    urls.add(tmdbImage.poster(media.poster_path, "w780"));
  }
  if (media.backdrop_path) {
    urls.add(tmdbImage.backdrop(media.backdrop_path, "w1280"));
  }
  if (media.logo?.file_path) {
    urls.add(tmdbImage.logo(media.logo.file_path, "w500"));
  }

  return Array.from(urls);
}
