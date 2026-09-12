import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { seasonCacheHeaders } from "@/lib/http-cache";
import { fetchSeasonDetailsServer } from "@/lib/server/tvshow-api";
import {
  getCachedTmdbResponse,
  tmdbTvCacheTag,
} from "@/lib/server/tmdb-response-cache";
import { unwrapTmdbLookupId } from "@/lib/tmdb-anime-route-id";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; seasonNumber: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const params = await props.params;
  try {
    const { id, seasonNumber } = params;

    const parsedSeasonNumber = Number.parseInt(seasonNumber, 10);
    if (!Number.isInteger(parsedSeasonNumber) || parsedSeasonNumber < 0) {
      return NextResponse.json(
        { error: "Invalid season number" },
        { status: 400 },
      );
    }

    const routeId = unwrapTmdbLookupId(id);
    const data = await getCachedTmdbResponse({
      cacheKey: `tv-season:${routeId}:${parsedSeasonNumber}`,
      tags: [tmdbTvCacheTag(routeId)],
      revalidateSeconds: 3600,
      memoryFallback: true,
      load: () => fetchSeasonDetailsServer(id, parsedSeasonNumber),
    });

    if (!data) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    return NextResponse.json(data, { headers: seasonCacheHeaders() });
  } catch (error) {
    console.error("Error fetching season details:", error);
    return NextResponse.json(
      { error: "Failed to fetch season details" },
      { status: 500 },
    );
  }
}
