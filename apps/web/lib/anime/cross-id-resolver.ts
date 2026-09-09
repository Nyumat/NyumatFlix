import "server-only";

import {
  getAniBridgeMappings,
  resolveAniBridgeAnilistIdForTmdbShow,
  resolveAniBridgeTmdbShowIdForAnilist,
} from "@/lib/anime/anibridge-mappings";
import {
  overrideAnilistIdForTmdbShow,
  overrideMalIdForTmdbShow,
} from "@/lib/anime/mapping-overrides";
import { getAnilistIdFromFribb, getTmdbIdFromFribb } from "@/lib/fribb-mapping";
import { resolveTmdbToAnilistFromMappings } from "@/lib/mal/id-resolver";
import { fetchAnilistIdByMal } from "@/lib/scrape/anime/anilist-meta";

export const resolveTmdbShowToAnilistId = async (
  tmdbShowId: number,
  seasonNumber?: number | null,
): Promise<number | null> => {
  if (!Number.isInteger(tmdbShowId) || tmdbShowId <= 0) {
    return null;
  }

  const fromOverride = overrideAnilistIdForTmdbShow(tmdbShowId);
  if (fromOverride) return fromOverride;

  try {
    const mappings = await getAniBridgeMappings();
    const fromAniBridge = resolveAniBridgeAnilistIdForTmdbShow(
      mappings,
      tmdbShowId,
      seasonNumber,
    );
    if (fromAniBridge) return fromAniBridge;
  } catch {
    // keep walking the chain when the bundled/live graph is unavailable
  }

  const fromFribb = await getAnilistIdFromFribb(tmdbShowId, "tv");
  if (fromFribb) return fromFribb;

  const fromMalIndex = await resolveTmdbToAnilistFromMappings(
    tmdbShowId,
    "tv",
    seasonNumber ?? undefined,
  );
  if (fromMalIndex) return fromMalIndex;

  const malOverride = overrideMalIdForTmdbShow(tmdbShowId);
  if (malOverride) {
    const fromMalLive = await fetchAnilistIdByMal(malOverride);
    if (fromMalLive) return fromMalLive;
  }

  return null;
};

export const resolveTmdbMediaToAnilistId = async (
  tmdbId: number,
  mediaType: "movie" | "tv",
  seasonNumber?: number | null,
): Promise<number | null> => {
  if (mediaType === "tv") {
    return resolveTmdbShowToAnilistId(tmdbId, seasonNumber);
  }

  const fromFribb = await getAnilistIdFromFribb(tmdbId, "movie");
  if (fromFribb) return fromFribb;

  return resolveTmdbToAnilistFromMappings(
    tmdbId,
    "movie",
    seasonNumber ?? undefined,
  );
};

export const resolveAnilistToTmdbShow = async (
  anilistId: number,
): Promise<{ tmdbShowId: number; seasonNumber: number | null } | null> => {
  if (!Number.isInteger(anilistId) || anilistId <= 0) {
    return null;
  }

  try {
    const mappings = await getAniBridgeMappings();
    const fromAniBridge = resolveAniBridgeTmdbShowIdForAnilist(
      mappings,
      anilistId,
    );
    if (fromAniBridge?.tmdbShowId) {
      return {
        tmdbShowId: fromAniBridge.tmdbShowId,
        seasonNumber: fromAniBridge.seasonNumber,
      };
    }
  } catch {
    // fall through to Fribb
  }

  const fromFribb = await getTmdbIdFromFribb(anilistId);
  if (fromFribb?.type === "tv" && fromFribb.id > 0) {
    return {
      tmdbShowId: fromFribb.id,
      seasonNumber: fromFribb.season ?? null,
    };
  }

  return null;
};

export const resolveAnilistToTmdbShowId = async (
  anilistId: number,
): Promise<number | null> => {
  const resolved = await resolveAnilistToTmdbShow(anilistId);
  return resolved?.tmdbShowId ?? null;
};
