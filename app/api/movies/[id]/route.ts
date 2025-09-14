import { movieDb } from "@/lib/constants";
import { NextResponse } from "next/server";

export async function GET({ params }: { params: { id: string } }) {
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Movie ID is required" },
      { status: 400 },
    );
  }

  try {
    const movieDetails = await movieDb.movieInfo({ id });

    if (!movieDetails) {
      return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    }

    return NextResponse.json(movieDetails);
  } catch (error) {
    console.error(`Error fetching movie details for ID ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch movie details" },
      { status: 500 },
    );
  }
}
