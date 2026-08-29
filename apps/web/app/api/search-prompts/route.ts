import { catalogCacheHeaders } from "@/lib/http-cache";
import { buildSearchPrompts } from "@/lib/search/search-prompts";
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const data = await buildSearchPrompts();
    return NextResponse.json(data, { headers: catalogCacheHeaders() });
  } catch (error) {
    console.error("Error in search prompts API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
