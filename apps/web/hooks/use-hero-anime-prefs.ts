"use client";

import { useLayoutEffect } from "react";

import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { slugifyHentainiTitle } from "@/lib/scrape/anime/hentaini-slug";

export function useHeroAnimePrefs(
  anilistId: number | null | undefined,
  mediaType?: "tv" | "movie",
  isAdultAnime?: boolean,
  animeTitle?: string | null,
  playbackTmdbTvId?: number | null,
) {
  const setDefaultAnilistId = useEpisodeStore(
    (state) => state.setDefaultAnilistId,
  );
  const setPlaybackTmdbTvId = useEpisodeStore(
    (state) => state.setPlaybackTmdbTvId,
  );
  const isAnime = typeof anilistId === "number";

  useLayoutEffect(() => {
    if (mediaType !== "tv") {
      setDefaultAnilistId(null);
      setPlaybackTmdbTvId(null);
      useEmbedServerStore.getState().setAnimeTitleSlug("");
      return;
    }

    setDefaultAnilistId(isAnime ? anilistId : null, isAdultAnime === true);
    setPlaybackTmdbTvId(
      typeof playbackTmdbTvId === "number" && playbackTmdbTvId > 0
        ? playbackTmdbTvId
        : null,
    );
    useEmbedServerStore
      .getState()
      .setVidnestContentType(isAnime ? "anime" : "tv");
    useEmbedServerStore
      .getState()
      .setAnimeTitleSlug(
        isAnime && animeTitle?.trim() ? slugifyHentainiTitle(animeTitle) : "",
      );

    return () => {
      setDefaultAnilistId(null);
      setPlaybackTmdbTvId(null);
      useEmbedServerStore.getState().setAnimeTitleSlug("");
    };
  }, [
    anilistId,
    animeTitle,
    isAdultAnime,
    isAnime,
    mediaType,
    playbackTmdbTvId,
    setDefaultAnilistId,
    setPlaybackTmdbTvId,
  ]);
}
