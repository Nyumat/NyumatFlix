import { FfsDashboard } from "@/components/ffs/ffs-dashboard";
import {
  readAdminFlagState,
  readAnnouncementBannerConfig,
} from "@/lib/flags/flipt-admin";
import { buildDefaultAdminFlagState } from "@/lib/flags/flag-catalog";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";

export default async function FfsAdminPage() {
  let flags = buildDefaultAdminFlagState();
  let announcementBanner = DEFAULT_ANNOUNCEMENT_BANNER_CONFIG;
  try {
    [flags, announcementBanner] = await Promise.all([
      readAdminFlagState(),
      readAnnouncementBannerConfig(),
    ]);
  } catch (error) {
    console.warn("[ffs] failed to load flags for dashboard:", error);
  }

  return (
    <FfsDashboard
      initialFlags={flags}
      initialAnnouncementBanner={announcementBanner}
    />
  );
}
