import { NextRequest, NextResponse } from "next/server";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get("tmdbId");
    const type = searchParams.get("type");
    const season = searchParams.get("season");
    const episode = searchParams.get("episode");

    if (!tmdbId || !type) {
      return NextResponse.json(
        { error: "Missing required parameters: tmdbId and type" },
        { status: 400 },
      );
    }

    if (type !== "movie" && type !== "tv") {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    const tmdbIdNum = parseInt(tmdbId);
    if (isNaN(tmdbIdNum)) {
      return NextResponse.json(
        { error: "Invalid tmdbId parameter. Must be a number" },
        { status: 400 },
      );
    }

    // First, get the IMDB ID from TMDB
    const externalIdsUrl =
      type === "movie"
        ? `https://api.themoviedb.org/3/movie/${tmdbIdNum}/external_ids?api_key=${process.env.TMDB_API_KEY}`
        : `https://api.themoviedb.org/3/tv/${tmdbIdNum}/external_ids?api_key=${process.env.TMDB_API_KEY}`;

    const externalIdsResponse = await fetch(externalIdsUrl);

    if (!externalIdsResponse.ok) {
      console.warn(
        `TMDB External IDs API returned ${externalIdsResponse.status} for TMDB ${tmdbIdNum}`,
      );
      return NextResponse.json({ available: false });
    }

    const externalIdsData = await externalIdsResponse.json();
    const imdbId = externalIdsData.imdb_id;

    if (!imdbId) {
      console.warn(`No IMDB ID found for TMDB ${tmdbIdNum}`);
      return NextResponse.json({ available: false });
    }

    // Now use the IMDB ID for FilmKu status check
    let filmkuUrl;
    if (type === "movie") {
      filmkuUrl = `https://filmku.stream/api/status?imdb=${imdbId}&type=movie`;
    } else if (season !== undefined && episode !== undefined) {
      // I noticed that for specific episodes, the FilmKu API uses type=movie for TV shows too.
      filmkuUrl = `https://filmku.stream/api/status?imdb=${imdbId}&sea=${season}&epi=${episode}&type=movie`;
    } else {
      filmkuUrl = `https://filmku.stream/api/status?imdb=${imdbId}&sea=1&epi=1&type=movie`;
    }

    const filmkuResponse = await fetch(filmkuUrl, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
    if (!filmkuResponse.ok) {
      console.warn(
        `FilmKu API returned ${filmkuResponse.status} for IMDB ${imdbId} (TMDB ${tmdbIdNum})`,
      );
      return NextResponse.json({ available: false });
    }

    const filmkuData = await filmkuResponse.json();
    const isAvailable =
      filmkuData &&
      (filmkuData.success === true ||
        filmkuData.available === true ||
        filmkuData.status === "available");

    return NextResponse.json({ available: isAvailable });
  } catch (error) {
    console.error(`Error checking FilmKu availability:`, error);
    return NextResponse.json({ available: false });
  }
}
