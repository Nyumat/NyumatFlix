import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string; seasonNumber: string } },
) {
  try {
    const { id, seasonNumber } = params;

    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
      { next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch season details: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching season details:", error);
    return NextResponse.json(
      { error: "Failed to fetch season details" },
      { status: 500 },
    );
  }
}
