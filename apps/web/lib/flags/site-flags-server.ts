import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  readAdminFlagStateStrict,
  readAnnouncementBannerConfig,
  readExperienceDefaultsConfig,
  readProviderMenuOrderConfig,
} from "@/lib/flags/flipt-client";
import {
  getDefaultSiteFlags,
  resolveSiteFlags,
  SITE_FLAGS_CACHE_TAG,
  type SiteFlags,
} from "@/lib/flags/site-flags";

const loadSiteFlags = async (): Promise<SiteFlags> => {
  const [raw, announcementConfig, menuOrder, experienceDefaults] =
    await Promise.all([
      readAdminFlagStateStrict(),
      readAnnouncementBannerConfig(),
      readProviderMenuOrderConfig(),
      readExperienceDefaultsConfig(),
    ]);
  return resolveSiteFlags(
    raw,
    announcementConfig,
    menuOrder,
    experienceDefaults,
  );
};

const readSiteFlags = async (): Promise<SiteFlags> => {
  try {
    return await loadSiteFlags();
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("[site-flags] flipt unavailable during build:", error);
      return getDefaultSiteFlags();
    }
    throw error;
  }
};

export async function getCachedSiteFlags(): Promise<SiteFlags> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 5, expire: 15 });
  cacheTag(SITE_FLAGS_CACHE_TAG);
  return readSiteFlags();
}

// root layout awaits this outside suspense, and that layout is the app shell.
// next omits a cache from the shell when stale or expire is under 5 minutes,
// which blocks prerender. ffs saves still bust this through the shared tag.
export async function getShellSiteFlags(): Promise<SiteFlags> {
  "use cache";
  cacheLife("hours");
  cacheTag(SITE_FLAGS_CACHE_TAG);
  return readSiteFlags();
}

export async function getSiteFlags(): Promise<SiteFlags> {
  return getCachedSiteFlags();
}
