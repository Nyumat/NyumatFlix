"use client";

import { WatchlistItem } from "@/app/watchlist/actions";
import { MediaDetailLayout } from "@/components/media/media-server";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { useDetailRouteStore } from "@/lib/stores/detail-route-store";
import { TvShowDetails } from "@/utils/typings";
import { usePathname, useSearchParams } from "next/navigation";
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
  const resolvedAnilistId = Number.isInteger(queryAnilistId)
    ? queryAnilistId
    : anilistId;
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

  return (
    <>
      <MediaDetailLayout
        media={[
          {
            ...details,
            title: details.name,
            videos: details.videos?.results || [],
          },
        ]}
        mediaType="tv"
        anilistId={resolvedAnilistId}
        watchlistItem={passedWatchlistItem}
        initialSeasonNumber={watchlistItem?.lastWatchedSeason || null}
        contentContainerClassName="mx-auto px-4 relative z-10 max-w-7xl pt-4! sm:pt-6! lg:pt-8!"
      >
        <div className="mt-4">{children}</div>
      </MediaDetailLayout>
    </>
  );
};
