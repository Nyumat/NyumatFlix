"use client";

import { TV_DETAIL_LG_MEDIA_QUERY } from "@/lib/constants";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import { resolveTvShowDefaultTab } from "@/lib/tv-show-viewport-defaults";
import { useLayoutEffect } from "react";

type TvShowRootRedirectProps = {
  id: string;
  numberOfEpisodes: number;
};

export const TvShowRootRedirect = ({
  id,
  numberOfEpisodes,
}: TvShowRootRedirectProps) => {
  useLayoutEffect(() => {
    const mq = window.matchMedia(TV_DETAIL_LG_MEDIA_QUERY);
    const apply = () => {
      useMediaDetailTabStore
        .getState()
        .setMediaDetailTab(
          "tv",
          id,
          resolveTvShowDefaultTab(numberOfEpisodes, mq.matches),
        );
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [id, numberOfEpisodes]);

  return null;
};
