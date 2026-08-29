import { getMalUserAnimeList, getValidMalAccessToken } from "./client";
import { resolveMalToTmdb } from "./id-resolver";

import type { MalListIndex, MalListIndexItem } from "./list-index-shared";

export type { MalListIndex, MalListIndexItem } from "./list-index-shared";

export async function getMalListIndexForUser(
  userId: string,
): Promise<MalListIndex> {
  const authInfo = await getValidMalAccessToken(userId);
  if (!authInfo) {
    return { connected: false, items: [] };
  }

  const listRes = await getMalUserAnimeList(authInfo.accessToken, {
    limit: 1000,
  });

  const items: MalListIndexItem[] = [];

  for (const row of listRes.data ?? []) {
    const malId = row.node.id;
    const mapping = await resolveMalToTmdb(malId);
    if (!mapping) {
      continue;
    }

    items.push({
      malId,
      tmdbId: mapping.tmdbId,
      mediaType: mapping.mediaType,
      season: mapping.season,
      anilistId: mapping.anilistId,
      numEpisodes:
        typeof row.node.num_episodes === "number" && row.node.num_episodes > 0
          ? row.node.num_episodes
          : null,
      listStatus: row.list_status ?? {},
    });
  }

  return { connected: true, items };
}
