import {
  getCachedAnilistTvAboveFoldDetail,
  getCachedAnilistTvAllSeasons,
  getCachedAnilistTvCredits,
  getCachedAnilistTvRecommendations,
  getCachedAnilistTvShowDetail,
} from "@/lib/anilist-tv-detail";
import { isAnilistTvRouteId } from "@/lib/anilist-route-id";
import { catalogCacheHeaders, seasonCacheHeaders } from "@/lib/http-cache";
import { fetchAllSeasonDetails } from "@/lib/server/tvshow-api";
import {
  getCachedMovieDetail,
  getCachedTvShowDetail,
} from "@/lib/media-detail-cache";
import { getCachedMediaAboveFoldDetail } from "@/lib/media-above-fold-server";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
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
    const typedMediaType = mediaType as MediaType;
    const isAnilistTv = typedMediaType === "tv" && isAnilistTvRouteId(id);
    const mediaApi = typedMediaType === "movie" ? tmdb.movie : tmdb.tv;

    switch (resource as Resource) {
      case "above-fold": {
        const detail = isAnilistTv
          ? await getCachedAnilistTvAboveFoldDetail(id)
          : await getCachedMediaAboveFoldDetail(typedMediaType, id);
        if (!detail) {
          return NextResponse.json(
            { error: "Media not found" },
            { status: 404 },
          );
        }
        return jsonCached(detail, "above-fold");
      }
      case "details": {
        const details =
          typedMediaType === "movie"
            ? await getCachedMovieDetail(id)
            : isAnilistTv
              ? await getCachedAnilistTvShowDetail(id)
              : await getCachedTvShowDetail(id);
        if (!details) {
          return NextResponse.json(
            { error: "Media not found" },
            { status: 404 },
          );
        }
        return jsonCached(details, "details");
      }
      case "all-seasons": {
        if (typedMediaType !== "tv") {
          return NextResponse.json(
            { error: "All seasons is only available for TV shows" },
            { status: 400 },
          );
        }

        if (isAnilistTv) {
          return jsonCached(
            await getCachedAnilistTvAllSeasons(id),
            "all-seasons",
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
        return jsonCached(
          isAnilistTv
            ? await getCachedAnilistTvCredits(id)
            : await mediaApi.credits({ id }),
          "credits",
        );
      case "images":
        if (isAnilistTv) {
          return jsonCached(
            { backdrops: [], posters: [], logos: [] },
            "images",
          );
        }
        return jsonCached(
          await mediaApi.images({ id, langs: "en,null" }),
          "images",
        );
      case "videos":
        if (isAnilistTv) {
          const detail = await getCachedAnilistTvAboveFoldDetail(id);
          return jsonCached(
            { results: extractVideoRowsFromMediaVideos(detail?.videos) },
            "videos",
          );
        }
        return jsonCached(await mediaApi.videos({ id }), "videos");
      case "reviews":
        if (isAnilistTv) {
          return jsonCached(
            { page: 1, results: [], total_pages: 0, total_results: 0 },
            "reviews",
          );
        }
        return jsonCached(await mediaApi.reviews({ id, page }), "reviews");
      case "recommendations":
        return jsonCached(
          isAnilistTv
            ? await getCachedAnilistTvRecommendations(id)
            : await mediaApi.recommendations({ id, page }),
          "recommendations",
        );
      case "similar":
        if (isAnilistTv) {
          return jsonCached(
            { page: 1, results: [], total_pages: 0, total_results: 0 },
            "similar",
          );
        }
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
