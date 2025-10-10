import { Movie, TmdbResponse, TvShow } from "@/utils/typings";
import { NextResponse } from "next/server";

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  media_type: "person";
}

interface SearchResult {
  media: Array<Movie | TvShow>;
  people: Person[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const page = searchParams.get("page") || "1";
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
    const baseUrl = "https://api.themoviedb.org/3/search";
    const commonParams = new URLSearchParams({
      api_key: apiKey,
      query: query.trim(),
      page: page,
      include_adult: "false",
      language: "en-US",
    });

    // fetch both movies and tv shows in parallel
    const [movieResponse, tvResponse] = await Promise.all([
      fetch(`${baseUrl}/movie?${commonParams}`),
      fetch(`${baseUrl}/tv?${commonParams}`),
    ]);

    if (!movieResponse.ok || !tvResponse.ok) {
      console.error(
        `TMDB API error: Movies ${movieResponse.status}, TV ${tvResponse.status}`,
      );
      return NextResponse.json(
        { error: "Failed to fetch search results from TMDB" },
        { status: movieResponse.ok ? tvResponse.status : movieResponse.status },
      );
    }

    const [movieData, tvData] = await Promise.all([
      movieResponse.json() as Promise<TmdbResponse<Movie>>,
      tvResponse.json() as Promise<TmdbResponse<TvShow>>,
    ]);

    // combine and sort results by popularity
    const movies: Movie[] = (movieData.results || [])
      .filter((movie: Movie) => movie.poster_path) // filter out movies without poster
      .map((movie: Movie) => ({
        ...movie,
        media_type: "movie" as const,
      }));

    const tvShows: TvShow[] = (tvData.results || [])
      .filter((show: TvShow) => !show.genre_ids?.includes(10767)) // filter out talk shows
      .filter((show: TvShow) => show.poster_path) // filter out tv shows without poster
      .map((show: TvShow) => ({
        ...show,
        media_type: "tv" as const,
      }));

    // Filter out released movies with zero revenue, then combine and sort by popularity
    const { filterZeroRevenueMovies } = await import("@/utils/content-filters");
    const filteredMovies = filterZeroRevenueMovies(movies);
    const allMedia = [...filteredMovies, ...tvShows].sort((a, b) => {
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      return popB - popA;
    });

    // for people, we'll fetch from page 1 only to show in sidebar
    const people: Person[] = [];
    if (page === "1") {
      const peopleUrl = new URL(`${baseUrl}/person`);
      peopleUrl.searchParams.append("api_key", apiKey);
      peopleUrl.searchParams.append("query", query.trim());
      peopleUrl.searchParams.append("page", "1");
      peopleUrl.searchParams.append("include_adult", "false");

      try {
        const peopleResponse = await fetch(peopleUrl.toString());
        if (peopleResponse.ok) {
          const peopleData = await peopleResponse.json();
          if (Array.isArray(peopleData.results)) {
            peopleData.results.forEach((person: unknown) => {
              if (
                typeof person === "object" &&
                person !== null &&
                "id" in person &&
                "name" in person &&
                typeof person.id === "number" &&
                typeof person.name === "string"
              ) {
                const p = person as {
                  id: number;
                  name: string;
                  profile_path?: string | null;
                  popularity?: number;
                };
                people.push({
                  id: p.id,
                  name: p.name,
                  profile_path: p.profile_path || null,
                  popularity: p.popularity || 0,
                  media_type: "person",
                });
              }
            });
          }
        }
      } catch (error) {
        console.error("Error fetching people:", error);
        // continue without people results
      }
    }

    // calculate total pages (use the max of movie and tv pages)
    const totalPages = Math.max(
      movieData.total_pages || 1,
      tvData.total_pages || 1,
    );
    const totalResults =
      (movieData.total_results || 0) + (tvData.total_results || 0);

    // return structured response
    const result: SearchResult = {
      media: allMedia,
      people: people.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)),
      page: parseInt(page),
      totalPages,
      totalResults,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in main search API route:", error);
    return NextResponse.json(
      { error: "Internal server error during search" },
      { status: 500 },
    );
  }
}
