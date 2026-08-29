import type { MalEntryResponse, MalMyListStatus } from "./types";

export type MalListIndexItem = {
  malId: number;
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  anilistId?: number;
  numEpisodes: number | null;
  listStatus: MalMyListStatus;
};

export type MalListIndex = {
  connected: boolean;
  items: MalListIndexItem[];
};

export const malListIndexKey = (
  mediaType: "movie" | "tv",
  tmdbId: number,
): string => `${mediaType}:${tmdbId}`;

export function findMalListIndexItem(
  items: MalListIndexItem[],
  mediaType: "movie" | "tv",
  tmdbId: number,
): MalListIndexItem | undefined {
  const key = malListIndexKey(mediaType, tmdbId);
  return items.find(
    (item) => malListIndexKey(item.mediaType, item.tmdbId) === key,
  );
}

export function malEntryFromIndexItem(
  item: MalListIndexItem,
): MalEntryResponse {
  return {
    malId: item.malId,
    numEpisodes: item.numEpisodes,
    animeStatus: null,
    onList: Boolean(item.listStatus?.status),
    listStatus: item.listStatus ?? null,
  };
}

export type MalEntryOptimisticPatch = {
  status?: MalMyListStatus["status"];
  score?: number;
  numEpisodesWatched?: number;
};

export function applyMalEntryPatch(
  entry: MalEntryResponse,
  patch: MalEntryOptimisticPatch,
): MalEntryResponse {
  const listStatus: MalMyListStatus = {
    ...(entry.listStatus ?? {}),
  };

  if (patch.status !== undefined) {
    listStatus.status = patch.status;
  }
  if (patch.score !== undefined) {
    listStatus.score = patch.score;
  }
  if (patch.numEpisodesWatched !== undefined) {
    listStatus.num_episodes_watched = patch.numEpisodesWatched;
  }

  return {
    ...entry,
    onList: true,
    listStatus,
  };
}

export function applyMalListIndexPatch(
  index: MalListIndex,
  mediaType: "movie" | "tv",
  tmdbId: number,
  patch: MalEntryOptimisticPatch,
): MalListIndex {
  const key = malListIndexKey(mediaType, tmdbId);

  return {
    ...index,
    items: index.items.map((item) => {
      if (malListIndexKey(item.mediaType, item.tmdbId) !== key) {
        return item;
      }

      const listStatus: MalMyListStatus = { ...item.listStatus };

      if (patch.status !== undefined) {
        listStatus.status = patch.status;
      }
      if (patch.score !== undefined) {
        listStatus.score = patch.score;
      }
      if (patch.numEpisodesWatched !== undefined) {
        listStatus.num_episodes_watched = patch.numEpisodesWatched;
      }

      return {
        ...item,
        listStatus,
      };
    }),
  };
}
