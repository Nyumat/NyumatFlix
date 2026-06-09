import "server-only";

import { filterReleasedMovies } from "@/lib/released-media";
import { runInChunks } from "@/lib/server/chunked-parallel";
import { tmdb } from "@/tmdb/api";
import type { DetailedCollection, Movie } from "@/tmdb/models";
import { cache } from "react";

const MIN_COLLECTION_PARTS = 3;

/** Curated franchise collections surfaced on the home hub. */
export const HOME_COLLECTION_IDS = [
  131296, // Deadpool
  86311, // Marvel Cinematic Universe (The Avengers)
  1241, // Harry Potter
  9485, // Fast & Furious
] as const;

export type HomeCollection = DetailedCollection & {
  parts: Movie[];
};

const normalizeCollection = (
  collection: DetailedCollection | null,
): HomeCollection | null => {
  if (!collection) return null;

  const parts = filterReleasedMovies(collection.parts);
  if (parts.length < MIN_COLLECTION_PARTS) return null;

  return { ...collection, parts };
};

export const getHomeCollections = cache(async (): Promise<HomeCollection[]> => {
  const results = await runInChunks(
    HOME_COLLECTION_IDS,
    (id) => tmdb.collection.details({ id }).catch(() => null),
    4,
  );

  return results
    .map(normalizeCollection)
    .filter((collection): collection is HomeCollection => collection !== null);
});
