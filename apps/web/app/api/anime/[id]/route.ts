import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { getCachedAnilistTvShowDetail } from "@/lib/anilist-tv-detail";
import { isAnimeAnilistRouteId } from "@/lib/anilist-route-id";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const { id } = await props.params;

  if (!id) {
    return NextResponse.json(
      { error: "Anime ID is required" },
      { status: 400 },
    );
  }

  if (!isAnimeAnilistRouteId(id)) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  try {
    const details = await getCachedAnilistTvShowDetail(id, {
      acceptBareNumeric: true,
    });

    if (!details) {
      return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    }

    return NextResponse.json(details, { headers: catalogCacheHeaders() });
  } catch (error) {
    console.error(`Error fetching anime details for ID ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch anime details" },
      { status: 500 },
    );
  }
}
