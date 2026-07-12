import "server-only";

import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import { and, eq } from "drizzle-orm";

export async function getUserWatchlist(
  userId?: string,
): Promise<WatchlistItem[]> {
  const resolvedUserId =
    userId ?? (await auth().then((session) => session?.user?.id ?? undefined));

  if (!resolvedUserId) {
    return [];
  }

  const items = await db
    .select()
    .from(watchlist)
    .where(eq(watchlist.userId, resolvedUserId))
    .orderBy(watchlist.updatedAt);

  return items as WatchlistItem[];
}

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

export async function checkAndUpdateWaitingStatus(
  contentId: number,
): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  try {
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

    const tvShowDetails = await fetchTVShowDetails(contentId.toString());

    if (!tvShowDetails) {
      return;
    }

    if (tvShowDetails.status === "Ended") {
      return; // Don't auto-mark as waiting if show has ended
    }

    const totalEpisodes = tvShowDetails.number_of_episodes || 0;
    const lastWatchedEpisode = item.lastWatchedEpisode || 0;

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
  }
}

export async function batchCheckWaitingStatus(): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  try {
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

    for (const item of tvShows) {
      await checkAndUpdateWaitingStatus(item.contentId);
    }
  } catch (error) {
    console.error("Error in batch check waiting status:", error);
  }
}
