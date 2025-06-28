import { NextRequest, NextResponse } from "next/server";
import { fetchTMDBData } from "@/app/actions";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const genreId = params.id;
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  // Default to movie if no type provided or invalid value
  const mediaType = typeParam === "tv" ? "tv" : "movie";
  const pageParam = url.searchParams.get("page") || "1";
  const page = parseInt(pageParam, 10);

  try {
    const data = await fetchTMDBData<unknown>(
      `/discover/${mediaType}`,
      {
        with_genres: genreId,
        sort_by: "popularity.desc",
        language: "en-US",
        include_adult: "false",
      },
      page,
    );

    const resultsWithPoster = (data.results || []).filter((item) =>
      Boolean(item.poster_path),
    );

    return NextResponse.json({
      page: data.page,
      total_pages: data.total_pages,
      results: resultsWithPoster,
      type: mediaType,
      genreId,
    });
  } catch (error) {
    console.error("[api/genre] Error fetching genre items", error);
    return NextResponse.json(
      { error: "Failed to fetch genre items" },
      { status: 500 },
    );
  }
}
