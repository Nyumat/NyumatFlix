import { fetchAllSeasonDetails } from "@/components/tvshow/tvshow-api";
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
        return NextResponse.json(detail, {
          headers: {
            "Cache-Control":
              "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      }
      case "details":
        return NextResponse.json(
          mediaType === "movie"
            ? await getCachedMovieDetail(id)
            : await getCachedTvShowDetail(id),
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
          return NextResponse.json({});
        }

        return NextResponse.json(
          await fetchAllSeasonDetails(id, details.seasons),
        );
      }
      case "credits":
        return NextResponse.json(await mediaApi.credits({ id }));
      case "images":
        return NextResponse.json(
          await mediaApi.images({ id, langs: "en,null" }),
        );
      case "videos":
        return NextResponse.json(await mediaApi.videos({ id }));
      case "reviews":
        return NextResponse.json(await mediaApi.reviews({ id, page }));
      case "recommendations":
        return NextResponse.json(await mediaApi.recommendations({ id, page }));
      case "similar":
        return NextResponse.json(await mediaApi.similar({ id, page }));
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
