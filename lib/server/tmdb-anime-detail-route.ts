import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import {
  isTmdbAnimeRouteId,
  parseTmdbAnimeRouteId,
} from "@/lib/tmdb-anime-route-id";
import { getAnilistIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { fetchTVShowDetails } from "@/lib/server/tvshow-api";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

const parsePositiveInt = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function resolveTmdbAnimeDetailRedirects(
  routeId: string,
): Promise<void> {
  if (!isTmdbAnimeRouteId(routeId)) {
    return;
  }

  const parsed = parseTmdbAnimeRouteId(routeId);
  if (!parsed) {
    notFound();
  }

  const { tmdbId, mediaType } = parsed;

  const requestSearchParams = new URLSearchParams(
    (await headers()).get("x-search-params") ?? "",
  );
  const requestedSeason = parsePositiveInt(requestSearchParams.get("season"));
  const autoplay = requestSearchParams.get("autoplay") === "true";

  // 1. Try resolving to an AniList ID via direct Fribb TMDB lookup
  let anilistId = await getAnilistIdFromFribb(tmdbId, mediaType);

  // 2. If not found in Fribb direct list, check MAL cross-index
  if (!anilistId) {
    anilistId = await resolveTmdbToAnilistFromMappings(
      tmdbId,
      mediaType,
      requestedSeason ?? undefined,
    );
  }

  // 3. If still not found, fetch TMDB detail & search AniList via title/metadata match
  if (!anilistId) {
    try {
      const details =
        mediaType === "movie"
          ? await getCachedMovieDetail(String(tmdbId))
          : await fetchTVShowDetails(String(tmdbId));

      if (details) {
        anilistId = (await getAnilistIdForMedia(details)) ?? null;
      }
    } catch {
      // Ignore errors when TMDB lookup fails
    }
  }

  // If this resolved to an AniList anime ID, redirect to canonical /anime/[anilistId]
  if (anilistId) {
    const canonicalHref = buildAnilistTvDetailHref(anilistId, {
      season: requestedSeason ?? undefined,
    });
    const [path, query = ""] = canonicalHref.split("?");
    const params = new URLSearchParams(query);
    if (autoplay) {
      params.set("autoplay", "true");
    }
    for (const [key, value] of requestSearchParams.entries()) {
      if (key !== "season" && key !== "autoplay" && !params.has(key)) {
        params.set(key, value);
      }
    }
    const mergedQuery = params.toString();
    redirect(mergedQuery ? `${path}?${mergedQuery}` : path);
  }

  // If no AniList mapping could be found at all, redirect to the standard movie/tvshows route
  const targetPath =
    mediaType === "movie" ? `/movies/${tmdbId}` : `/tvshows/${tmdbId}`;
  const query = requestSearchParams.toString();
  redirect(query ? `${targetPath}?${query}` : targetPath);
}
