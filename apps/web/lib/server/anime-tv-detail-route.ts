import { resolveAnilistMovieTmdbRouteFromFribb } from "@/lib/anilist-movie-route";
import {
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnimeAnilistRouteId,
  isBareAnilistRouteId,
  parseAnimeAnilistRouteId,
  toAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import { resolveCanonicalAnilistRouteFromFribb } from "@/lib/anilist-tv-detail";
import { resolveTmdbShowToAnilistId } from "@/lib/anime/cross-id-resolver";
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

const redirectToMovie = (
  tmdbMovieId: number,
  searchParams: URLSearchParams,
  anilistId: number,
) => {
  const params = new URLSearchParams(searchParams);
  params.set("anilistId", String(anilistId));
  const query = params.toString();
  redirect(
    query ? `/movies/${tmdbMovieId}?${query}` : `/movies/${tmdbMovieId}`,
  );
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

  const canonicalSlug = toAnilistTvRouteSlug(entryAnilistId);
  const [mappedMovieId, canonical] = await Promise.all([
    resolveAnilistMovieTmdbRouteFromFribb(entryAnilistId),
    resolveCanonicalAnilistRouteFromFribb(canonicalSlug),
  ]);

  if (mappedMovieId) {
    redirectToMovie(mappedMovieId, requestSearchParams, entryAnilistId);
  }

  if (canonical) {
    const canonicalAnilistId = fromAnilistTvRouteId(canonical.slug);
    if (canonicalAnilistId !== entryAnilistId) {
      const canonicalHref = buildAnilistTvDetailHref(canonicalAnilistId, {
        season: canonical.season > 1 ? canonical.season : undefined,
      });
      redirect(appendSearchParams(canonicalHref, requestSearchParams));
    }
  } else if (isBareAnilistRouteId(id)) {
    const mappedAnilistId = await resolveTmdbShowToAnilistId(entryAnilistId);

    if (mappedAnilistId && mappedAnilistId !== entryAnilistId) {
      redirect(
        appendSearchParams(
          buildAnilistTvDetailHref(mappedAnilistId),
          requestSearchParams,
        ),
      );
    }
  }

  if (id !== canonicalSlug) {
    redirect(
      appendSearchParams(
        buildAnilistTvDetailHref(entryAnilistId),
        requestSearchParams,
      ),
    );
  }
}
