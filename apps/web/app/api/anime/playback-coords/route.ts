import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { resolveAnimePlaybackCoords } from "@/lib/anime/resolve-playback-coords";
import { getCachedTmdbResponse } from "@/lib/server/tmdb-response-cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { searchParams } = new URL(request.url);
  const tmdbShowId = Number.parseInt(searchParams.get("tmdbShowId") ?? "", 10);
  const anilistId = Number.parseInt(searchParams.get("anilistId") ?? "", 10);
  const seasonNumber = Number.parseInt(
    searchParams.get("seasonNumber") ?? "",
    10,
  );
  const episodeNumber = Number.parseInt(
    searchParams.get("episodeNumber") ?? "",
    10,
  );

  const hasTmdbShowId = Number.isInteger(tmdbShowId) && tmdbShowId > 0;
  const hasAnilistId = Number.isInteger(anilistId) && anilistId > 0;

  if (
    (!hasTmdbShowId && !hasAnilistId) ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber <= 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "seasonNumber, episodeNumber, and tmdbShowId or anilistId must be positive integers",
      },
      { status: 400 },
    );
  }

  try {
    const coords = await getCachedTmdbResponse({
      cacheKey: `playback-coords:${hasTmdbShowId ? tmdbShowId : "a" + anilistId}:${seasonNumber}:${episodeNumber}`,
      tags: hasTmdbShowId ? [`map:${tmdbShowId}`] : [`anilist:${anilistId}`],
      revalidateSeconds: 3600,
      memoryFallback: true,
      load: () =>
        resolveAnimePlaybackCoords({
          tmdbShowId: hasTmdbShowId ? tmdbShowId : null,
          anilistId: hasAnilistId ? anilistId : null,
          seasonNumber,
          episodeNumber,
        }),
    });

    if (!coords) {
      return NextResponse.json(
        { coords: null },
        { headers: catalogCacheHeaders() },
      );
    }

    return NextResponse.json(
      {
        coords: {
          anilistId: coords.anilistId,
          relativeEpisodeNumber: coords.relativeEpisodeNumber,
          animeSeasonNumber: coords.animeSeasonNumber,
          animeInfo: coords.animeInfo,
          confidence: "high" as const,
          source: coords.source,
          isAdult: coords.isAdult,
          genres: coords.genres,
        },
      },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error("Error in /api/anime/playback-coords:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
