import { auth } from "@/auth";
import { isAmbientGlowEnabled } from "@/lib/flags/ambient-glow-enabled";
import { getSiteFlags } from "@/lib/flags/site-flags-server";
import {
  getDefaultUserSettingsWire,
  getUserSettings,
  upsertUserSettings,
} from "@/lib/server/user-settings";
import type {
  UserSettingsPatch,
  UserSettingsWire,
} from "@/lib/user/user-settings-types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z
  .object({
    playbackAudio: z.enum(["sub", "dub"]).optional(),
    playbackQuality: z.enum(["1080p", "720p", "480p"]).optional(),
    playbackEnglishSubtitles: z.boolean().optional(),
    disableHoverSound: z.boolean().optional(),
    disableHeroTrailers: z.boolean().optional(),
    ambientGlow: z.boolean().optional(),
    catalogCardStyle: z.enum(["poster", "backdrop"]).optional(),
    selectedServerId: z.string().nullable().optional(),
    userSelectedPlaybackServer: z.boolean().optional(),
    policyGenerationAtChoice: z.string().nullable().optional(),
    vidnestContentType: z
      .enum(["movie", "tv", "anime", "animepahe"])
      .optional(),
    vidsrcApi: z.enum(["1", "2", "3", "4"]).optional(),
    subtitleAppearance: z.record(z.unknown()).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const maskAmbientGlowWhenDisabled = async (
  settings: UserSettingsWire,
): Promise<UserSettingsWire> => {
  const flags = await getSiteFlags();
  if (!isAmbientGlowEnabled(flags)) {
    return { ...settings, ambientGlow: false };
  }
  return settings;
};

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      const settings = await maskAmbientGlowWhenDisabled(
        getDefaultUserSettingsWire(),
      );
      return NextResponse.json({ settings });
    }

    const settings = await maskAmbientGlowWhenDisabled(
      await getUserSettings(session.user.id),
    );
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error loading user settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = patchSchema.parse(body) as UserSettingsPatch;
    const flags = await getSiteFlags();
    const patch = isAmbientGlowEnabled(flags)
      ? validated
      : (({ ambientGlow: _ignored, ...rest }) => rest)(validated);
    const settings = await maskAmbientGlowWhenDisabled(
      await upsertUserSettings(session.user.id, patch),
    );
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
