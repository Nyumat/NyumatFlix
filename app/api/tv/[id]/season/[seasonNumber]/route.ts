import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; seasonNumber: string }> },
) {
  const params = await props.params;
  try {
    const { id, seasonNumber } = params;

    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
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
