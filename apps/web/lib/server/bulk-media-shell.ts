import "server-only";

import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import { enrichLocalizedCatalogBackdrops } from "@/lib/server/enrich-catalog-backdrops";

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

const readOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const readGenreList = (
  value: unknown,
): Array<{ id: number; name?: string }> | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const genres: Array<{ id: number; name?: string }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !("id" in entry)) {
      continue;
    }
    if (typeof entry.id !== "number") {
      continue;
    }
    genres.push({
      id: entry.id,
      name:
        "name" in entry && typeof entry.name === "string"
          ? entry.name
          : undefined,
    });
  }

  return genres;
};

const mapMovieShell = (
  item: BulkMediaShellRequestItem,
  detail: NonNullable<Awaited<ReturnType<typeof getCachedMovieDetail>>>,
): BulkMediaShellResponseItem => ({
  mediaType: "movie",
  contentId: item.contentId,
  title: readOptionalString(detail.title),
  backdrop_path: detail.backdrop_path,
  poster_path: detail.poster_path,
  vote_average: detail.vote_average,
  release_date: readOptionalString(detail.release_date),
  genre_ids: detail.genre_ids,
  genres: readGenreList(detail.genres),
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

export const fetchBulkMediaShells = async (
  items: BulkMediaShellRequestItem[],
): Promise<(BulkMediaShellResponseItem | null)[]> => {
  const shells = await Promise.all(items.map(fetchBulkMediaShell));
  const shellIndexes: number[] = [];
  const payloads = shells.flatMap((shell, index) => {
    if (!shell) {
      return [];
    }
    shellIndexes.push(index);
    return [
      {
        id: shell.contentId,
        media_type: shell.mediaType,
        backdrop_path: shell.backdrop_path,
      },
    ];
  });
  const enriched = await enrichLocalizedCatalogBackdrops(payloads);

  return shells.map((shell, index) => {
    if (!shell) {
      return null;
    }
    const enrichedIndex = shellIndexes.indexOf(index);
    const backdropPath = enriched[enrichedIndex]?.backdrop_path;
    return backdropPath ? { ...shell, backdrop_path: backdropPath } : shell;
  });
};
