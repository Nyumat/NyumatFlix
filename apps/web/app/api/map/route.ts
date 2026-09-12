import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { resolveMapResponse } from "@/lib/server/map-resolver";
import { getCachedTmdbResponse } from "@/lib/server/tmdb-response-cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { searchParams } = new URL(request.url);
  const tmdbShowId = searchParams.get("tmdbShowId");
  const tmdbSeason = searchParams.get("tmdbSeason");
  const sourceAnilistIdParam = searchParams.get("sourceAnilistId");
  const debug = searchParams.get("debug") === "true";

  if (!tmdbShowId) {
    return NextResponse.json(
      { error: "tmdbShowId parameter is required" },
      { status: 400 },
    );
  }

  const showId = parseInt(tmdbShowId);
  if (isNaN(showId)) {
    return NextResponse.json(
      { error: "tmdbShowId must be a valid number" },
      { status: 400 },
    );
  }

  const seasonNumber = tmdbSeason ? parseInt(tmdbSeason) : undefined;
  const sourceAnilistId = sourceAnilistIdParam
    ? parseInt(sourceAnilistIdParam, 10)
    : undefined;

  try {
    const response = await getCachedTmdbResponse({
      cacheKey: `map:${showId}:${seasonNumber ?? "all"}:${sourceAnilistId ?? "none"}:${debug}`,
      tags: [`map:${showId}`],
      revalidateSeconds: 3600,
      load: () =>
        resolveMapResponse({
          showId,
          seasonNumber,
          sourceAnilistId,
          debug,
        }),
    });

    return NextResponse.json(response, { headers: catalogCacheHeaders() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message === "Failed to fetch TMDB show data") {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (message === "Failed to extract search title from TMDB show") {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (message === "No AniList matches found") {
      return NextResponse.json({ error: message }, { status: 502 });
    }

    console.error("Error in /api/map:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
