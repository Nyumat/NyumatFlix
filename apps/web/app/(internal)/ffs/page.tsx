import { FfsDashboard } from "@/components/ffs/ffs-dashboard";
import {
  readAdminFlagState,
  readAnnouncementBannerConfig,
  readExperienceDefaultsConfig,
  readHeroBackdropOverridesConfig,
  readProviderMenuOrderConfig,
} from "@/lib/flags/flipt-admin";
import { buildDefaultAdminFlagState } from "@/lib/flags/flag-catalog";
import { DEFAULT_ANNOUNCEMENT_BANNER_CONFIG } from "@/lib/flags/announcement-banner";
import { DEFAULT_EXPERIENCE_DEFAULTS } from "@/lib/flags/experience-defaults";
import { DEFAULT_PROVIDER_MENU_ORDER } from "@/lib/flags/provider-menu-order";
import { DEFAULT_HERO_BACKDROP_OVERRIDES } from "@/lib/flags/hero-backdrop-overrides";
import { connection } from "next/server";

export const instant = false;

export default async function FfsAdminPage() {
  await connection();
  let flags = buildDefaultAdminFlagState();
  let announcementBanner = DEFAULT_ANNOUNCEMENT_BANNER_CONFIG;
  let providerMenuOrder = DEFAULT_PROVIDER_MENU_ORDER;
  let heroBackdropOverrides = DEFAULT_HERO_BACKDROP_OVERRIDES;
  let experienceDefaults = DEFAULT_EXPERIENCE_DEFAULTS;
  try {
    [
      flags,
      announcementBanner,
      providerMenuOrder,
      heroBackdropOverrides,
      experienceDefaults,
    ] = await Promise.all([
      readAdminFlagState(),
      readAnnouncementBannerConfig(),
      readProviderMenuOrderConfig(),
      readHeroBackdropOverridesConfig(),
      readExperienceDefaultsConfig(),
    ]);
  } catch (error) {
    console.warn("[ffs] failed to load flags for dashboard:", error);
  }

  return (
    <FfsDashboard
      initialFlags={flags}
      initialAnnouncementBanner={announcementBanner}
      initialProviderMenuOrder={providerMenuOrder}
      initialHeroBackdropOverrides={heroBackdropOverrides}
      initialExperienceDefaults={experienceDefaults}
    />
  );
}
