import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const tmdbId = searchParams.get("tmdbId");

    if (!type || (type !== "movie" && type !== "tv")) {
      return NextResponse.json(
        { error: "Invalid type parameter. Must be 'movie' or 'tv'" },
        { status: 400 },
      );
    }

    // If tmdbId is provided, check for specific availability
    if (tmdbId) {
      const tmdbIdNum = parseInt(tmdbId);
      if (isNaN(tmdbIdNum)) {
        return NextResponse.json(
          { error: "Invalid tmdbId parameter. Must be a number" },
          { status: 400 },
        );
      }

      const response = await fetch(`https://embed.su/list/${type}.json`);

      if (!response.ok) {
        console.warn(`Embed.su API returned ${response.status} for ${type}`);
        return NextResponse.json({ available: false });
      }

      const data = await response.json();

      // Check if there's an object with the matching TMDB ID
      if (Array.isArray(data)) {
        const isAvailable = data.some(
          (item) => item && typeof item === "object" && item.tmdb === tmdbIdNum,
        );

        return NextResponse.json({ available: isAvailable });
      }

      return NextResponse.json({ available: false });
    }

    // If no tmdbId provided, return all available TMDB IDs (for bulk checking)
    const response = await fetch(`https://embed.su/list/${type}.json`);

    if (!response.ok) {
      console.warn(`Embed.su API returned ${response.status} for ${type}`);
      return NextResponse.json(
        { error: `Embed.su API returned ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();

    // The API returns an array of objects with tmdb, imdb, and title properties
    // Extract the tmdb IDs from the objects
    if (Array.isArray(data)) {
      const tmdbIds = data
        .filter((item) => item && typeof item === "object" && item.tmdb)
        .map((item) => item.tmdb);

      return NextResponse.json(tmdbIds);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error(
      `Error checking ${request.nextUrl.searchParams.get("type")} availability for Embed.su:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
