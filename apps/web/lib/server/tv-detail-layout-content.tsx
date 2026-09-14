import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import { getDetailRouteSearchParams } from "@/lib/detail-search-params";
import {
  buildAnilistTvDetailHref,
  isAnilistTvRouteId,
  isAnimeAnilistRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { resolveTmdbShowToAnilistId } from "@/lib/anime/cross-id-resolver";
import { hydrateTvShowDetailQueries } from "@/lib/server/hydrate-tv-show-detail-queries";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import type { TvShowDetails } from "@/lib/domain/typings";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";

type TvDetailLayoutContentProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
  routeNamespace?: "anime" | "tv";
};

const parsePositiveInt = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function TvShowDetailLayoutContent({
  children,
  params,
  routeNamespace = "tv",
}: TvDetailLayoutContentProps) {
  const { id } = await params;

  const isAnilistBackedRoute =
    routeNamespace === "anime"
      ? isAnimeAnilistRouteId(id)
      : isAnilistTvRouteId(id);

  // Detail pages trust the link-time namespace: cards navigate directly to
  // the canonical `/anime/anilist-*` URL, so the hot path needs only the
  // detail fetch + search params. Anime mapping stays a cold-path safety net
  // (stale links, `/anime/tmdb-*`) — never a TTFB blocker.
  const [detailsResult, requestSearchParams] = await Promise.all([
    getCachedTvShowDetail(id, {
      animeCatalog: routeNamespace === "anime",
    }).catch(() => null) as Promise<TvShowDetails | null>,
    getDetailRouteSearchParams(),
  ]);
  const details = detailsResult;

  if (!details) {
    notFound();
  }
  const queryAnilistId = parsePositiveInt(requestSearchParams.get("anilistId"));
  const requestedSeason = parsePositiveInt(requestSearchParams.get("season"));

  // Cold-path safety net only: canonical links already carry the AniList id,
  // so skip mapping I/O when the route is AniList-backed or the caller pinned
  // `?anilistId=`. Live AniList search is gone from this path — unmapped
  // titles stay on the TMDB experience instead of blocking TTFB.
  const needsMapping = !isAnilistBackedRoute && queryAnilistId === null;
  const mappedAnilistId = isAnilistBackedRoute
    ? (parseAnimeAnilistRouteId(id) ?? details.id)
    : needsMapping
      ? await resolveTmdbShowToAnilistId(details.id, requestedSeason)
      : null;
  const autoResolvedAnilistId = isAnilistBackedRoute ? null : mappedAnilistId;
  const anilistId = isAnilistBackedRoute
    ? (parseAnimeAnilistRouteId(id) ?? details.id)
    : (queryAnilistId ?? autoResolvedAnilistId);

  // TMDB TV pages that resolve to a known anime canonicalize to `/anime/[id]`
  // so playback, episode mapping, and the anime UI shell all use AniList data.
  // Skip when the caller explicitly pinned `?anilistId=` — that's an opt-out
  // used for shows that intentionally stay on the TMDB experience.
  if (
    routeNamespace === "tv" &&
    queryAnilistId === null &&
    Number.isInteger(autoResolvedAnilistId) &&
    (autoResolvedAnilistId as number) > 0
  ) {
    const canonicalHref = buildAnilistTvDetailHref(
      autoResolvedAnilistId as number,
      { season: requestedSeason ?? undefined },
    );
    const [path, query = ""] = canonicalHref.split("?");
    const mergedParams = new URLSearchParams(query);
    for (const [key, value] of requestSearchParams.entries()) {
      if (key !== "season" && !mergedParams.has(key)) {
        mergedParams.set(key, value);
      }
    }
    const mergedQuery = mergedParams.toString();
    redirect(mergedQuery ? `${path}?${mergedQuery}` : path);
  }

  const catalog: TvDetailCatalog =
    routeNamespace === "anime" ? "anime" : "tvshows";
  const initialSeasonNumber =
    requestedSeason ??
    details.seasons?.find((season) => season.season_number > 0)
      ?.season_number ??
    1;

  const queryClient = new QueryClient();
  const initialSeasonDetails = await hydrateTvShowDetailQueries(
    queryClient,
    id,
    details,
    catalog,
    { initialSeasonNumber },
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TvShowDetailShell
        details={details}
        tvId={id}
        anilistId={anilistId}
        routeCatalog={catalog}
        initialSeasonDetails={initialSeasonDetails}
      >
        {children}
      </TvShowDetailShell>
    </HydrationBoundary>
  );
}
