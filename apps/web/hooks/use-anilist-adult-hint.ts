"use client";

import { useEffect } from "react";

import { requiresAdultAniListContent } from "@/lib/anilist";
import { useEpisodeStore } from "@/lib/stores/episode-store";

type AniListAdultHintResponse = {
  data?: {
    Media?: {
      isAdult?: boolean | null;
      genres?: string[] | null;
    };
  };
};

/**
 * TMDB detail pages often omit the adult flag for hentai OVAs. When we already
 * know the AniList id, ask AniList so adult provider gating is correct before
 * episode coords resolve.
 */
export function useAnilistAdultHint(
  anilistId: number | null | undefined,
  tmdbMarkedAdult: boolean,
  mediaType?: "tv" | "movie",
) {
  const setDefaultAnilistId = useEpisodeStore(
    (state) => state.setDefaultAnilistId,
  );

  useEffect(() => {
    if (
      mediaType !== "tv" ||
      tmdbMarkedAdult ||
      typeof anilistId !== "number" ||
      !Number.isInteger(anilistId) ||
      anilistId <= 0
    ) {
      return;
    }

    let cancelled = false;

    void fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { isAdult genres } }`,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as AniListAdultHintResponse;
      })
      .then((payload) => {
        if (cancelled || !payload?.data?.Media) {
          return;
        }

        const media = payload.data.Media;
        const genres = (media.genres ?? []).filter(
          (genre): genre is string =>
            typeof genre === "string" && genre.length > 0,
        );
        const isAdult =
          media.isAdult === true || requiresAdultAniListContent(genres);

        if (isAdult) {
          setDefaultAnilistId(anilistId, true);
        }
      })
      .catch(() => {
        void 0;
      });

    return () => {
      cancelled = true;
    };
  }, [anilistId, mediaType, setDefaultAnilistId, tmdbMarkedAdult]);
}
