import { catalogCacheHeaders } from "@/lib/http-cache";
import { fetchCatalogShowcaseRows } from "@/lib/catalog-showcase-fetch";
import { fetchAnimeShowcaseRows } from "@/lib/server/anime-showcase-fetch";
import { withCanonicalCatalogHrefs } from "@/lib/server/catalog-canonical-hrefs";
import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { NextResponse } from "next/server";

const MAX_EXCLUDE_IDS = 120;

const parsePageKey = (value: string | null) => {
  if (
    value === "movies" ||
    value === "tv" ||
    value === "anime-series" ||
    value === "anime-movie"
  ) {
    return value;
  }
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

  const isAnime = pageKey === "anime-series" || pageKey === "anime-movie";

  if (!isAnime && !process.env.TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  try {
    if (isAnime) {
      const rows = await fetchAnimeShowcaseRows(
        pageKey === "anime-movie" ? "movie" : "series",
      );
      return NextResponse.json({ rows }, { headers: catalogCacheHeaders() });
    }

    const enriched = await withCanonicalCatalogHrefs(
      await fetchCatalogShowcaseRows(
        pageKey,
        TMDB_WATCH_REGION,
        parseExcludeIds(url.searchParams.get("excludeIds")),
      ),
      pageKey === "movies" ? "movie" : "tv",
    );
    const rows = await Promise.all(
      enriched.map(async (row) => ({
        ...row,
        items: await prepareCatalogRowItemsForRsc(row.items),
      })),
    );

    return NextResponse.json({ rows }, { headers: catalogCacheHeaders() });
  } catch (error) {
    console.error("Error in catalog showcase API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
