"use client";

import { WatchlistItem } from "@/lib/domain/watchlist";
import { DETAIL_CONTENT_CONTAINER_CLASS } from "@/components/layout/page-loading/detail-page-loading";
import { MediaDetailLayout } from "@/components/media/media-server";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import {
  resolveAnilistIdFromTvRoute,
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
} from "@/lib/anilist-route-id";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
import { useDetailRouteStore } from "@/lib/stores/detail-route-store";
import { TvShowDetails } from "@/lib/domain/typings";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type TvShowDetailShellProps = {
  details: TvShowDetails | MediaAboveFoldDetail;
  tvId: string;
  anilistId: number | null | undefined;
  children: React.ReactNode;
};

export const TvShowDetailShell = ({
  details,
  tvId,
  anilistId,
  children,
}: TvShowDetailShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setDetailRouteMetadata = useDetailRouteStore(
    (state) => state.setDetailRouteMetadata,
  );
  const clearDetailRouteMetadata = useDetailRouteStore(
    (state) => state.clearDetailRouteMetadata,
  );
  const queryAnilistId = Number.parseInt(
    searchParams.get("anilistId") ?? "",
    10,
  );
  const resolvedAnilistId = resolveAnilistIdFromTvRoute(
    tvId,
    Number.isInteger(queryAnilistId) ? queryAnilistId : anilistId,
  );
  const isAnime = Number.isInteger(resolvedAnilistId);
  const { watchlistItem, isLoading } = useWatchlistItem(
    parseInt(tvId, 10),
    "tv",
  );

  const passedWatchlistItem: WatchlistItem | null = isLoading
    ? null
    : watchlistItem;

  useEffect(() => {
    setDetailRouteMetadata({
      pathname,
      parentRoute: isAnime ? "/anime" : "/tvshows",
    });

    return () => clearDetailRouteMetadata(pathname);
  }, [clearDetailRouteMetadata, isAnime, pathname, setDetailRouteMetadata]);

  useEffect(() => {
    if (!isAnilistTvRouteId(tvId)) return;

    const routeAnilistId = fromAnilistTvRouteId(tvId);
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

    const canonicalHref = buildAnilistTvDetailHref(franchiseRootId, {
      season: entrySeason,
    });

    if (
      `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}` !==
      canonicalHref
    ) {
      router.replace(canonicalHref);
    }
  }, [details, pathname, router, searchParams, tvId]);

  return (
    <>
      <MediaDetailLayout
        media={[
          {
            ...details,
            title: details.name,
            // Above-fold stores a video array; full details use `{ results }`.
            videos: extractVideoRowsFromMediaVideos(details.videos),
          },
        ]}
        mediaType="tv"
        anilistId={resolvedAnilistId}
        watchlistItem={passedWatchlistItem}
        initialSeasonNumber={watchlistItem?.lastWatchedSeason || null}
        contentContainerClassName={DETAIL_CONTENT_CONTAINER_CLASS}
      >
        <div className="mt-4">{children}</div>
      </MediaDetailLayout>
    </>
  );
};
