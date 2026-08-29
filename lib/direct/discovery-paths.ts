import type { ProgressiveDirectStreamRequest } from "@/lib/direct/progressive-streams-request";

export function directDiscoveryEventPath(
  request: ProgressiveDirectStreamRequest,
): string {
  if (request.mediaType === "movie") {
    const query = request.fresh ? "?fresh=1" : "";
    return `/api/direct/movie/${request.tmdbId}/streams/stream${query}`;
  }
  const params = new URLSearchParams({
    season: String(request.season),
    episode: String(request.episode),
  });
  if (request.fresh) {
    params.set("fresh", "1");
  }
  return `/api/direct/tv/${request.tmdbId}/streams/stream?${params.toString()}`;
}

export function directDiscoveryJsonPath(
  mediaType: "movie" | "tv",
  tmdbId: number,
  extra?: {
    season?: number;
    episode?: number;
    fresh?: boolean;
    quick?: boolean;
  },
): string {
  if (mediaType === "movie") {
    const params = new URLSearchParams();
    if (extra?.fresh) {
      params.set("fresh", "1");
    }
    if (extra?.quick) {
      params.set("quick", "1");
    }
    const query = params.toString();
    return `/api/direct/movie/${tmdbId}/streams${query ? `?${query}` : ""}`;
  }
  const params = new URLSearchParams({
    season: String(extra?.season ?? 0),
    episode: String(extra?.episode ?? 0),
  });
  if (extra?.fresh) {
    params.set("fresh", "1");
  }
  if (extra?.quick) {
    params.set("quick", "1");
  }
  return `/api/direct/tv/${tmdbId}/streams?${params.toString()}`;
}
