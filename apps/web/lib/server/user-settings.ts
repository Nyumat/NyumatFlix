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
  ambientGlow: row.ambientGlow,
  catalogCardStyle: row.catalogCardStyle,
  selectedServerId: row.selectedServerId,
  userSelectedPlaybackServer: row.userSelectedPlaybackServer,
  policyGenerationAtChoice: row.policyGenerationAtChoice,
  vidnestContentType: row.vidnestContentType,
  vidsrcApi: row.vidsrcApi as VidsrcApi,
  subtitleAppearance:
    row.subtitleAppearance as UserSettingsWire["subtitleAppearance"],
});

export const getDefaultUserSettingsWire = (): UserSettingsWire => ({
  playbackAudio: null,
  playbackQuality: null,
  playbackEnglishSubtitles: null,
  disableHoverSound: null,
  disableHeroTrailers: null,
  ambientGlow: null,
  catalogCardStyle: null,
  selectedServerId: null,
  userSelectedPlaybackServer: false,
  policyGenerationAtChoice: null,
  vidnestContentType: null,
  vidsrcApi: null,
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
        playbackAudio:
          patch.playbackAudio !== undefined
            ? patch.playbackAudio
            : defaults.playbackAudio,
        playbackQuality:
          patch.playbackQuality !== undefined
            ? patch.playbackQuality
            : defaults.playbackQuality,
        playbackEnglishSubtitles:
          patch.playbackEnglishSubtitles !== undefined
            ? patch.playbackEnglishSubtitles
            : defaults.playbackEnglishSubtitles,
        disableHoverSound:
          patch.disableHoverSound !== undefined
            ? patch.disableHoverSound
            : defaults.disableHoverSound,
        disableHeroTrailers:
          patch.disableHeroTrailers !== undefined
            ? patch.disableHeroTrailers
            : defaults.disableHeroTrailers,
        ambientGlow:
          patch.ambientGlow !== undefined
            ? patch.ambientGlow
            : defaults.ambientGlow,
        catalogCardStyle:
          patch.catalogCardStyle !== undefined
            ? patch.catalogCardStyle
            : defaults.catalogCardStyle,
        selectedServerId:
          patch.selectedServerId !== undefined
            ? patch.selectedServerId
            : defaults.selectedServerId,
        userSelectedPlaybackServer:
          patch.userSelectedPlaybackServer ??
          defaults.userSelectedPlaybackServer,
        policyGenerationAtChoice:
          patch.policyGenerationAtChoice ?? defaults.policyGenerationAtChoice,
        vidnestContentType:
          patch.vidnestContentType !== undefined
            ? patch.vidnestContentType
            : defaults.vidnestContentType,
        vidsrcApi:
          patch.vidsrcApi !== undefined ? patch.vidsrcApi : defaults.vidsrcApi,
        subtitleAppearance:
          patch.subtitleAppearance !== undefined
            ? patch.subtitleAppearance
            : defaults.subtitleAppearance,
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
