import "server-only";

import { fetchMalIdByAnilist } from "@/lib/scrape/anime/anilist-meta";

import {
  cacheAnilistToMalMapping,
  resolveAnilistToMalFromMappings,
} from "./id-resolver";

/**
 * Resolves an AniList ID to a MyAnimeList ID.
 * Fribb mappings first; falls back to AniList GraphQL `idMal` when Fribb is missing
 * a row (common for newer or adult titles).
 */
export async function resolveAnilistToMal(
  anilistId: number,
): Promise<number | null> {
  const fromFribb = await resolveAnilistToMalFromMappings(anilistId);
  if (fromFribb) {
    return fromFribb;
  }

  const fromAnilist = await fetchMalIdByAnilist(anilistId);
  if (fromAnilist) {
    cacheAnilistToMalMapping(anilistId, fromAnilist);
  }
  return fromAnilist;
}
