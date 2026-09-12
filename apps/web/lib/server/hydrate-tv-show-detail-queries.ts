import "server-only";

import {
  isAnilistBackedTvRouteId,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import { getTvSeasonForQuery } from "@/lib/server/media-detail-tab-data";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { resolveInitialTvSeasonNumber } from "@/lib/resolve-initial-tv-season";
import { queryKeys } from "@/lib/query-keys";
import type { SeasonDetails, TvShowDetails } from "@/lib/domain/typings";
import type { QueryClient } from "@tanstack/react-query";

function isFullTvDetails(
  details: TvShowDetails | MediaAboveFoldDetail,
): details is TvShowDetails {
  return "name" in details && typeof details.name === "string";
}

export async function hydrateTvShowDetailQueries(
  queryClient: QueryClient,
  id: string,
  details: TvShowDetails | MediaAboveFoldDetail,
  catalog: TvDetailCatalog = "tvshows",
  options?: { initialSeasonNumber?: number },
): Promise<Record<number, SeasonDetails>> {
  queryClient.setQueryData(queryKeys.mediaAboveFold("tv", id), details);

  if (!isFullTvDetails(details)) {
    return {};
  }

  if (isAnilistBackedTvRouteId(id, catalog)) {
    queryClient.setQueryData(queryKeys.tvDetailsRoute(id), details);
  } else {
    const numId = Number.parseInt(id, 10);
    if (!Number.isNaN(numId)) {
      queryClient.setQueryData(queryKeys.tvDetails(numId), details);
    }
  }

  const seasonNumber =
    options?.initialSeasonNumber ?? resolveInitialTvSeasonNumber(details);
  const seasonDetail = await getTvSeasonForQuery(id, seasonNumber, catalog);
  if (!seasonDetail) {
    return {};
  }

  queryClient.setQueryData(
    queryKeys.tvSeasonRoute(id, seasonNumber),
    seasonDetail,
  );

  return { [seasonNumber]: seasonDetail };
}
