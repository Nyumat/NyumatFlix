import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import {
  getKitsuEpisodeThumbnails,
  resolveKitsuThumbnailsForTmdbSeason,
} from "@/lib/anime/kitsu-episode-thumbnails";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { searchParams } = new URL(request.url);
  const anilistId = Number.parseInt(searchParams.get("anilistId") ?? "", 10);
  const tmdbShowId = Number.parseInt(searchParams.get("tmdbShowId") ?? "", 10);
  const seasonNumber = Number.parseInt(
    searchParams.get("seasonNumber") ?? "",
    10,
  );
  const sourceAnilistId = Number.parseInt(
    searchParams.get("sourceAnilistId") ?? "",
    10,
  );
  const tmdbSeasonCount = Number.parseInt(
    searchParams.get("tmdbSeasonCount") ?? "",
    10,
  );

  const hasAnilistId = Number.isInteger(anilistId) && anilistId > 0;
  const hasTmdbSeason =
    Number.isInteger(tmdbShowId) &&
    tmdbShowId > 0 &&
    Number.isInteger(seasonNumber) &&
    seasonNumber > 0;
  const hasSourceAnilistId =
    Number.isInteger(sourceAnilistId) && sourceAnilistId > 0;
  const hasTmdbSeasonCount =
    Number.isInteger(tmdbSeasonCount) && tmdbSeasonCount > 0;

  if (!hasAnilistId && !hasTmdbSeason) {
    return NextResponse.json(
      {
        error:
          "Provide anilistId or both tmdbShowId and seasonNumber as positive integers",
      },
      { status: 400 },
    );
  }

  try {
    const thumbnails = hasAnilistId
      ? await getKitsuEpisodeThumbnails(anilistId)
      : await resolveKitsuThumbnailsForTmdbSeason({
          tmdbShowId,
          seasonNumber,
          sourceAnilistId: hasSourceAnilistId ? sourceAnilistId : null,
          tmdbSeasonCount: hasTmdbSeasonCount ? tmdbSeasonCount : null,
        });

    return NextResponse.json(
      { thumbnails },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error("Error in /api/anime/episode-thumbnails:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
