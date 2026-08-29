import {
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
  isAnimeAnilistRouteId,
  normalizeAnilistTvRouteSlug,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { resolveAnilistMovieTmdbRoute } from "@/lib/anilist-movie-route";
import { resolveCanonicalAnilistRoute } from "@/lib/anilist-tv-detail";
import { getAnilistIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const appendSearchParams = (
  href: string,
  searchParams: URLSearchParams,
): string => {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of searchParams.entries()) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }
  const mergedQuery = params.toString();
  return mergedQuery ? `${path}?${mergedQuery}` : path;
};

const toCanonicalLookupRouteId = (id: string): string => {
  if (isAnilistTvRouteId(id)) {
    return normalizeAnilistTvRouteSlug(id);
  }

  return id;
};

export async function resolveAnilistTvDetailRedirects(
  id: string,
): Promise<void> {
  if (!isAnimeAnilistRouteId(id)) {
    return;
  }

  const requestSearchParams = new URLSearchParams(
    (await headers()).get("x-search-params") ?? "",
  );
  const entryAnilistId = parseAnimeAnilistRouteId(id);
  if (!entryAnilistId) {
    return;
  }

  const mappedMovieId = await resolveAnilistMovieTmdbRoute(entryAnilistId);
  if (mappedMovieId) {
    const params = new URLSearchParams(requestSearchParams);
    params.set("anilistId", String(entryAnilistId));
    const query = params.toString();
    redirect(
      query ? `/movies/${mappedMovieId}?${query}` : `/movies/${mappedMovieId}`,
    );
  }

  if (isAnilistTvRouteId(id)) {
    redirect(
      appendSearchParams(
        buildAnilistTvDetailHref(entryAnilistId),
        requestSearchParams,
      ),
    );
  }

  const canonical = await resolveCanonicalAnilistRoute(
    toCanonicalLookupRouteId(id),
    { acceptBareNumeric: true },
  );
  if (!canonical) {
    // If AniList does not have this bare ID directly, check if it is a TMDB ID that maps to AniList
    const mappedAnilistId =
      (await getAnilistIdFromFribb(entryAnilistId, "tv")) ??
      (await resolveTmdbToAnilistFromMappings(entryAnilistId, "tv")) ??
      (await getAnilistIdFromFribb(entryAnilistId, "movie")) ??
      (await resolveTmdbToAnilistFromMappings(entryAnilistId, "movie"));

    if (mappedAnilistId && mappedAnilistId !== entryAnilistId) {
      redirect(
        appendSearchParams(
          buildAnilistTvDetailHref(mappedAnilistId),
          requestSearchParams,
        ),
      );
    }

    return;
  }

  const canonicalAnilistId = fromAnilistTvRouteId(canonical.slug);
  if (canonicalAnilistId === entryAnilistId) {
    return;
  }

  const canonicalHref = buildAnilistTvDetailHref(canonicalAnilistId, {
    season: canonical.season > 1 ? canonical.season : undefined,
  });
  redirect(appendSearchParams(canonicalHref, requestSearchParams));
}
