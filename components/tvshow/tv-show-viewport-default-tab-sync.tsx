"use client";

import { pages } from "@/config";
import { TV_DETAIL_LG_MEDIA_QUERY } from "@/lib/constants";
import { LARGE_TV_SHOW_EPISODE_OVERVIEW_THRESHOLD } from "@/lib/constants";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

type TvShowViewportDefaultTabSyncProps = {
  tvId: string;
  numberOfEpisodes: number;
};

export const TvShowViewportDefaultTabSync = ({
  tvId,
  numberOfEpisodes,
}: TvShowViewportDefaultTabSyncProps) => {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const mq = window.matchMedia(TV_DETAIL_LG_MEDIA_QUERY);
    const basePath = `${pages.tv.root.link}/${tvId}`;
    const mobileTab = "seasons-episodes";
    const desktopTab =
      numberOfEpisodes > LARGE_TV_SHOW_EPISODE_OVERVIEW_THRESHOLD
        ? "overview"
        : "series-graph";

    const handleChange = () => {
      const isDesktop = mq.matches;
      if (pathname !== basePath) return;
      const currentTab = useMediaDetailTabStore
        .getState()
        .getMediaDetailTab("tv", tvId);
      if (!currentTab) return;
      if (isDesktop && currentTab === mobileTab) {
        useMediaDetailTabStore
          .getState()
          .setMediaDetailTab("tv", tvId, desktopTab);
        return;
      }
      if (!isDesktop && currentTab === desktopTab) {
        useMediaDetailTabStore
          .getState()
          .setMediaDetailTab("tv", tvId, mobileTab);
      }
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [tvId, numberOfEpisodes, pathname]);

  return null;
};
