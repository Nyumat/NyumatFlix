import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { parseDetailApiView } from "@/lib/performance/detail-view";
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
      { error: "Movie ID is required" },
      { status: 400 },
    );
  }

  const view = parseDetailApiView(new URL(request.url).searchParams);

  try {
    const movieDetails = await getCachedMovieDetail(id, { append: view });

    if (!movieDetails) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    return NextResponse.json(movieDetails, { headers: catalogCacheHeaders() });
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    console.error(`Error fetching movie details for ID ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch movie details" },
      { status: 500 },
    );
  }
}
