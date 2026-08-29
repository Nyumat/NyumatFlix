import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { resolveAnimePlaybackCoords } from "@/lib/anime/resolve-playback-coords";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { searchParams } = new URL(request.url);
  const tmdbShowId = Number.parseInt(searchParams.get("tmdbShowId") ?? "", 10);
  const seasonNumber = Number.parseInt(
    searchParams.get("seasonNumber") ?? "",
    10,
  );
  const episodeNumber = Number.parseInt(
    searchParams.get("episodeNumber") ?? "",
    10,
  );

  if (
    !Number.isInteger(tmdbShowId) ||
    tmdbShowId <= 0 ||
    !Number.isInteger(seasonNumber) ||
    seasonNumber <= 0 ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "tmdbShowId, seasonNumber, and episodeNumber must be positive integers",
      },
      { status: 400 },
    );
  }

  try {
    const coords = await resolveAnimePlaybackCoords({
      tmdbShowId,
      seasonNumber,
      episodeNumber,
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
