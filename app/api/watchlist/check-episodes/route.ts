import { auth } from "@/auth";
import { db, watchlist } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { checkEpisodesForShow } from "@/app/watchlist/episode-check-service";
import type { EpisodeInfo } from "@/app/watchlist/episode-check-service";

// In-memory cache following pattern from app/api/map/route.ts
const cache = new Map<string, { data: EpisodeInfo; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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

    // Check episodes for each TV show
    for (const item of tvShows) {
      const cacheKey = `episode-data-${item.contentId}`;
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
