import { catalogCacheHeaders } from "@/lib/http-cache";
import { fetchCatalogShowcaseRows } from "@/lib/catalog-showcase-fetch";
import { slimMediaItemsForRsc } from "@/lib/cards/catalog-dto";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { NextResponse } from "next/server";

const MAX_EXCLUDE_IDS = 120;

const parsePageKey = (value: string | null) => {
  if (value === "movies" || value === "tv") return value;
  return null;
};

const parseExcludeIds = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((id) => Number.parseInt(id, 10))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, MAX_EXCLUDE_IDS);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageKey = parsePageKey(url.searchParams.get("pageKey"));

  if (!pageKey) {
    return NextResponse.json(
      { error: "Invalid catalog showcase pageKey" },
      { status: 400 },
    );
  }

  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  try {
    const rows = await fetchCatalogShowcaseRows(
      pageKey,
      TMDB_WATCH_REGION,
      parseExcludeIds(url.searchParams.get("excludeIds")),
    );

    return NextResponse.json(
      {
        rows: rows.map((row) => ({
          ...row,
          items: slimMediaItemsForRsc(row.items),
        })),
      },
      { headers: catalogCacheHeaders() },
    );
  } catch (error) {
    console.error("Error in catalog showcase API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
