import "server-only";

import {
  ANIBRIDGE_BUNDLED_FILE,
  readBundledJson,
} from "@/lib/anime/bundled-mapping-files";
import {
  anibridgeTmdbSeasonKey,
  buildAniBridgeSeasonSegments,
  collectAniBridgeAnilistIdsForTmdbShow,
  episodeMatchesAniBridgeSeason,
  resolveAniBridgeAnilistIdForTmdbShow,
  resolveAniBridgeMalPlaybackTarget,
  resolveAniBridgePlaybackCoords,
  resolveAniBridgeTmdbShowIdForAnilist,
  type AniBridgeSeasonMappings,
} from "@/lib/anime/anibridge-season-segments";

export type { AniBridgeSeasonMappings };
export {
  anibridgeTmdbSeasonKey,
  buildAniBridgeSeasonSegments,
  collectAniBridgeAnilistIdsForTmdbShow,
  episodeMatchesAniBridgeSeason,
  resolveAniBridgeAnilistIdForTmdbShow,
  resolveAniBridgeMalPlaybackTarget,
  resolveAniBridgePlaybackCoords,
  resolveAniBridgeTmdbShowIdForAnilist,
};

const ANIBRIDGE_URL =
  "https://github.com/anibridge/anibridge-mappings/releases/download/v3/mappings.min.json";
const FETCH_TIMEOUT_MS = 30_000;
const MEMORY_TTL_MS = 60 * 60 * 24 * 1000;

type CachedMappings = {
  value: AniBridgeSeasonMappings;
  expiresAt: number;
};

let cachedMappings: CachedMappings | null = null;
let inflightMappings: Promise<AniBridgeSeasonMappings> | null = null;

const loadAniBridgeMappings = async (): Promise<AniBridgeSeasonMappings> => {
  const bundled = await readBundledJson<AniBridgeSeasonMappings>(
    ANIBRIDGE_BUNDLED_FILE,
  );
  if (bundled) {
    return bundled;
  }

  const response = await fetch(ANIBRIDGE_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`AniBridge mappings fetch failed: ${response.status}`);
  }

  return (await response.json()) as AniBridgeSeasonMappings;
};

export const getAniBridgeMappings =
  async (): Promise<AniBridgeSeasonMappings> => {
    const now = Date.now();
    if (cachedMappings && cachedMappings.expiresAt > now) {
      return cachedMappings.value;
    }

    if (!inflightMappings) {
      inflightMappings = loadAniBridgeMappings()
        .then((value) => {
          cachedMappings = { value, expiresAt: Date.now() + MEMORY_TTL_MS };
          return value;
        })
        .finally(() => {
          inflightMappings = null;
        });
    }

    return inflightMappings;
  };
