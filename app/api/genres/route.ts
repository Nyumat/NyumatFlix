import { Genre } from "@/utils/typings";
import { NextResponse } from "next/server";

interface GenresResponse {
  genres: Genre[];
}

async function fetchGenresFromTMDB(
  mediaType: "movie" | "tv",
  apiKey: string,
): Promise<Genre[]> {
  const endpoint = `genre/${mediaType}/list`;
  const response = await fetch(
    `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}`,
  );
  if (!response.ok) {
    console.error(
      `TMDB API error (genres ${mediaType}): ${response.status} ${response.statusText}`,
    );
    // Consider throwing an error or returning a more specific error structure
    return []; // Return empty on error for simplicity here
  }
  const data: GenresResponse = await response.json();
  return data.genres || []; // Ensure an array is returned
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "movie" | "tv" | null;

  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const movieGenres = await fetchGenresFromTMDB("movie", apiKey);
    const tvGenres = await fetchGenresFromTMDB("tv", apiKey);

    // Return genres in the expected format for each media type
    if (type === "movie") {
      return NextResponse.json({ genres: movieGenres });
    } else if (type === "tv") {
      return NextResponse.json({ genres: tvGenres });
    }

    // Return a combined structure if no specific type requested
    const allGenres = [...movieGenres, ...tvGenres];
    const genresMap: { [key: number]: string } = {};

    allGenres.forEach((genre) => {
      if (genre && genre.id && genre.name) {
        genresMap[genre.id] = genre.name;
      }
    });

    return NextResponse.json(genresMap);
  } catch (error) {
    console.error("Error fetching genres:", error);
    return NextResponse.json(
      { error: "Internal server error fetching genres" },
      { status: 500 },
    );
  }
}
