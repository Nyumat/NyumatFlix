import { fetchCountryBrowsePage } from "@/lib/server/browse-catalog";
import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ country: string }> },
) {
  const capDenied = await rejectUnlessCapAllowed(req);
  if (capDenied) return capDenied;

  const params = await props.params;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const mediaType = searchParams.get("type") || "movie";
    const sortBy = searchParams.get("sortBy") || "popularity.desc";

    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { error: "Invalid media type. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    const countryCode = params.country;
    const data = await fetchCountryBrowsePage(
      countryCode,
      mediaType,
      page,
      sortBy,
    );

    return NextResponse.json(
      {
        page: data.page,
        total_pages: data.total_pages,
        total_results: data.total_results,
        results: data.results,
        type: mediaType,
        countryCode,
        sortBy,
      },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error("[api/country] Error fetching country content", error);
    return NextResponse.json(
      { error: "Failed to fetch country content" },
      { status: 500 },
    );
  }
}
