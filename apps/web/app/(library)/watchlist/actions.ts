"use server";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  getUserWatchlist as getUserWatchlistImpl,
  getWatchlistItem as getWatchlistItemImpl,
} from "@/lib/server/watchlist-actions";

export async function getUserWatchlist(
  userId?: string,
): Promise<WatchlistItem[]> {
  return getUserWatchlistImpl(userId);
}

export async function getWatchlistItem(
  contentId: number,
  mediaType: "movie" | "tv",
): Promise<WatchlistItem | null> {
  return getWatchlistItemImpl(contentId, mediaType);
}
