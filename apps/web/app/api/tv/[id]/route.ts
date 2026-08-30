import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { resolveTvShowDetailForApiRoute } from "@/lib/server/tvshow-api";
import { isTmdbNotFoundError } from "@/lib/tmdb-errors";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
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

  try {
    const tvDetails = await resolveTvShowDetailForApiRoute(id);

    if (!tvDetails) {
      return NextResponse.json({ error: "TV show not found" }, { status: 404 });
    }

    return NextResponse.json(tvDetails, { headers: catalogCacheHeaders() });
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      return NextResponse.json({ error: "TV show not found" }, { status: 404 });
    }

    console.error(`Error fetching TV show details for ID ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch TV show details" },
      { status: 500 },
    );
  }
}
