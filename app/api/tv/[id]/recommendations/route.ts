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
      { error: "TV show ID is required" },
      { status: 400 },
    );
  }

  try {
    const recommendations = await movieDb.tvRecommendations({ id });

    if (!recommendations || !recommendations.results) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error(
      `Error fetching TV show recommendations for ID ${id}:`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to fetch TV show recommendations", results: [] },
      { status: 500 },
    );
  }
}
