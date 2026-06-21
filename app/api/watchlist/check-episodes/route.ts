import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { checkEpisodesForShow } from "@/lib/server/episode-check-service";
import { runInChunks } from "@/lib/server/chunked-parallel";
import type { EpisodeInfo } from "@/lib/domain/episodes";

// In-memory cache following pattern from app/api/map/route.ts
const cache = new Map<string, { data: EpisodeInfo; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 500;

type WatchlistRow = typeof watchlist.$inferSelect;

function getCached(key: string): EpisodeInfo | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(key: string, data: EpisodeInfo) {
  cache.set(key, { data, timestamp: Date.now() });

  if (cache.size <= MAX_CACHE_ENTRIES) return;
  const oldestKey = cache.keys().next().value;
  if (oldestKey) cache.delete(oldestKey);
}

/**
 * Cache entries are scoped per user + show + progress so we refresh as soon as the
 * viewer logs a new episode or flips status (watching/waiting/finished).
 */
function makeCacheKey(userId: string, item: WatchlistRow) {
  const progressKey = [
    item.lastWatchedSeason ?? "none",
    item.lastWatchedEpisode ?? "none",
  ].join("-");

  return [
    "episode-data",
    userId,
    item.contentId,
    item.status,
    progressKey,
  ].join(":");
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all TV shows from user's watchlist
    const tvShows = await db
      .select()
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.mediaType, "tv")));

    const episodeData: Record<number, EpisodeInfo> = {};

    const resolved = await runInChunks(tvShows, async (item) => {
      const cacheKey = makeCacheKey(userId, item);
      let episodeInfo = getCached(cacheKey);

      if (!episodeInfo) {
        episodeInfo = await checkEpisodesForShow(
          item.contentId,
          item.lastWatchedSeason,
          item.lastWatchedEpisode,
        );

        if (episodeInfo) {
          setCached(cacheKey, episodeInfo);
        }
      }

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
