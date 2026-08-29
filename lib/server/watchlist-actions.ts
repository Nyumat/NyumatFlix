import "server-only";

import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import type { WatchlistItem } from "@/lib/domain/watchlist";
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
