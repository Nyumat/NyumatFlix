import type { MappingConfidence } from "@/lib/anime/tmdb-anilist-map";

import {
  type AnimeCoordsStatus,
  shouldHoldAnimePlaybackStart,
} from "@/lib/anime/anime-playback-policy";

export type { AnimeCoordsStatus };

export type ScrapeStartGateInput = {
  defaultAnilistId: number | null;
  hasSelectedEpisode: boolean;
  animeCoordsStatus: AnimeCoordsStatus;
  mappingConfidence: MappingConfidence | null;
  isDirectMode: boolean;
  isAnimeScrapeActive: boolean;
  animeCoordsReady?: boolean;
  animeFirst?: boolean;
};

/** @deprecated Use shouldHoldAnimePlaybackStart from anime-playback-policy. */
export const shouldHoldScrapeForAnimeCoords = (
  input: ScrapeStartGateInput,
): boolean => {
  const animeCoordsReady =
    input.animeCoordsReady ??
    (input.isAnimeScrapeActive || input.mappingConfidence === "high");

  return shouldHoldAnimePlaybackStart({
    animeFirst: input.animeFirst ?? Boolean(input.defaultAnilistId),
    hasSelectedEpisode: input.hasSelectedEpisode,
    animeCoordsReady,
    animeCoordsStatus: input.animeCoordsStatus,
  });
};

export type ScrapeSessionKind = "direct" | "anime" | "tmdb";

export const scrapeSessionKeyFor = (
  kind: ScrapeSessionKind,
  mediaKey: string,
): string => `${kind}:${mediaKey}`;
