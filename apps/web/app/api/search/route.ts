import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import {
  mapMediaListToCanonicalCardsValue,
  mapPersonToCanonicalCardValue,
} from "@/lib/cards/mappers";
import {
  CanonicalMediaCard,
  CanonicalPersonCard,
  Movie,
  TmdbResponse,
  TvShow,
} from "@/lib/domain/typings";
import {
  CACHE_REVALIDATE_SECONDS,
  catalogCacheHeaders,
} from "@/lib/http-cache";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import { fetchAniListSearchMedia } from "@/lib/search/anilist-search";
import { mergeSearchMediaResults } from "@/lib/search/merge-search-media";
import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { NextResponse } from "next/server";

interface Person {
  id: number;
  name: string;
  profile_path?: string | null;
  popularity?: number;
  media_type: "person";
}

interface SearchResult {
  media: CanonicalMediaCard[];
  people: CanonicalPersonCard[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export async function GET(request: Request) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

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

    const searchParams = { query: query.trim(), page };
    const tmdbInit = (endpoint: string) =>
      tmdbFetchInit({
        endpoint,
        params: searchParams,
        revalidate: CACHE_REVALIDATE_SECONDS,
      });

    const [movieResponse, tvResponse, anilistResults, peopleResponse] =
      await Promise.all([
        fetch(`${baseUrl}/movie?${commonParams}`, tmdbInit("/search/movie")),
        fetch(`${baseUrl}/tv?${commonParams}`, tmdbInit("/search/tv")),
        page === "1"
          ? fetchAniListSearchMedia(query.trim(), { page: 1, perPage: 20 })
          : Promise.resolve({
              items: [],
              page: 1,
              totalPages: 1,
              totalResults: 0,
            }),
        page === "1"
          ? fetch(
              `${baseUrl}/person?${commonParams}`,
              tmdbInit("/search/person"),
            ).catch(() => null)
          : Promise.resolve(null),
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

    const { filterZeroRevenueMovies } = await import(
      "@/lib/movie-revenue-filter"
    );
    const filteredMovies = filterZeroRevenueMovies(movies);
    const releasedMovies = filterReleasedMovies(filteredMovies);
    const releasedTv = filterReleasedTvShows(tvShows);
    const allMedia = [...releasedMovies, ...releasedTv].sort((a, b) => {
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      return popB - popA;
    });

    const people: Person[] = [];
    if (peopleResponse?.ok) {
      try {
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
      } catch (error) {
        console.error("Error parsing people search:", error);
      }
    }

    const totalPages = Math.max(
      movieData.total_pages || 1,
      tvData.total_pages || 1,
    );
    const totalResults =
      (movieData.total_results || 0) +
      (tvData.total_results || 0) +
      (page === "1" ? anilistResults.totalResults : 0);

    const result: SearchResult = {
      media: mergeSearchMediaResults(
        mapMediaListToCanonicalCardsValue(allMedia),
        anilistResults.items,
        { query: query.trim() },
      ),
      people: people
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .map((person) => mapPersonToCanonicalCardValue(person as never)),
      page: parseInt(page),
      totalPages,
      totalResults,
    };

    return NextResponse.json(result, { headers: catalogCacheHeaders() });
  } catch (error) {
    console.error("Error in main search API route:", error);
    return NextResponse.json(
      { error: "Internal server error during search" },
      { status: 500 },
    );
  }
}
