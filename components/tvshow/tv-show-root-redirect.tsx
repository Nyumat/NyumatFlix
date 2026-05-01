"use client";

import { TV_SHOW_DEFAULT_DETAIL_TAB } from "@/lib/tv-show-viewport-defaults";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import { useLayoutEffect } from "react";

type TvShowRootRedirectProps = {
  id: string;
};

export const TvShowRootRedirect = ({ id }: TvShowRootRedirectProps) => {
  useLayoutEffect(() => {
    useMediaDetailTabStore
      .getState()
      .setMediaDetailTab("tv", id, TV_SHOW_DEFAULT_DETAIL_TAB);
  }, [id]);

  return null;
};
