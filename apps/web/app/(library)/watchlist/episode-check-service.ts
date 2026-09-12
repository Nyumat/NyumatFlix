"use server";

import type { EpisodeInfo } from "@/lib/domain/episodes";
import { checkEpisodesForShow as checkEpisodesForShowImpl } from "@/lib/server/episode-check-service";

export async function checkEpisodesForShow(
  contentId: number,
  lastWatchedSeason: number | null,
  lastWatchedEpisode: number | null,
): Promise<EpisodeInfo | null> {
  return checkEpisodesForShowImpl(
    contentId,
    lastWatchedSeason,
    lastWatchedEpisode,
  );
}
