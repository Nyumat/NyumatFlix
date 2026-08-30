import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { seasonCacheHeaders } from "@/lib/http-cache";
import { getCachedAnilistTvSeasonDetails } from "@/lib/anilist-tv-detail";
import { isAnimeAnilistRouteId } from "@/lib/anilist-route-id";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; seasonNumber: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { id, seasonNumber } = await props.params;

  if (!id || !isAnimeAnilistRouteId(id)) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  const parsedSeasonNumber = Number.parseInt(seasonNumber, 10);
  if (!Number.isInteger(parsedSeasonNumber) || parsedSeasonNumber < 0) {
    return NextResponse.json(
      { error: "Invalid season number" },
      { status: 400 },
    );
  }

  try {
    const data = await getCachedAnilistTvSeasonDetails(id, parsedSeasonNumber, {
      acceptBareNumeric: true,
    });
    if (!data) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    return NextResponse.json(data, { headers: seasonCacheHeaders() });
  } catch (error) {
    console.error("Error fetching anime season details:", error);
    return NextResponse.json(
      { error: "Failed to fetch season details" },
      { status: 500 },
    );
  }
}
