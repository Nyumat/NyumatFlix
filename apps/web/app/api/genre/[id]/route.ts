import { fetchGenreBrowsePage } from "@/lib/server/browse-catalog";
import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(req);
  if (capDenied) return capDenied;

  const params = await props.params;
  const genreId = params.id;
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const mediaType = typeParam === "tv" ? "tv" : "movie";
  const pageParam = url.searchParams.get("page") || "1";
  const page = parseInt(pageParam, 10);

  try {
    const data = await fetchGenreBrowsePage(genreId, mediaType, page);

    return NextResponse.json(
      {
        page: data.page,
        total_pages: data.total_pages,
        results: data.results,
        type: mediaType,
        genreId,
      },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error("[api/genre] Error fetching genre items", error);
    return NextResponse.json(
      { error: "Failed to fetch genre items" },
      { status: 500 },
    );
  }
}
