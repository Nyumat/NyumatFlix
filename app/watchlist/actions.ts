"use server";

import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  batchCheckWaitingStatus as batchCheckWaitingStatusImpl,
  checkAndUpdateWaitingStatus as checkAndUpdateWaitingStatusImpl,
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

export async function checkAndUpdateWaitingStatus(
  contentId: number,
): Promise<void> {
  return checkAndUpdateWaitingStatusImpl(contentId);
}

export async function batchCheckWaitingStatus(): Promise<void> {
  return batchCheckWaitingStatusImpl();
}
