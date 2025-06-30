import { TmdbResponse, Movie, TvShow } from "@/utils/typings";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const page = searchParams.get("page") || "1"; // Default to page 1 if not provided
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Search query cannot be empty" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(`https://api.themoviedb.org/3/search/multi`);
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("query", query.trim());
    url.searchParams.append("page", page);
    url.searchParams.append("include_adult", "false");

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(
        `TMDB API error (search): ${response.status} ${response.statusText}`,
      );
      const errorBody = await response.text();
      console.error(`TMDB error body (search): ${errorBody}`);
      return NextResponse.json(
        { error: "Failed to fetch search results from TMDB" },
        { status: response.status },
      );
    }

    const data: TmdbResponse<Movie | TvShow> = await response.json();

    // Return the original response
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in main search API route:", error);
    return NextResponse.json(
      { error: "Internal server error during search" },
      { status: 500 },
    );
  }
}
