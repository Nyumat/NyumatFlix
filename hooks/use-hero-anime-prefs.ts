"use client";

import { useLayoutEffect } from "react";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";

export function useHeroAnimePrefs(
  anilistId: number | null | undefined,
  mediaType?: "tv" | "movie",
) {
  const setDefaultAnilistId = useEpisodeStore(
    (state) => state.setDefaultAnilistId,
  );
  const isAnime = typeof anilistId === "number";

  useLayoutEffect(() => {
    if (mediaType !== "tv") {
      setDefaultAnilistId(null);
      return;
    }

    setDefaultAnilistId(isAnime ? anilistId : null);
    useEmbedServerStore
      .getState()
      .setVidnestContentType(isAnime ? "anime" : "tv");

    return () => {
      setDefaultAnilistId(null);
    };
  }, [anilistId, isAnime, mediaType, setDefaultAnilistId]);
}
