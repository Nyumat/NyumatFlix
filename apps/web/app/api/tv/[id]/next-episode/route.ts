import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { checkEpisodesForShow } from "@/lib/server/episode-check-service";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";

const parseOptionalInt = (value: string | null): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const params = await props.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "TV show ID is required" },
      { status: 400 },
    );
  }

  const contentId = Number.parseInt(id, 10);
  if (!Number.isInteger(contentId) || contentId <= 0) {
    return NextResponse.json({ error: "Invalid TV show ID" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const lastWatchedSeason = parseOptionalInt(
    searchParams.get("lastWatchedSeason"),
  );
  const lastWatchedEpisode = parseOptionalInt(
    searchParams.get("lastWatchedEpisode"),
  );

  try {
    const episodeInfo = await checkEpisodesForShow(
      contentId,
      lastWatchedSeason,
      lastWatchedEpisode,
    );

    return NextResponse.json(
      {
        episodeInfo: episodeInfo
          ? {
              ...episodeInfo,
              nextEpisodeDate:
                episodeInfo.nextEpisodeDate?.toISOString() ?? null,
              latestEpisodeAirDate:
                episodeInfo.latestEpisodeAirDate?.toISOString() ?? null,
            }
          : null,
      },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error(`Error fetching next episode for TV show ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch next episode" },
      { status: 500 },
    );
  }
}
