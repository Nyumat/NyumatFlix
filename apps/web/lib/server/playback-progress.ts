import "server-only";

import { db, playbackProgress, watchlist } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  ListedPlaybackProgress,
  PlaybackMediaType,
  PlaybackProgressEntry,
  PlaybackProgressKey,
} from "@/lib/playback/progress-storage";
import { progressStorageKey } from "@/lib/playback/progress-storage";

type PlaybackDb = Pick<typeof db, "select" | "insert" | "update">;

export type ServerPlaybackProgressRow = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedSeconds: number;
  durationSeconds: number;
  updatedAt: Date;
};

const toListedEntry = (
  row: ServerPlaybackProgressRow,
): ListedPlaybackProgress => {
  const seasonNumber = row.seasonNumber > 0 ? row.seasonNumber : undefined;
  const episodeNumber = row.episodeNumber > 0 ? row.episodeNumber : undefined;
  const storageKey = progressStorageKey({
    mediaType: row.mediaType,
    contentId: row.contentId,
    seasonNumber,
    episodeNumber,
  });

  return {
    mediaType: row.mediaType,
    contentId: row.contentId,
    seasonNumber,
    episodeNumber,
    watched: row.watchedSeconds,
    duration: row.durationSeconds,
    updatedAt: row.updatedAt.getTime(),
    storageKey,
  };
};

export const listUserPlaybackProgress = async (
  userId: string,
): Promise<ListedPlaybackProgress[]> => {
  const rows = await db
    .select()
    .from(playbackProgress)
    .where(eq(playbackProgress.userId, userId))
    .orderBy(desc(playbackProgress.updatedAt));

  return rows.map((row) =>
    toListedEntry({
      mediaType: row.mediaType,
      contentId: row.contentId,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      watchedSeconds: row.watchedSeconds,
      durationSeconds: row.durationSeconds,
      updatedAt: row.updatedAt,
    }),
  );
};

export const getUserPlaybackProgress = async (
  userId: string,
  key: PlaybackProgressKey,
): Promise<PlaybackProgressEntry | null> => {
  const seasonNumber = key.seasonNumber ?? 0;
  const episodeNumber = key.episodeNumber ?? 0;

  const rows = await db
    .select()
    .from(playbackProgress)
    .where(
      and(
        eq(playbackProgress.userId, userId),
        eq(playbackProgress.mediaType, key.mediaType),
        eq(playbackProgress.contentId, key.contentId),
        eq(playbackProgress.seasonNumber, seasonNumber),
        eq(playbackProgress.episodeNumber, episodeNumber),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    watched: row.watchedSeconds,
    duration: row.durationSeconds,
    updatedAt: row.updatedAt.getTime(),
  };
};

export const upsertUserPlaybackProgress = async (
  userId: string,
  key: PlaybackProgressKey,
  entry: Omit<PlaybackProgressEntry, "updatedAt">,
  options?: { updatedAt?: number },
): Promise<void> => {
  const updatedAt =
    options?.updatedAt != null ? new Date(options.updatedAt) : new Date();
  await upsertUserPlaybackProgressRow(db, userId, key, entry, updatedAt);
};

export type PlaybackProgressWrite = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
  watched: number;
  duration: number;
  updatedAt: number;
};

export const bulkUpsertUserPlaybackProgress = async (
  userId: string,
  entries: PlaybackProgressWrite[],
): Promise<void> => {
  if (entries.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const listed of entries) {
      await upsertUserPlaybackProgressRow(
        tx,
        userId,
        {
          mediaType: listed.mediaType,
          contentId: listed.contentId,
          seasonNumber: listed.seasonNumber,
          episodeNumber: listed.episodeNumber,
        },
        {
          watched: listed.watched,
          duration: listed.duration,
        },
        new Date(listed.updatedAt),
      );
    }
  });
};

const upsertUserPlaybackProgressRow = async (
  executor: PlaybackDb,
  userId: string,
  key: PlaybackProgressKey,
  entry: Omit<PlaybackProgressEntry, "updatedAt">,
  updatedAt: Date,
): Promise<void> => {
  const seasonNumber = key.seasonNumber ?? 0;
  const episodeNumber = key.episodeNumber ?? 0;

  const existing = await executor
    .select({ id: playbackProgress.id })
    .from(playbackProgress)
    .where(
      and(
        eq(playbackProgress.userId, userId),
        eq(playbackProgress.mediaType, key.mediaType),
        eq(playbackProgress.contentId, key.contentId),
        eq(playbackProgress.seasonNumber, seasonNumber),
        eq(playbackProgress.episodeNumber, episodeNumber),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await executor
      .update(playbackProgress)
      .set({
        watchedSeconds: entry.watched,
        durationSeconds: entry.duration,
        updatedAt,
      })
      .where(eq(playbackProgress.id, existing[0].id));
    return;
  }

  await executor.insert(playbackProgress).values({
    userId,
    contentId: key.contentId,
    mediaType: key.mediaType,
    seasonNumber,
    episodeNumber,
    watchedSeconds: entry.watched,
    durationSeconds: entry.duration,
    updatedAt,
  });
};

export const dismissWatchlistTitle = async (
  userId: string,
  mediaType: PlaybackMediaType,
  contentId: number,
  dismissedAt: Date = new Date(),
): Promise<void> => {
  const existing = await db
    .select({ id: watchlist.id })
    .from(watchlist)
    .where(
      and(
        eq(watchlist.userId, userId),
        eq(watchlist.contentId, contentId),
        eq(watchlist.mediaType, mediaType),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(watchlist)
      .set({ dismissedAt, updatedAt: dismissedAt })
      .where(eq(watchlist.id, existing[0].id));
    return;
  }

  await db.insert(watchlist).values({
    userId,
    contentId,
    mediaType,
    status: "watching",
    dismissedAt,
    lastWatchedAt: dismissedAt,
  });
};
