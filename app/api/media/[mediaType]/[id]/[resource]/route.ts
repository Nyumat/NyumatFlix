import { catalogCacheHeaders, seasonCacheHeaders } from "@/lib/http-cache";
import { fetchAllSeasonDetails } from "@/lib/server/tvshow-api";
import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import { getCachedMediaAboveFoldDetail } from "@/lib/media-above-fold-server";
import { tmdb } from "@/tmdb/api";
import { NextResponse } from "next/server";

type MediaType = "movie" | "tv";
type Resource =
  | "above-fold"
  | "details"
  | "all-seasons"
  | "credits"
  | "images"
  | "videos"
  | "reviews"
  | "recommendations"
  | "similar";

const mediaTypes = new Set<MediaType>(["movie", "tv"]);
const resources = new Set<Resource>([
  "above-fold",
  "details",
  "all-seasons",
  "credits",
  "images",
  "videos",
  "reviews",
  "recommendations",
  "similar",
]);

const jsonCached = (data: unknown, resource: Resource, init?: ResponseInit) =>
  NextResponse.json(data, {
    ...init,
    headers: {
      ...init?.headers,
      ...(resource === "all-seasons"
        ? seasonCacheHeaders()
        : catalogCacheHeaders()),
    },
  });

export async function GET(
  request: Request,
  props: {
    params: Promise<{ mediaType: string; id: string; resource: string }>;
  },
) {
  const { mediaType, id, resource } = await props.params;
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";

  if (!mediaTypes.has(mediaType as MediaType)) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json(
      { error: "Media ID is required" },
      { status: 400 },
    );
  }

  if (!resources.has(resource as Resource)) {
    return NextResponse.json(
      { error: "Invalid media resource" },
      { status: 400 },
    );
  }

  try {
    const mediaApi = mediaType === "movie" ? tmdb.movie : tmdb.tv;

    switch (resource as Resource) {
      case "above-fold": {
        const detail = await getCachedMediaAboveFoldDetail(
          mediaType as MediaType,
          id,
        );
        if (!detail) {
          return NextResponse.json(
            { error: "Media not found" },
            { status: 404 },
          );
        }
        return jsonCached(detail, "above-fold");
      }
      case "details":
        return jsonCached(
          mediaType === "movie"
            ? await getCachedMovieDetail(id)
            : await getCachedTvShowDetail(id),
          "details",
        );
      case "all-seasons": {
        if (mediaType !== "tv") {
          return NextResponse.json(
            { error: "All seasons is only available for TV shows" },
            { status: 400 },
          );
        }

        const details = await getCachedTvShowDetail(id);
        if (!details) {
          return jsonCached({}, "all-seasons");
        }

        return jsonCached(
          await fetchAllSeasonDetails(id, details.seasons),
          "all-seasons",
        );
      }
      case "credits":
        return jsonCached(await mediaApi.credits({ id }), "credits");
      case "images":
        return jsonCached(
          await mediaApi.images({ id, langs: "en,null" }),
          "images",
        );
      case "videos":
        return jsonCached(await mediaApi.videos({ id }), "videos");
      case "reviews":
        return jsonCached(await mediaApi.reviews({ id, page }), "reviews");
      case "recommendations":
        return jsonCached(
          await mediaApi.recommendations({ id, page }),
          "recommendations",
        );
      case "similar":
        return jsonCached(await mediaApi.similar({ id, page }), "similar");
    }
  } catch (error) {
    console.error(
      `Error fetching ${mediaType} ${resource} for ID ${id}:`,
      error,
    );
    return NextResponse.json(
      { error: `Failed to fetch ${resource}` },
      { status: 500 },
    );
  }
}
