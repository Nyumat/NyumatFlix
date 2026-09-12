import "server-only";

import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";

export const BULK_MEDIA_SHELL_MAX_ITEMS = 20;

export type BulkMediaShellRequestItem = {
  mediaType: "movie" | "tv";
  contentId: number;
};

export type BulkMediaShellResponseItem = {
  mediaType: "movie" | "tv";
  contentId: number;
  title?: string;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name?: string }>;
  status?: string | null;
  last_episode_to_air?: unknown;
  next_episode_to_air?: unknown;
};

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  Number.isFinite(value) &&
  value > 0;

export const isBulkMediaShellRequestItem = (
  value: unknown,
): value is BulkMediaShellRequestItem => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.mediaType === "movie" || record.mediaType === "tv") &&
    isPositiveInt(record.contentId)
  );
};

export const parseBulkMediaShellRequestItems = (
  value: unknown,
): BulkMediaShellRequestItem[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  if (
    value.length === 0 ||
    value.length > BULK_MEDIA_SHELL_MAX_ITEMS ||
    !value.every(isBulkMediaShellRequestItem)
  ) {
    return null;
  }

  return value;
};

const mapMovieShell = (
  item: BulkMediaShellRequestItem,
  detail: NonNullable<Awaited<ReturnType<typeof getCachedMovieDetail>>>,
): BulkMediaShellResponseItem => ({
  mediaType: "movie",
  contentId: item.contentId,
  title: detail.title,
  backdrop_path: detail.backdrop_path,
  poster_path: detail.poster_path,
  vote_average: detail.vote_average,
  release_date: detail.release_date,
  genre_ids: detail.genre_ids,
  genres: detail.genres,
});

const mapTvShell = (
  item: BulkMediaShellRequestItem,
  detail: NonNullable<Awaited<ReturnType<typeof getCachedTvShowDetail>>>,
): BulkMediaShellResponseItem => ({
  mediaType: "tv",
  contentId: item.contentId,
  name: detail.name,
  backdrop_path: detail.backdrop_path,
  poster_path: detail.poster_path,
  vote_average: detail.vote_average,
  first_air_date: detail.first_air_date,
  genre_ids: detail.genre_ids,
  genres: detail.genres,
  status: detail.status,
  last_episode_to_air: detail.last_episode_to_air,
  next_episode_to_air: detail.next_episode_to_air,
});

const fetchBulkMediaShell = async (
  item: BulkMediaShellRequestItem,
): Promise<BulkMediaShellResponseItem | null> => {
  if (item.mediaType === "movie") {
    const detail = await getCachedMovieDetail(String(item.contentId), {
      append: "shell",
    });
    return detail ? mapMovieShell(item, detail) : null;
  }

  const detail = await getCachedTvShowDetail(String(item.contentId), {
    append: "shell",
  });
  return detail ? mapTvShell(item, detail) : null;
};

export const fetchBulkMediaShells = (
  items: BulkMediaShellRequestItem[],
): Promise<(BulkMediaShellResponseItem | null)[]> =>
  Promise.all(items.map(fetchBulkMediaShell));
