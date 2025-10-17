import {
  buildItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchTMDBData,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ country: string }> },
) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const mediaType = searchParams.get("type") || "movie";
    const sortBy = searchParams.get("sortBy") || "popularity.desc";

    // Validate mediaType
    if (mediaType !== "movie" && mediaType !== "tv") {
      return NextResponse.json(
        { error: "Invalid media type. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    const countryCode = params.country;

    // Build query parameters based on media type and sort
    const queryParams: Record<string, string> = {
      language: "en-US",
      include_adult: "false",
      sort_by: sortBy,
      page: page.toString(),
    };

    // Add country filtering
    if (mediaType === "movie") {
      queryParams.region = countryCode;
      // For movies, we can also use production companies for better results
      if (countryCode === "US") {
        queryParams.with_origin_country = "US";
      }
    } else {
      // For TV shows, use origin country
      queryParams.with_origin_country = countryCode;
    }

    // Add quality filters
    queryParams["vote_count.gte"] = "10"; // Minimum vote count
    if (sortBy.includes("rating")) {
      queryParams["vote_average.gte"] = "6.0"; // Minimum rating for rating sorts
    }

    const data = await fetchTMDBData<MediaItem>(
      `/discover/${mediaType}`,
      queryParams,
      page,
    );

    // Filter results to only include items with posters
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
      total_results: data.total_results,
      results: enrichedResults,
      type: mediaType,
      countryCode,
      sortBy,
    });
  } catch (error) {
    console.error("[api/country] Error fetching country content", error);
    return NextResponse.json(
      { error: "Failed to fetch country content" },
      { status: 500 },
    );
  }
}
