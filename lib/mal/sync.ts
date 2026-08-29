import { db, watchlist } from "@/db/schema";
import type { WatchlistStatus } from "@/lib/domain/watchlist";
import { and, eq } from "drizzle-orm";
import {
  getMalAnimeEntry,
  getMalUserAnimeList,
  getValidMalAccessToken,
  MalClientError,
  MalReauthRequiredError,
  updateMalAnimeListStatus,
} from "./client";
import { resolveAnilistToMal } from "./id-resolver-anilist";
import { resolveMalToTmdb, resolveTmdbToMal } from "./id-resolver";
import type { MalMyListStatus, MalSyncResult } from "./types";
import {
  mapMalStatusToWatchlistStatus,
  mapWatchlistStatusToMalStatus,
} from "./status-maps";

/**
 * Pulls all user anime from MAL and upserts into the user's NyumatFlix watchlist.
 */
export async function pullMalListToWatchlist(
  userId: string,
): Promise<MalSyncResult> {
  let authInfo: Awaited<ReturnType<typeof getValidMalAccessToken>>;
  try {
    authInfo = await getValidMalAccessToken(userId);
  } catch (error) {
    if (error instanceof MalReauthRequiredError) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [error.message],
        reauthRequired: true,
      };
    }
    throw error;
  }

  if (!authInfo) {
    return {
      success: false,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: ["MyAnimeList is not connected or token is invalid"],
    };
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const listRes = await getMalUserAnimeList(authInfo.accessToken, {
      limit: 1000,
    });
    const items = listRes.data || [];

    for (const item of items) {
      const malId = item.node.id;
      const mapping = await resolveMalToTmdb(malId);

      if (!mapping) {
        skipped++;
        continue;
      }

      const nyumatStatus = mapMalStatusToWatchlistStatus(
        item.list_status?.status,
      );
      const watchedEpisodes = item.list_status?.num_episodes_watched ?? null;

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
        const targetEpisode =
          watchedEpisodes !== null && watchedEpisodes > 0
            ? watchedEpisodes
            : existing.lastWatchedEpisode;
        const targetSeason = mapping.season ?? existing.lastWatchedSeason ?? 1;

        // Skip update if already perfectly in sync
        const isAlreadySynced =
          existing.status === nyumatStatus &&
          existing.lastWatchedEpisode === targetEpisode &&
          existing.lastWatchedSeason === targetSeason;

        if (isAlreadySynced) {
          skipped++;
          continue;
        }

        // Update status and watched episode if MAL is newer/provided
        await db
          .update(watchlist)
          .set({
            status: nyumatStatus,
            lastWatchedEpisode: targetEpisode,
            lastWatchedSeason: targetSeason,
            lastWatchedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(watchlist.id, existing.id));
        updated++;
      } else {
        // Insert new entry
        await db.insert(watchlist).values({
          userId,
          contentId: mapping.tmdbId,
          mediaType: mapping.mediaType,
          status: nyumatStatus,
          lastWatchedEpisode:
            watchedEpisodes !== null && watchedEpisodes > 0
              ? watchedEpisodes
              : mapping.mediaType === "tv"
                ? 1
                : null,
          lastWatchedSeason:
            mapping.season ?? (mapping.mediaType === "tv" ? 1 : null),
          lastWatchedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        imported++;
      }
    }

    return {
      success: true,
      imported,
      updated,
      skipped,
      errors,
    };
  } catch (error) {
    console.error("Error pulling MAL list to watchlist:", error);
    return {
      success: false,
      imported,
      updated,
      skipped,
      errors: [
        error instanceof Error ? error.message : "Unknown error occurred",
      ],
      isNetworkError: error instanceof MalClientError && error.isNetworkError,
    };
  }
}

/**
 * Scrobbles an episode/status update to MyAnimeList when playback progress updates.
 */
export async function scrobbleToMal(
  userId: string,
  params: {
    tmdbId: number;
    mediaType: "movie" | "tv";
    seasonNumber?: number;
    episodeNumber?: number;
    status?: WatchlistStatus;
    /**
     * AniList id, when known. `tmdbId` is sometimes actually an AniList id
     * (e.g. progress reported from `/anime/[id]` pages, which are keyed by
     * AniList id rather than TMDB id) — falling back to this lets scrobbling
     * still resolve a MAL id via Fribb's AniList mapping in that case.
     */
    anilistId?: number | null;
  },
): Promise<boolean> {
  let authInfo: Awaited<ReturnType<typeof getValidMalAccessToken>>;
  try {
    authInfo = await getValidMalAccessToken(userId);
  } catch (error) {
    if (error instanceof MalReauthRequiredError) {
      console.info(
        "Skipping MAL scrobble: MyAnimeList needs reauthorization for user",
        userId,
      );
    } else {
      console.warn("Failed to get MAL access token for scrobble:", error);
    }
    return false;
  }
  if (!authInfo) {
    return false;
  }

  const malId =
    (await resolveTmdbToMal(
      params.tmdbId,
      params.mediaType,
      params.seasonNumber,
    )) ??
    (params.mediaType === "tv" && params.anilistId
      ? await resolveAnilistToMal(params.anilistId)
      : null);

  if (!malId) {
    console.info(
      "Skipping MAL scrobble: no MAL mapping found for",
      `tmdbId=${params.tmdbId}`,
      `mediaType=${params.mediaType}`,
      params.anilistId ? `anilistId=${params.anilistId}` : "",
    );
    return false;
  }

  const malPayload: MalMyListStatus = {};

  let currentListStatus: MalMyListStatus | null = null;
  try {
    const entry = await getMalAnimeEntry(authInfo.accessToken, malId);
    currentListStatus = entry?.my_list_status ?? null;
  } catch {
    currentListStatus = null;
  }

  if (params.status) {
    malPayload.status = mapWatchlistStatusToMalStatus(params.status);
  } else if (params.episodeNumber !== undefined) {
    const currentStatus = currentListStatus?.status;
    if (currentStatus === "completed") {
      malPayload.is_rewatching = true;
    } else if (!currentStatus) {
      malPayload.status = "watching";
    }
  }

  if (params.episodeNumber !== undefined && params.episodeNumber > 0) {
    const currentWatched = currentListStatus?.num_episodes_watched;
    if (currentListStatus?.status === "completed") {
      if (
        typeof currentWatched !== "number" ||
        params.episodeNumber > currentWatched
      ) {
        malPayload.num_episodes_watched = params.episodeNumber;
      }
    } else {
      malPayload.num_episodes_watched = params.episodeNumber;
    }
  }

  try {
    await updateMalAnimeListStatus(authInfo.accessToken, malId, malPayload);
    return true;
  } catch (error) {
    console.warn("Failed to scrobble anime progress to MAL:", malId, error);
    return false;
  }
}
