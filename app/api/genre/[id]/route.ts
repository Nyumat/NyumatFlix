import {
  buildItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchTMDBData,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const genreId = params.id;
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  // Default to movie if no type provided or invalid value
  const mediaType = typeParam === "tv" ? "tv" : "movie";
  const pageParam = url.searchParams.get("page") || "1";
  const page = parseInt(pageParam, 10);

  try {
    const data = await fetchTMDBData<MediaItem>(
      `/discover/${mediaType}`,
      {
        with_genres: genreId,
        sort_by: "popularity.desc",
        language: "en-US",
        include_adult: "false",
        "vote_count.gte": "10", // Minimum vote count for quality
      },
      page,
    );

    const resultsWithPoster = (data.results || []).filter((item: MediaItem) =>
      Boolean(item.poster_path),
    );

    // Process with categories for consistent data structure
    const processedResults = await buildItemsWithCategories<MediaItem>(
      resultsWithPoster as MediaItem[],
      mediaType as "movie" | "tv",
    );

    // Enrich items with full details (runtime, logos, content ratings, etc.)
    const enrichedResults = await fetchAndEnrichMediaItems(
      processedResults,
      mediaType as "movie" | "tv",
    );

    return NextResponse.json({
      page: data.page,
      total_pages: data.total_pages,
      results: enrichedResults,
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
