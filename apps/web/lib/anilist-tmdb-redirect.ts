import "server-only";

import type { FribbTmdbMapping } from "@/lib/fribb-mapping";

type BuildAnilistTmdbRedirectHrefInput = {
  mapping: FribbTmdbMapping;
  entryAnilistId: number;
  requestedSeason?: number | null;
  autoplay?: boolean;
};

/**
 * Prefer the caller's season query, then Fribb/ids.moe season, then omit.
 * Always carry `anilistId` so the TMDB layout can skip reverse lookup / title search.
 */
export const buildAnilistTmdbRedirectHref = ({
  mapping,
  entryAnilistId,
  requestedSeason,
  autoplay = false,
}: BuildAnilistTmdbRedirectHrefInput): string => {
  const params = new URLSearchParams();
  params.set("anilistId", String(entryAnilistId));

  const season =
    typeof requestedSeason === "number" &&
    Number.isInteger(requestedSeason) &&
    requestedSeason > 1
      ? requestedSeason
      : mapping.season && mapping.season > 1
        ? mapping.season
        : null;

  if (season) {
    params.set("season", String(season));
  }

  if (autoplay) {
    params.set("autoplay", "true");
  }

  const query = params.toString();
  return `/tvshows/${mapping.id}${query ? `?${query}` : ""}`;
};
