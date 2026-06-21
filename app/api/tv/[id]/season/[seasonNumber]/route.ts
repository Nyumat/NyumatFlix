import { seasonCacheHeaders } from "@/lib/http-cache";
import { fetchSeasonDetailsServer } from "@/lib/server/tvshow-api";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; seasonNumber: string }> },
) {
  const params = await props.params;
  try {
    const { id, seasonNumber } = params;

    const parsedSeasonNumber = Number.parseInt(seasonNumber, 10);
    if (!Number.isInteger(parsedSeasonNumber) || parsedSeasonNumber < 0) {
      return NextResponse.json(
        { error: "Invalid season number" },
        { status: 400 },
      );
    }

    const data = await fetchSeasonDetailsServer(id, parsedSeasonNumber);
    if (!data) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    return NextResponse.json(data, { headers: seasonCacheHeaders() });
  } catch (error) {
    console.error("Error fetching season details:", error);
    return NextResponse.json(
      { error: "Failed to fetch season details" },
      { status: 500 },
    );
  }
}
