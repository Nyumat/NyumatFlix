import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  readAdminFlagState,
  readAnnouncementBannerConfig,
  readProviderMenuOrderConfig,
  writeAdminFlagState,
} from "@/lib/flags/flipt-admin";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  sanitizeAnnouncementBannerConfig,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  DEFAULT_PROVIDER_MENU_ORDER,
  sanitizeProviderMenuOrderConfig,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
  type AdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost } from "@/lib/ffs/require-ffs-host";

export async function GET(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [flags, announcementBanner, providerMenuOrder] = await Promise.all([
      readAdminFlagState(),
      readAnnouncementBannerConfig(),
      readProviderMenuOrderConfig(),
    ]);
    return NextResponse.json({ flags, announcementBanner, providerMenuOrder });
  } catch (error) {
    console.error("[ffs] GET flags failed:", error);
    return NextResponse.json(
      {
        flags: buildDefaultAdminFlagState(),
        announcementBanner: DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
        providerMenuOrder: DEFAULT_PROVIDER_MENU_ORDER,
        degraded: true,
      },
      { status: 200 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    flags?: AdminFlagState;
    announcementBanner?: AnnouncementBannerConfig;
    providerMenuOrder?: ProviderMenuOrderConfig;
  };
  try {
    body = (await request.json()) as {
      flags?: AdminFlagState;
      announcementBanner?: AnnouncementBannerConfig;
      providerMenuOrder?: ProviderMenuOrderConfig;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.flags || typeof body.flags !== "object") {
    return NextResponse.json({ error: "Missing flags" }, { status: 400 });
  }

  const flags = applyPlaybackMutualExclusion(body.flags);
  const announcementBanner = sanitizeAnnouncementBannerConfig(
    body.announcementBanner,
  );
  const providerMenuOrder = sanitizeProviderMenuOrderConfig(
    body.providerMenuOrder,
  );

  if (
    flags["global.announcement_banner"] &&
    !announcementBanner.title &&
    !announcementBanner.message
  ) {
    return NextResponse.json(
      { error: "Add a banner title or message before enabling it" },
      { status: 400 },
    );
  }

  try {
    await writeAdminFlagState(flags, announcementBanner, providerMenuOrder);
    return NextResponse.json({
      flags,
      announcementBanner,
      providerMenuOrder,
      ok: true,
    });
  } catch (error) {
    console.error("[ffs] PATCH flags failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 502 },
    );
  }
}
