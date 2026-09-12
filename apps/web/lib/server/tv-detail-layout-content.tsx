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
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
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

  let details: TvShowDetails | null = null;
  try {
    details = (await getCachedTvShowDetail(id, {
      animeCatalog: routeNamespace === "anime",
    })) as TvShowDetails | null;
  } catch {
    notFound();
  }

  if (!details) {
    notFound();
  }

  const requestSearchParams = await getDetailRouteSearchParams();
  const queryAnilistId = parsePositiveInt(requestSearchParams.get("anilistId"));
  const requestedSeason = parsePositiveInt(requestSearchParams.get("season"));

  const mappedAnilistId = isAnilistBackedRoute
    ? (parseAnimeAnilistRouteId(id) ?? details.id)
    : await resolveTmdbShowToAnilistId(details.id, requestedSeason);
  const autoResolvedAnilistId = isAnilistBackedRoute
    ? null
    : (mappedAnilistId ?? (await getAnilistIdForMedia(details)) ?? null);
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
