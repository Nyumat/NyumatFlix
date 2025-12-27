export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

interface KnownForItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: string;
}

interface PersonResult {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string | null;
  known_for?: KnownForItem[];
}

interface TmdbPersonSearchResult {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  known_for_department?: string;
  adult?: boolean;
  gender?: number;
  known_for?: Array<{
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    media_type: string;
    genre_ids: number[];
    popularity: number;
    vote_average: number;
    vote_count: number;
    first_air_date?: string;
    release_date?: string;
    adult?: boolean;
    video?: boolean;
    original_language: string;
    overview: string;
  }>;
}

interface TmdbPersonSearchResponse {
  page: number;
  results: TmdbPersonSearchResult[];
  total_pages: number;
  total_results: number;
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

    const data: TmdbPersonSearchResponse = await response.json();

    // ensure proper typing and sorting by popularity
    const mappedResults: PersonResult[] = (data.results || [])
      .filter((person: TmdbPersonSearchResult) => person.id && person.name)
      .map((person: TmdbPersonSearchResult) => ({
        id: person.id,
        name: person.name,
        profile_path: person.profile_path || null,
        popularity: person.popularity || 0,
        known_for_department: person.known_for_department || null,
        known_for: (person.known_for || [])
          .filter((item) => item.poster_path)
          .slice(0, 10)
          .map((item) => ({
            id: item.id,
            title: item.title || item.name,
            name: item.name || item.title,
            poster_path: item.poster_path || null,
            media_type: item.media_type,
          })),
      }));

    const results: PersonResult[] = mappedResults
      .filter((person: PersonResult) => {
        const knownForCount = person.known_for?.length || 0;
        return knownForCount > 0;
      })
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
