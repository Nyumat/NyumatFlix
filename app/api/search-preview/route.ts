import {
  TmdbResponse,
  Movie,
  TvShow,
  TmdbResponseSchema,
} from "@/utils/typings";
import { NextResponse } from "next/server";

type PreviewResult = {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query.trim())}&page=1&include_adult=false`,
    );

    if (!response.ok) {
      console.error(
        `TMDB API error: ${response.status} ${response.statusText}`,
      );
      const errorBody = await response.text();
      console.error(`TMDB error body: ${errorBody}`);
      return NextResponse.json(
        { error: "Failed to fetch search preview from TMDB" },
        { status: response.status },
      );
    }

    const rawData = await response.json();

    // Validate with Zod
    const result = TmdbResponseSchema.safeParse(rawData);

    // Use validated data if successful, otherwise fall back to raw data
    const data: TmdbResponse<Movie | TvShow> = result.success
      ? result.data
      : rawData;

    const filteredResults: PreviewResult[] =
      data.results
        ?.filter(
          (item) =>
            item.poster_path &&
            (item.media_type === "movie" || item.media_type === "tv"),
        )
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          title: "title" in item ? item.title : undefined,
          name: "name" in item ? item.name : undefined,
          poster_path: item.poster_path,
          media_type: item.media_type,
        })) || [];

    return NextResponse.json({ results: filteredResults });
  } catch (error) {
    console.error("Error in search preview API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
