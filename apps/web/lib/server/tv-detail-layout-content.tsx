import {
  DetailRouteSearchParamsBoundary,
  type DetailRouteSearchParams,
} from "@/components/detail/detail-route-search-params-boundary";
import { TvShowDetailShell } from "@/components/tvshow/tvshow-detail-shell";
import {
  buildAnilistTvDetailHref,
  isAnilistTvRouteId,
  isAnimeAnilistRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { resolveTmdbShowToAnilistId } from "@/lib/anime/cross-id-resolver";
import { hydrateTvShowDetailQueries } from "@/lib/server/hydrate-tv-show-detail-queries";
import { applyCatalogHourCacheLife } from "@/lib/server/route-cache-life";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import { getCachedTvShowDetail } from "@/lib/media-detail-cache";
import {
  applyHeroBackdropOverride,
  getHeroBackdropOverrides,
} from "@/lib/flags/hero-backdrop-overrides-server";
import { fromMalAnimeRouteId, isMalAnimeRouteId } from "@/lib/mal/route-id";
import type { TvShowDetails } from "@/lib/domain/typings";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

type TvDetailLayoutContentProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
  routeNamespace?: "anime" | "tv";
};

type TvShowDetailSearchParamsLayerProps = {
  children: ReactNode;
  id: string;
  details: TvShowDetails;
  heroDetails: TvShowDetails;
  routeNamespace: "anime" | "tv";
  search: DetailRouteSearchParams;
};

const TvShowDetailSearchParamsLayer = async ({
  children,
  id,
  details,
  heroDetails,
  routeNamespace,
  search,
}: TvShowDetailSearchParamsLayerProps) => {
  const isAnilistBackedRoute =
    routeNamespace === "anime"
      ? isAnimeAnilistRouteId(id)
      : isAnilistTvRouteId(id);
  const queryAnilistId = search.anilistId;
  const requestedSeason = search.season;

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
    for (const [key, value] of search.searchParams.entries()) {
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
        details={heroDetails}
        tvId={id}
        anilistId={anilistId}
        routeCatalog={catalog}
        initialSeasonDetails={initialSeasonDetails}
      >
        {children}
      </TvShowDetailShell>
    </HydrationBoundary>
  );
};

type CachedTvShowDetailLayoutData = {
  details: TvShowDetails;
  heroDetails: TvShowDetails;
};

async function loadCachedTvShowDetailLayout(
  id: string,
  routeNamespace: "anime" | "tv",
): Promise<CachedTvShowDetailLayoutData> {
  "use cache";
  applyCatalogHourCacheLife();

  const details = (await getCachedTvShowDetail(id, {
    animeCatalog: routeNamespace === "anime",
  }).catch(() => null)) as TvShowDetails | null;

  if (!details) {
    notFound();
  }

  const overrides = await getHeroBackdropOverrides();
  const isAnilistBackedRoute =
    routeNamespace === "anime"
      ? isAnimeAnilistRouteId(id)
      : isAnilistTvRouteId(id);
  const isMalBackedRoute = routeNamespace === "anime" && isMalAnimeRouteId(id);
  const heroDetails = applyHeroBackdropOverride(details, overrides, {
    mediaType: routeNamespace === "anime" ? "anime" : "tv",
    tmdbId: isAnilistBackedRoute || isMalBackedRoute ? null : details.id,
    anilistId: isAnilistBackedRoute
      ? (parseAnimeAnilistRouteId(id) ?? details.id)
      : null,
    malId: isMalBackedRoute ? fromMalAnimeRouteId(id) : null,
  });

  return { details, heroDetails };
}

async function TvShowDetailLayoutBody({
  children,
  id,
  routeNamespace,
  search,
}: {
  children: ReactNode;
  id: string;
  routeNamespace: "anime" | "tv";
  search: DetailRouteSearchParams;
}) {
  const cached = await loadCachedTvShowDetailLayout(id, routeNamespace);

  return (
    <TvShowDetailSearchParamsLayer
      id={id}
      details={cached.details}
      heroDetails={cached.heroDetails}
      routeNamespace={routeNamespace}
      search={search}
    >
      {children}
    </TvShowDetailSearchParamsLayer>
  );
}

export async function TvShowDetailLayoutContent({
  children,
  params,
  routeNamespace = "tv",
}: TvDetailLayoutContentProps) {
  const { id } = await params;

  return (
    <DetailRouteSearchParamsBoundary>
      {(search) => (
        <TvShowDetailLayoutBody
          id={id}
          routeNamespace={routeNamespace}
          search={search}
        >
          {children}
        </TvShowDetailLayoutBody>
      )}
    </DetailRouteSearchParamsBoundary>
  );
}
