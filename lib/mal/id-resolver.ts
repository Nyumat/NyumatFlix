import {
  getFribbRawList,
  type FribbMappingItem,
  type FribbTmdbMapping,
} from "@/lib/fribb-mapping";

export type MalTmdbMapping = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  anilistId?: number;
  malId?: number;
};

type ExtendedFribbRow = FribbMappingItem & {
  mal_id?: number | number[];
  myanimelist_id?: number | number[];
};

let malToTmdbCache: Map<number, MalTmdbMapping> | null = null;
let malToAnilistCache: Map<number, number> | null = null;
let anilistToMalCache: Map<number, number> | null = null;
let tmdbToMalCache: Map<string, number> | null = null;
let inflightBuild: Promise<void> | null = null;

async function buildMappingIndices(): Promise<void> {
  if (malToTmdbCache && tmdbToMalCache) return;

  if (!inflightBuild) {
    inflightBuild = (async () => {
      try {
        const rows = (await getFribbRawList()) as ExtendedFribbRow[];
        const newMalToTmdb = new Map<number, MalTmdbMapping>();
        const newMalToAnilist = new Map<number, number>();
        const newAnilistToMal = new Map<number, number>();
        const newTmdbToMal = new Map<string, number>();

        for (const row of rows) {
          const rawMal = row.mal_id ?? row.myanimelist_id;
          const malIds = Array.isArray(rawMal)
            ? rawMal
            : typeof rawMal === "number" && rawMal > 0
              ? [rawMal]
              : [];

          if (typeof row.anilist_id === "number" && row.anilist_id > 0) {
            for (const malId of malIds) {
              if (malId > 0 && !newMalToAnilist.has(malId)) {
                newMalToAnilist.set(malId, row.anilist_id);
              }
              if (malId > 0 && !newAnilistToMal.has(row.anilist_id)) {
                newAnilistToMal.set(row.anilist_id, malId);
              }
            }
          }

          let tmdbId: number | null = null;
          let mediaType: "movie" | "tv" = "tv";

          if (typeof row.themoviedb_id === "number" && row.themoviedb_id > 0) {
            tmdbId = row.themoviedb_id;
          } else if (
            row.themoviedb_id &&
            typeof row.themoviedb_id === "object"
          ) {
            const obj = row.themoviedb_id as {
              tv?: number | number[];
              movie?: number | number[];
            };
            if (typeof obj.tv === "number" && obj.tv > 0) {
              tmdbId = obj.tv;
              mediaType = "tv";
            } else if (
              Array.isArray(obj.tv) &&
              typeof obj.tv[0] === "number" &&
              obj.tv[0] > 0
            ) {
              tmdbId = obj.tv[0];
              mediaType = "tv";
            } else if (typeof obj.movie === "number" && obj.movie > 0) {
              tmdbId = obj.movie;
              mediaType = "movie";
            } else if (
              Array.isArray(obj.movie) &&
              typeof obj.movie[0] === "number" &&
              obj.movie[0] > 0
            ) {
              tmdbId = obj.movie[0];
              mediaType = "movie";
            }
          }

          if (tmdbId && tmdbId > 0) {
            const season = row.season?.tmdb;
            for (const malId of malIds) {
              if (malId > 0 && !newMalToTmdb.has(malId)) {
                newMalToTmdb.set(malId, {
                  tmdbId,
                  mediaType,
                  season,
                  anilistId: row.anilist_id,
                  malId,
                });
              }

              const tmdbKey = `${mediaType}:${tmdbId}${season ? `:${season}` : ""}`;
              if (!newTmdbToMal.has(tmdbKey)) {
                newTmdbToMal.set(tmdbKey, malId);
              }
              const genericKey = `${mediaType}:${tmdbId}`;
              if (!newTmdbToMal.has(genericKey)) {
                newTmdbToMal.set(genericKey, malId);
              }
            }

            if (typeof row.anilist_id === "number" && row.anilist_id > 0) {
              for (const malId of malIds) {
                if (!newMalToAnilist.has(malId)) {
                  newMalToAnilist.set(malId, row.anilist_id);
                }
              }
            }
          }
        }

        malToTmdbCache = newMalToTmdb;
        malToAnilistCache = newMalToAnilist;
        anilistToMalCache = newAnilistToMal;
        tmdbToMalCache = newTmdbToMal;
      } finally {
        inflightBuild = null;
      }
    })();
  }

  await inflightBuild;
}

/**
 * Resolves a MyAnimeList ID to TMDB id & mediaType (movie / tv).
 */
export async function resolveMalToTmdb(
  malId: number,
): Promise<MalTmdbMapping | null> {
  await buildMappingIndices();
  return malToTmdbCache?.get(malId) ?? null;
}

/**
 * Resolves a MyAnimeList ID to an AniList ID via Fribb mappings.
 */
export async function resolveMalToAnilist(
  malId: number,
): Promise<number | null> {
  await buildMappingIndices();
  return malToAnilistCache?.get(malId) ?? null;
}

/** Resolves an AniList ID to a MyAnimeList ID via bundled Fribb mappings only. */
export async function resolveAnilistToMalFromMappings(
  anilistId: number,
): Promise<number | null> {
  await buildMappingIndices();
  return anilistToMalCache?.get(anilistId) ?? null;
}

export function cacheAnilistToMalMapping(
  anilistId: number,
  malId: number,
): void {
  if (anilistToMalCache) {
    anilistToMalCache.set(anilistId, malId);
  }
}

/**
 * Resolves TMDB ID + mediaType (+ optional season) to a MyAnimeList ID.
 */
export async function resolveTmdbToMal(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
): Promise<number | null> {
  await buildMappingIndices();
  if (season !== undefined && season > 0) {
    const withSeason = tmdbToMalCache?.get(`${mediaType}:${tmdbId}:${season}`);
    if (withSeason) return withSeason;
  }
  return tmdbToMalCache?.get(`${mediaType}:${tmdbId}`) ?? null;
}

/**
 * Resolves TMDB ID + mediaType (+ optional season) to an AniList ID via Fribb mappings.
 */
export async function resolveTmdbToAnilistFromMappings(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
): Promise<number | null> {
  const malId = await resolveTmdbToMal(tmdbId, mediaType, season);
  if (malId) {
    const anilistId = await resolveMalToAnilist(malId);
    if (anilistId) return anilistId;
  }
  return null;
}
