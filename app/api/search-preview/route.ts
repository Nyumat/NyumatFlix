import { getGenreNames } from "@/components/content/genre-helpers";
import { mapMediaListToCanonicalCardsValue } from "@/lib/cards";
import {
  isPremieredTvByDate,
  isReleasedMovieByDate,
} from "@/lib/released-media";
import {
  Movie,
  TmdbResponse,
  TmdbResponseSchema,
  TvShow,
} from "@/utils/typings";
import { NextResponse } from "next/server";

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
    const result = TmdbResponseSchema.safeParse(rawData);
    const data: TmdbResponse<Movie | TvShow> = result.success
      ? result.data
      : rawData;
    const filteredResults =
      data.results
        ?.filter((item: Movie | TvShow) => {
          if (!item.poster_path) return false;
          if (item.media_type === "movie")
            return isReleasedMovieByDate(item.release_date);
          if (item.media_type === "tv")
            return isPremieredTvByDate(item.first_air_date);
          return false;
        })
        .slice(0, 8)
        .map((item: Movie | TvShow) => ({
          ...item,
          genres: item.genre_ids
            ? getGenreNames(
                item.genre_ids,
                item.media_type === "tv" ? "tv" : "movie",
              ).map((name, index) => ({
                id: item.genre_ids?.[index] ?? index,
                name,
              }))
            : undefined,
        })) || [];

    return NextResponse.json(
      { results: mapMediaListToCanonicalCardsValue(filteredResults) },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Error in search preview API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
