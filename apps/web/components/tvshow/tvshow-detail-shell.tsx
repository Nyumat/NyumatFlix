"use client";

import { WatchlistItem } from "@/lib/domain/watchlist";
import { DETAIL_CONTENT_CONTAINER_CLASS } from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { TvDetailBootstrapProvider } from "@/components/tvshow/tv-detail-bootstrap-context";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import { useTvDetailCatalog } from "@/hooks/use-tv-detail-catalog";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import {
  resolveAnilistIdFromTvRoute,
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { isAnilistBackedTvRouteId } from "@/lib/tv-detail-catalog";
import { stripSearchParam } from "@/lib/navigation/search-params";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
import { TvShowDetails } from "@/lib/domain/typings";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type TvShowDetailShellProps = {
  details: TvShowDetails | MediaAboveFoldDetail;
  tvId: string;
  anilistId: number | null | undefined;
  children: React.ReactNode;
  routeCatalog?: "anime" | "tvshows";
};

export const TvShowDetailShell = ({
  details,
  tvId,
  anilistId,
  children,
  routeCatalog,
}: TvShowDetailShellProps) => {
  const detectedCatalog = useTvDetailCatalog();
  const catalog = routeCatalog ?? detectedCatalog;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryAnilistId = Number.parseInt(
    searchParams.get("anilistId") ?? "",
    10,
  );
  const resolvedAnilistId =
    (catalog === "anime" ? parseAnimeAnilistRouteId(tvId) : null) ??
    resolveAnilistIdFromTvRoute(
      tvId,
      Number.isInteger(queryAnilistId) ? queryAnilistId : anilistId,
    );
  const { watchlistItem, isLoading } = useWatchlistItem(details.id, "tv");

  const passedWatchlistItem: WatchlistItem | null = isLoading
    ? null
    : watchlistItem;

  useEffect(() => {
    if (!isAnilistBackedTvRouteId(tvId, catalog)) return;

    const routeAnilistId =
      parseAnimeAnilistRouteId(tvId) ?? fromAnilistTvRouteId(tvId);
    const franchiseRootId = details.id;
    if (
      !Number.isInteger(franchiseRootId) ||
      franchiseRootId === routeAnilistId
    ) {
      return;
    }

    const entrySeason = (details as TvShowDetails).seasons?.find(
      (season) => season.id === routeAnilistId,
    )?.season_number;

    if (entrySeason) {
      useEpisodeStore.getState().setSeasonNumber(tvId, entrySeason);
    }

    const canonicalHref = buildAnilistTvDetailHref(franchiseRootId);
    const currentHref = stripSearchParam(pathname, searchParams, "season");

    if (currentHref !== canonicalHref) {
      router.replace(canonicalHref);
    }
  }, [catalog, details, pathname, router, searchParams, tvId]);

  return (
    <>
      <MediaDetailLayout
        media={[
          {
            ...details,
            title: details.name,
            videos: extractVideoRowsFromMediaVideos(details.videos),
          },
        ]}
        mediaType="tv"
        anilistId={resolvedAnilistId}
        watchlistItem={passedWatchlistItem}
        initialSeasonNumber={watchlistItem?.lastWatchedSeason || null}
        contentContainerClassName={DETAIL_CONTENT_CONTAINER_CLASS}
      >
        <div className="mt-4">
          <TvDetailBootstrapProvider
            tvId={tvId}
            catalog={catalog}
            details={details as TvShowDetails}
          >
            {children}
          </TvDetailBootstrapProvider>
        </div>
      </MediaDetailLayout>
    </>
  );
};
