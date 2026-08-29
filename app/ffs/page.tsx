import { FfsDashboard } from "@/components/ffs/ffs-dashboard";
import {
  readAdminFlagState,
  readAnnouncementBannerConfig,
  readProviderMenuOrderConfig,
} from "@/lib/flags/flipt-admin";
import { buildDefaultAdminFlagState } from "@/lib/flags/flag-catalog";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";
import { DEFAULT_PROVIDER_MENU_ORDER } from "@/lib/flags/provider-menu-order";

export default async function FfsAdminPage() {
  let flags = buildDefaultAdminFlagState();
  let announcementBanner = DEFAULT_ANNOUNCEMENT_BANNER_CONFIG;
  let providerMenuOrder = DEFAULT_PROVIDER_MENU_ORDER;
  try {
    [flags, announcementBanner, providerMenuOrder] = await Promise.all([
      readAdminFlagState(),
      readAnnouncementBannerConfig(),
      readProviderMenuOrderConfig(),
    ]);
  } catch (error) {
    console.warn("[ffs] failed to load flags for dashboard:", error);
  }

  return (
    <FfsDashboard
      initialFlags={flags}
      initialAnnouncementBanner={announcementBanner}
      initialProviderMenuOrder={providerMenuOrder}
    />
  );
}
