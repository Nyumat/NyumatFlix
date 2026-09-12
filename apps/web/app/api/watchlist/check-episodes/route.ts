import { auth } from "@/auth";
import { db, watchlist } from "@/db";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  makeEpisodeCheckCacheKey,
  resolveEpisodeCheckForShow,
} from "@/lib/server/episode-check-cache";
import { runInChunks } from "@/lib/server/chunked-parallel";
import type { EpisodeInfo } from "@/lib/domain/episodes";

type WatchlistRow = typeof watchlist.$inferSelect;

async function resolveEpisodeInfo(
  userId: string,
  item: WatchlistRow,
): Promise<EpisodeInfo | null> {
  const cacheKey = makeEpisodeCheckCacheKey(
    userId,
    item.contentId,
    item.lastWatchedSeason,
    item.lastWatchedEpisode,
    item.status,
  );

  return resolveEpisodeCheckForShow(
    item.contentId,
    item.lastWatchedSeason,
    item.lastWatchedEpisode,
    cacheKey,
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const tvShows = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.mediaType, "tv")));

    const scopedShows =
      scope === "watching"
        ? tvShows.filter((item) => item.status === "watching")
        : tvShows;

    const episodeData: Record<number, EpisodeInfo> = {};

    const resolved = await runInChunks(scopedShows, async (item) => {
      const episodeInfo = await resolveEpisodeInfo(userId, item);
      return episodeInfo ? { contentId: item.contentId, episodeInfo } : null;
    });

    for (const entry of resolved) {
      if (entry) {
        episodeData[entry.contentId] = entry.episodeInfo;
      }
    }

    return NextResponse.json({ episodeData }, { status: 200 });
  } catch (error) {
    console.error("Error checking episodes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
