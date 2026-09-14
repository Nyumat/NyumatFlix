import "server-only";

import {
  readBundledKaiDbEntry,
  type KaiDbEntry,
  type KaiDbEpisodeSources,
} from "./kai-db-bundled";

export type { KaiDbEntry, KaiDbEpisodeSources };

export const fetchKaiDbEntryByAnilistId = async (
  anilistId: number,
  _init?: { signal?: AbortSignal },
): Promise<KaiDbEntry | null> => readBundledKaiDbEntry(anilistId);
