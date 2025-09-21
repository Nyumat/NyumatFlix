export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

interface PersonResult {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("query");
    const page = searchParams.get("page") || "1";

    if (!query || query.length < 2) {
      return NextResponse.json({
        results: [],
        page: 1,
        total_pages: 0,
        total_results: 0,
      });
    }

    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TMDB API key is not configured" },
        { status: 500 },
      );
    }

    // use direct TMDB API call for better control
    const url = new URL("https://api.themoviedb.org/3/search/person");
    url.searchParams.append("api_key", apiKey);
    url.searchParams.append("query", query);
    url.searchParams.append("page", page);
    url.searchParams.append("include_adult", "false");
    url.searchParams.append("language", "en-US");

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`TMDB API error (person search): ${response.status}`);
      return NextResponse.json(
        { error: "Failed to fetch person data from TMDB" },
        { status: response.status },
      );
    }

    const data = await response.json();

    // ensure proper typing and sorting by popularity
    const results: PersonResult[] = (data.results || [])
      .filter((person: any) => person.id && person.name)
      .map((person: any) => ({
        id: person.id,
        name: person.name,
        profile_path: person.profile_path || null,
        popularity: person.popularity || 0,
        known_for_department: person.known_for_department || null,
      }))
      .sort(
        (a: PersonResult, b: PersonResult) =>
          (b.popularity || 0) - (a.popularity || 0),
      );

    return NextResponse.json({
      results,
      page: data.page || 1,
      total_pages: data.total_pages || 0,
      total_results: data.total_results || 0,
    });
  } catch (error) {
    console.error("Error searching for people:", error);
    return NextResponse.json(
      { error: "Failed to fetch person data" },
      { status: 500 },
    );
  }
}
