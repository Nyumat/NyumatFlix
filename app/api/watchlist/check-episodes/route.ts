import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { checkEpisodesForShow } from "@/app/watchlist/episode-check-service";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";

// In-memory cache following pattern from app/api/map/route.ts
const cache = new Map<string, { data: EpisodeInfo; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all TV shows from user's watchlist
    const tvShows = await db
      .select()
      .from(watchlist)
      .where(
        and(
          eq(watchlist.userId, session.user.id),
          eq(watchlist.mediaType, "tv"),
        ),
      );

    const episodeData: Record<number, EpisodeInfo> = {};

    // Manual verification:
    // 1. POST /api/watchlist/progress with the latest aired episode.
    // 2. Hit this endpoint and confirm countdown info is present.
    // 3. Repeat with an older episode to confirm the cache busts and new-episode data returns.

    // Check episodes for each TV show using progress-aware caching so countdowns
    // start immediately after catching up on the latest aired episode.
    for (const item of tvShows) {
      const cacheKey = makeCacheKey(session.user.id, item);
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

      if (episodeInfo) {
        episodeData[item.contentId] = episodeInfo;
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
