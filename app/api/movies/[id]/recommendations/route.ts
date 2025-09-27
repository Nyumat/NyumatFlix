import { NextResponse } from "next/server";
import { movieDb } from "@/lib/constants";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const id = params.id;

  if (!id) {
    return NextResponse.json(
      { error: "Movie ID is required" },
      { status: 400 },
    );
  }

  try {
    const recommendations = await movieDb.movieRecommendations({ id });

    if (!recommendations || !recommendations.results) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error(`Error fetching movie recommendations for ID ${id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch movie recommendations", results: [] },
      { status: 500 },
    );
  }
}
