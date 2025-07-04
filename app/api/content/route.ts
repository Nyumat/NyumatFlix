export const dynamic = "force-dynamic";

import {
  buildMaybeItemsWithCategories,
  fetchPaginatedCategory,
} from "@/app/actions";
import { MediaItem } from "@/utils/typings";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const type = url.searchParams.get("type") || "movie";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const filterUsOnly = url.searchParams.get("filterUsOnly") === "true";

    // Validate type
    if (type !== "movie" && type !== "tv") {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    // Fetch the data
    const results = await fetchPaginatedCategory(
      category,
      type as "movie" | "tv",
      page,
    );

    // Process with categories (this happens on the server)
    const withCategories = await buildMaybeItemsWithCategories<MediaItem>(
      results,
      type as "movie" | "tv",
    );

    // Apply filtering
    const filteredResults = withCategories.filter((item) => {
      // Filter out items without posters
      if (!item.poster_path) return false;

      // Filter for US or English content if needed
      if (
        filterUsOnly &&
        type === "tv" &&
        !(
          item.origin_country?.includes("US") || item.original_language === "en"
        )
      ) {
        return false;
      }

      return true;
    });

    // Return the processed results
    return NextResponse.json({
      results: filteredResults,
      page,
      category,
      type,
    });
  } catch (error) {
    console.error("Error in content API route:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 },
    );
  }
}
