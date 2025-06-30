export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { MovieDb } from "moviedb-promise";

const moviedb = new MovieDb(process.env.TMDB_API_KEY || "");

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const response = await moviedb.searchPerson({
      query,
      language: "en-US",
      include_adult: false,
      page: 1,
    });

    return NextResponse.json({ results: response.results || [] });
  } catch (error) {
    console.error("Error searching for people:", error);
    return NextResponse.json(
      { error: "Failed to fetch person data" },
      { status: 500 },
    );
  }
}
