import { fetchProviderCatalogShowcaseRows } from "@/lib/catalog-showcase-fetch";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { withCanonicalCatalogHrefs } from "@/lib/server/catalog-canonical-hrefs";
import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import { getProviderCatalog } from "@/lib/server/provider-catalog-data";
import {
  getProviderDiscoverQueryParams,
  getWatchProviderBrand,
} from "@/lib/watch-providers";
import { NextResponse } from "next/server";

const MAX_EXCLUDE_IDS = 120;

const parsePageKey = (value: string | null) => {
  if (value === "movies" || value === "tv") {
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

const parseProviderId = (value: string | null) => {
  const id = Number.parseInt(value ?? "", 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageKey = parsePageKey(url.searchParams.get("pageKey"));
  const providerId = parseProviderId(url.searchParams.get("providerId"));

  if (!pageKey || providerId === null) {
    return NextResponse.json(
      { error: "Invalid provider showcase query" },
      { status: 400 },
    );
  }

  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key is not configured" },
      { status: 500 },
    );
  }

  const provider = await getWatchProviderBrand(providerId);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  try {
    if (url.searchParams.get("scope") === "popular") {
      const mediaType = pageKey === "movies" ? "movie" : "tv";
      const catalog = await getProviderCatalog(provider, mediaType);
      return NextResponse.json(
        { items: catalog.items },
        { headers: catalogCacheHeaders() },
      );
    }

    const enriched = await withCanonicalCatalogHrefs(
      await fetchProviderCatalogShowcaseRows(
        pageKey,
        TMDB_WATCH_REGION,
        getProviderDiscoverQueryParams(provider),
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
    console.error("Error in provider showcase API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
