import "server-only";

import { db, userSettings } from "@/db";
import { eq } from "drizzle-orm";
import type {
  UserSettingsPatch,
  UserSettingsWire,
} from "@/lib/user/user-settings-types";
import { DEFAULT_PLAYBACK_PREFERENCES } from "@/lib/playback/playback-preferences";
import type { VidsrcApi } from "@/lib/providers/embed-urls";

const rowToWire = (
  row: typeof userSettings.$inferSelect,
): UserSettingsWire => ({
  playbackAudio: row.playbackAudio,
  playbackQuality: row.playbackQuality,
  playbackEnglishSubtitles: row.playbackEnglishSubtitles,
  disableHoverSound: row.disableHoverSound,
  disableHeroTrailers: row.disableHeroTrailers,
  selectedServerId: row.selectedServerId,
  userSelectedPlaybackServer: row.userSelectedPlaybackServer,
  policyGenerationAtChoice: row.policyGenerationAtChoice,
  vidnestContentType: row.vidnestContentType,
  vidsrcApi: row.vidsrcApi as VidsrcApi,
  subtitleAppearance:
    row.subtitleAppearance as UserSettingsWire["subtitleAppearance"],
});

export const getDefaultUserSettingsWire = (): UserSettingsWire => ({
  playbackAudio: DEFAULT_PLAYBACK_PREFERENCES.playbackAudio,
  playbackQuality: DEFAULT_PLAYBACK_PREFERENCES.playbackQuality,
  playbackEnglishSubtitles:
    DEFAULT_PLAYBACK_PREFERENCES.playbackEnglishSubtitles,
  disableHoverSound: false,
  disableHeroTrailers: false,
  selectedServerId: null,
  userSelectedPlaybackServer: false,
  policyGenerationAtChoice: null,
  vidnestContentType: "tv",
  vidsrcApi: "1",
  subtitleAppearance: null,
});

export const getUserSettings = async (
  userId: string,
): Promise<UserSettingsWire> => {
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return getDefaultUserSettingsWire();
  }

  return rowToWire(rows[0]);
};

export const upsertUserSettings = async (
  userId: string,
  patch: UserSettingsPatch,
): Promise<UserSettingsWire> => {
  const existing = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const now = new Date();

  if (existing.length === 0) {
    const defaults = getDefaultUserSettingsWire();
    const [inserted] = await db
      .insert(userSettings)
      .values({
        userId,
        playbackAudio: patch.playbackAudio ?? defaults.playbackAudio,
        playbackQuality: patch.playbackQuality ?? defaults.playbackQuality,
        playbackEnglishSubtitles:
          patch.playbackEnglishSubtitles ?? defaults.playbackEnglishSubtitles,
        disableHoverSound:
          patch.disableHoverSound ?? defaults.disableHoverSound,
        disableHeroTrailers:
          patch.disableHeroTrailers ?? defaults.disableHeroTrailers,
        selectedServerId: patch.selectedServerId ?? defaults.selectedServerId,
        userSelectedPlaybackServer:
          patch.userSelectedPlaybackServer ??
          defaults.userSelectedPlaybackServer,
        policyGenerationAtChoice:
          patch.policyGenerationAtChoice ?? defaults.policyGenerationAtChoice,
        vidnestContentType:
          patch.vidnestContentType ?? defaults.vidnestContentType,
        vidsrcApi: patch.vidsrcApi ?? defaults.vidsrcApi,
        subtitleAppearance:
          patch.subtitleAppearance ?? defaults.subtitleAppearance,
        updatedAt: now,
      })
      .returning();
    return rowToWire(inserted);
  }

  const [updated] = await db
    .update(userSettings)
    .set({
      ...patch,
      updatedAt: now,
    })
    .where(eq(userSettings.userId, userId))
    .returning();

  return rowToWire(updated);
};
