import "server-only";

import { MediaItemSchema, type MediaItem } from "@/lib/domain/typings";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { runInChunks } from "@/lib/server/chunked-parallel";
import { tmdb } from "@/tmdb/api";
import { cache } from "react";

export type WatchlistMediaItem = MediaItem & {
  media_type: "movie" | "tv";
  watchlistItem: WatchlistItem;
};

type TmdbDetailGenre = {
  id: number;
  name?: string;
};

function normalizeTmdbDetailForWatchlist(
  data: unknown,
  item: WatchlistItem,
): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const detail = data as {
    genres?: TmdbDetailGenre[];
    genre_ids?: number[];
    media_type?: "movie" | "tv";
  };

  return {
    ...detail,
    media_type: item.mediaType,
    genre_ids:
      detail.genre_ids ??
      detail.genres
        ?.map((genre) => genre.id)
        .filter((id): id is number => typeof id === "number") ??
      [],
  };
}

const fetchWatchlistMediaDetail = cache(
  async (item: WatchlistItem): Promise<WatchlistMediaItem | null> => {
    try {
      const data =
        item.mediaType === "movie"
          ? await tmdb.movie.detail({ id: String(item.contentId) })
          : await tmdb.tv.detail({ id: String(item.contentId) });

      const normalized = normalizeTmdbDetailForWatchlist(data, item);
      const parsed = MediaItemSchema.safeParse(normalized);
      if (!parsed.success) {
        console.error(
          `Invalid watchlist media payload for ${item.mediaType} ${item.contentId}:`,
          parsed.error.message,
        );
        return null;
      }

      return {
        ...parsed.data,
        media_type: item.mediaType,
        watchlistItem: item,
      };
    } catch (error) {
      console.error(
        `Error fetching ${item.mediaType} ${item.contentId}:`,
        error,
      );
      return null;
    }
  },
);

export async function fetchWatchlistMediaItems(
  watchlistItems: WatchlistItem[],
): Promise<WatchlistMediaItem[]> {
  if (watchlistItems.length === 0) {
    return [];
  }

  const results = await runInChunks(watchlistItems, (item) =>
    fetchWatchlistMediaDetail(item),
  );

  return results.filter((item): item is WatchlistMediaItem => item !== null);
}
