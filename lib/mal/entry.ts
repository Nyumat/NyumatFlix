import { db, watchlist } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import {
  getMalAnimeEntry,
  getValidMalAccessToken,
  updateMalAnimeListStatus,
} from "./client";
import { resolveAnilistToMal } from "./id-resolver-anilist";
import { resolveMalToTmdb, resolveTmdbToMal } from "./id-resolver";
import { mapMalStatusToWatchlistStatus } from "./status-maps";
import type { MalListStatus } from "./constants";
import type { MalMyListStatus, MalEntryResponse } from "./types";

export type UpdateMalEntryInput = {
  malId?: number;
  anilistId?: number;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  seasonNumber?: number;
  status?: MalListStatus;
  score?: number;
  numEpisodesWatched?: number;
};

export async function resolveMalIdForEntry(
  params: UpdateMalEntryInput,
): Promise<number | null> {
  if (
    typeof params.malId === "number" &&
    Number.isInteger(params.malId) &&
    params.malId > 0
  ) {
    return params.malId;
  }

  if (
    typeof params.anilistId === "number" &&
    Number.isInteger(params.anilistId) &&
    params.anilistId > 0
  ) {
    const fromAnilist = await resolveAnilistToMal(params.anilistId);
    if (fromAnilist) {
      return fromAnilist;
    }
  }

  if (
    typeof params.tmdbId === "number" &&
    params.mediaType &&
    params.tmdbId > 0
  ) {
    return await resolveTmdbToMal(
      params.tmdbId,
      params.mediaType,
      params.seasonNumber,
    );
  }

  return null;
}

export async function getMalEntryForUser(
  userId: string,
  params: UpdateMalEntryInput,
): Promise<MalEntryResponse | null> {
  const malId = await resolveMalIdForEntry(params);
  if (!malId) {
    return null;
  }

  const authInfo = await getValidMalAccessToken(userId);
  if (!authInfo) {
    return null;
  }

  const entry = await getMalAnimeEntry(authInfo.accessToken, malId);
  if (!entry) {
    return null;
  }

  const listStatus = entry.my_list_status ?? null;

  return {
    malId: entry.id,
    numEpisodes:
      typeof entry.num_episodes === "number" && entry.num_episodes > 0
        ? entry.num_episodes
        : null,
    animeStatus: entry.status ?? null,
    onList: Boolean(listStatus?.status),
    listStatus,
  };
}

export async function updateMalEntryForUser(
  userId: string,
  params: UpdateMalEntryInput,
): Promise<MalEntryResponse | null> {
  const malId = await resolveMalIdForEntry(params);
  if (!malId) {
    return null;
  }

  const authInfo = await getValidMalAccessToken(userId);
  if (!authInfo) {
    return null;
  }

  const malPayload: MalMyListStatus = {};
  if (params.status) {
    malPayload.status = params.status;
  }
  if (
    typeof params.numEpisodesWatched === "number" &&
    params.numEpisodesWatched >= 0
  ) {
    malPayload.num_episodes_watched = params.numEpisodesWatched;
  }
  if (typeof params.score === "number" && params.score > 0) {
    malPayload.score = params.score;
  }

  const updated = await updateMalAnimeListStatus(
    authInfo.accessToken,
    malId,
    malPayload,
  );

  await mirrorMalListStatusToWatchlist(userId, malId, {
    ...updated,
    status: updated.status ?? params.status ?? malPayload.status,
    num_episodes_watched:
      updated.num_episodes_watched ?? malPayload.num_episodes_watched,
    score: updated.score ?? malPayload.score,
  });

  return await getMalEntryForUser(userId, { malId });
}

export async function mirrorMalListStatusToWatchlist(
  userId: string,
  malId: number,
  listStatus: MalMyListStatus,
): Promise<void> {
  const mapping = await resolveMalToTmdb(malId);
  if (!mapping) {
    return;
  }

  const nyumatStatus = mapMalStatusToWatchlistStatus(listStatus.status);
  const watchedEpisodes =
    typeof listStatus.num_episodes_watched === "number" &&
    listStatus.num_episodes_watched > 0
      ? listStatus.num_episodes_watched
      : null;
  const targetSeason =
    mapping.season ?? (mapping.mediaType === "tv" ? 1 : null);

  const [existing] = await db
    .select()
    .from(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.contentId, mapping.tmdbId),
        eq(watchlist.mediaType, mapping.mediaType),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(watchlist)
      .set({
        status: nyumatStatus,
        lastWatchedEpisode: watchedEpisodes ?? existing.lastWatchedEpisode,
        lastWatchedSeason: targetSeason ?? existing.lastWatchedSeason,
        lastWatchedAt: watchedEpisodes ? new Date() : existing.lastWatchedAt,
        updatedAt: new Date(),
      })
      .where(eq(watchlist.id, existing.id));
    return;
  }

  await db.insert(watchlist).values({
    userId,
    contentId: mapping.tmdbId,
    mediaType: mapping.mediaType,
    status: nyumatStatus,
    lastWatchedEpisode:
      watchedEpisodes ?? (mapping.mediaType === "tv" ? 1 : null),
    lastWatchedSeason: targetSeason,
    lastWatchedAt: watchedEpisodes ? new Date() : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
