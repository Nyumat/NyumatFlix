"use server";

import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchTVShowDetails } from "@/components/tvshow/tvshow-api";

export interface WatchlistItem {
  id: string;
  userId: string;
  contentId: number;
  mediaType: "movie" | "tv";
  status: "watching" | "waiting" | "finished";
  lastWatchedSeason: number | null;
  lastWatchedEpisode: number | null;
  lastWatchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get user's watchlist items
 */
export async function getUserWatchlist(): Promise<WatchlistItem[]> {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  const items = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, session.user.id))
    .orderBy(watchlist.updatedAt);

  return items as WatchlistItem[];
}

/**
 * Get watchlist item for a specific content
 */
export async function getWatchlistItem(
  contentId: number,
  mediaType: "movie" | "tv",
): Promise<WatchlistItem | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const [item] = await db
    .select()
    .from(watchlist)
    .where(
      and(
        eq(watchlist.userId, session.user.id),
        eq(watchlist.contentId, contentId),
        eq(watchlist.mediaType, mediaType),
      ),
    )
    .limit(1);

  return (item as WatchlistItem) || null;
}

/**
 * Auto-detect if a TV show should be marked as "waiting for new episodes"
 * This checks if the user has watched all available episodes and the show is not ended
 */
export async function checkAndUpdateWaitingStatus(
  contentId: number,
): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  try {
    // Get the watchlist item
    const [item] = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, session.user.id),
          eq(watchlist.contentId, contentId),
          eq(watchlist.mediaType, "tv"),
        ),
      )
      .limit(1);

    if (!item || item.status === "finished" || item.status === "waiting") {
      return; // Don't auto-update if already finished or waiting
    }

    // Fetch TV show details to check total episodes and status
    const tvShowDetails = await fetchTVShowDetails(contentId.toString());

    if (!tvShowDetails) {
      return;
    }

    // Check if show has ended
    if (tvShowDetails.status === "Ended") {
      return; // Don't auto-mark as waiting if show has ended
    }

    // Check if user has watched all available episodes
    const totalEpisodes = tvShowDetails.number_of_episodes || 0;
    const lastWatchedEpisode = item.lastWatchedEpisode || 0;

    // If user has watched all episodes and show is not ended, mark as waiting
    if (lastWatchedEpisode >= totalEpisodes && totalEpisodes > 0) {
      await db
        .update(watchlist)
        .set({
          status: "waiting",
          updatedAt: new Date(),
        })
        .where(eq(watchlist.id, item.id));
    }
  } catch (error) {
    console.error("Error checking waiting status:", error);
    // Silently fail - this is a background check
  }
}

/**
 * Batch check waiting status for all TV shows in user's watchlist
 * This can be called periodically (e.g., daily) to auto-update statuses
 */
export async function batchCheckWaitingStatus(): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  try {
    // Get all TV shows in watchlist that are currently "watching"
    const tvShows = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, session.user.id),
          eq(watchlist.mediaType, "tv"),
          eq(watchlist.status, "watching"),
        ),
      );

    // Check each TV show
    for (const item of tvShows) {
      await checkAndUpdateWaitingStatus(item.contentId);
    }
  } catch (error) {
    console.error("Error in batch check waiting status:", error);
  }
}
