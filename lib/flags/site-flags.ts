import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  EMBED_PROVIDER_REGISTRY,
  TMDB_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeProviderId,
  type EmbedProviderId,
  type TmdbScrapeProviderId,
} from "@/lib/providers/registry";
import { isDirectScrapeProviderConfigured } from "@/lib/scrape/calluspirates-config";
import {
  animeScrapeProviderFlagKey,
  DEFAULT_FLAG_VALUES,
  embedProviderFlagKey,
  tmdbScrapeProviderFlagKey,
} from "@/lib/flags/flag-catalog";
import { readAdminFlagState } from "@/lib/flags/flipt-client";
import {
  readAnnouncementBannerConfig,
  readProviderMenuOrderConfig,
} from "@/lib/flags/flipt-client";
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  applyProviderMenuOrder,
  DEFAULT_PROVIDER_MENU_ORDER,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import type { VideoServer } from "@/lib/stores/video-servers";
import { videoServers } from "@/lib/stores/video-servers";

export type SiteFlags = {
  proxyModeOnly: boolean;
  iframeModeOnly: boolean;
  staticHeroBackdrops: boolean;
  signupDisabled: boolean;
  authEnabled: boolean;
  noAdsModeDefault: boolean;
  /** Choice mode: prefer scrape/proxy without hiding iframe. */
  defaultProxyPlayback: boolean;
  liveTvEnabled: boolean;
  scrapeProxyRequired: boolean;
  lockUserSettings: boolean;
  maintenanceMode: boolean;
  announcementBanner: AnnouncementBannerConfig & { enabled: boolean };
  /** Resolved on the server; client must not re-read CALLUSPIRATES_API_URL. */
  directScrapeProviderAvailable: boolean;
  embedProviders: Record<string, boolean>;
  tmdbScrapeProviders: Record<string, boolean>;
  animeScrapeProviders: Record<string, boolean>;
  providerMenuOrder: ProviderMenuOrderConfig;
  locks: {
    playbackMode: boolean;
    heroTrailers: boolean;
    browseSettings: boolean;
  };
};

export type PlaybackModePolicy = "proxy" | "iframe" | "choice";

function providerMap(
  ids: readonly string[],
  keyFn: (id: string) => string,
  raw: Record<string, boolean>,
): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, raw[keyFn(id)] ?? true]));
}

export function resolveSiteFlags(
  raw: Record<string, boolean>,
  announcementConfig: AnnouncementBannerConfig = DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  providerMenuOrder: ProviderMenuOrderConfig = DEFAULT_PROVIDER_MENU_ORDER,
): SiteFlags {
  const proxyModeOnly = raw["global.proxy_mode_only"] ?? false;
  const iframeModeOnly = raw["global.iframe_mode_only"] ?? false;
  const staticHeroBackdrops = raw["global.static_hero_backdrops"] ?? false;
  const lockUserSettings = raw["global.lock_user_settings"] ?? false;

  const embedIds = EMBED_PROVIDER_REGISTRY.filter(
    (p) => p.capabilities.embed,
  ).map((p) => p.id);

  return {
    proxyModeOnly,
    iframeModeOnly: proxyModeOnly ? false : iframeModeOnly,
    staticHeroBackdrops,
    signupDisabled: raw["global.signup_disabled"] ?? false,
    authEnabled: raw["global.auth_enabled"] ?? true,
    noAdsModeDefault: raw["global.no_ads_mode_default"] ?? false,
    defaultProxyPlayback: raw["global.default_proxy_playback"] ?? false,
    liveTvEnabled: raw["global.live_tv_enabled"] ?? false,
    scrapeProxyRequired: raw["global.scrape_proxy_required"] ?? false,
    lockUserSettings,
    maintenanceMode: raw["global.maintenance_mode"] ?? false,
    announcementBanner: {
      ...announcementConfig,
      enabled: raw["global.announcement_banner"] ?? false,
    },
    directScrapeProviderAvailable: isDirectScrapeProviderConfigured(),
    embedProviders: providerMap(
      embedIds,
      (id) => embedProviderFlagKey(id as EmbedProviderId),
      raw,
    ),
    tmdbScrapeProviders: providerMap(
      TMDB_SCRAPE_PROVIDER_ORDER,
      (id) => tmdbScrapeProviderFlagKey(id as TmdbScrapeProviderId),
      raw,
    ),
    animeScrapeProviders: providerMap(
      ANIME_SCRAPE_PROVIDER_ORDER,
      (id) => animeScrapeProviderFlagKey(id as AnimeScrapeProviderId),
      raw,
    ),
    providerMenuOrder,
    locks: {
      playbackMode: proxyModeOnly || iframeModeOnly,
      heroTrailers: staticHeroBackdrops || lockUserSettings,
      browseSettings: lockUserSettings,
    },
  };
}

export async function getSiteFlags(options?: {
  skipCache?: boolean;
}): Promise<SiteFlags> {
  const [raw, announcementConfig, menuOrder] = await Promise.all([
    readAdminFlagState(options),
    readAnnouncementBannerConfig(),
    readProviderMenuOrderConfig(),
  ]);
  return resolveSiteFlags(raw, announcementConfig, menuOrder);
}

export function getDefaultSiteFlags(): SiteFlags {
  return resolveSiteFlags(DEFAULT_FLAG_VALUES);
}

export function getPlaybackModePolicy(flags: SiteFlags): PlaybackModePolicy {
  if (flags.proxyModeOnly) return "proxy";
  if (flags.iframeModeOnly) return "iframe";
  return "choice";
}

export function isEmbedProviderEnabled(
  flags: SiteFlags,
  id: EmbedProviderId | string,
): boolean {
  return flags.embedProviders[id] ?? true;
}

export function isTmdbScrapeProviderEnabled(
  flags: SiteFlags,
  id: TmdbScrapeProviderId | string,
): boolean {
  if (id === "direct" && !flags.directScrapeProviderAvailable) {
    return false;
  }
  return flags.tmdbScrapeProviders[id] ?? true;
}

export function isAnimeScrapeProviderEnabled(
  flags: SiteFlags,
  id: AnimeScrapeProviderId | string,
): boolean {
  return flags.animeScrapeProviders[id] ?? true;
}

export function filterEmbedProviderIds(
  flags: SiteFlags,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => isEmbedProviderEnabled(flags, id));
}

export function filterTmdbScrapeProviderIds(
  flags: SiteFlags,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => isTmdbScrapeProviderEnabled(flags, id));
}

export function filterAnimeScrapeProviderIds(
  flags: SiteFlags,
  ids: readonly string[],
): string[] {
  return ids.filter((id) => isAnimeScrapeProviderEnabled(flags, id));
}

export function getEmbedProviderMenuOrder(flags: SiteFlags): string[] {
  return applyProviderMenuOrder(
    DEFAULT_PROVIDER_MENU_ORDER.embed,
    flags.providerMenuOrder.embed,
  );
}

export function getTmdbScrapeProviderMenuOrder(flags: SiteFlags): string[] {
  return applyProviderMenuOrder(
    DEFAULT_PROVIDER_MENU_ORDER.tmdbScrape,
    flags.providerMenuOrder.tmdbScrape,
  );
}

export function getAnimeScrapeProviderMenuOrder(flags: SiteFlags): string[] {
  return applyProviderMenuOrder(
    DEFAULT_PROVIDER_MENU_ORDER.animeScrape,
    flags.providerMenuOrder.animeScrape,
  );
}

export function getAnimePlaybackProviderOrders(flags: SiteFlags): {
  animeOrder: AnimeScrapeProviderId[];
  tmdbOrder: TmdbScrapeProviderId[];
} {
  return {
    animeOrder: getAnimeScrapeProviderMenuOrder(
      flags,
    ) as AnimeScrapeProviderId[],
    tmdbOrder: getTmdbScrapeProviderMenuOrder(flags) as TmdbScrapeProviderId[],
  };
}

export function orderVideoServersByMenu(
  flags: SiteFlags,
  servers: readonly VideoServer[] = videoServers,
): VideoServer[] {
  const order = getEmbedProviderMenuOrder(flags);
  const byId = new Map(servers.map((server) => [server.id, server] as const));
  const seen = new Set<string>();
  const ordered: VideoServer[] = [];

  for (const id of order) {
    const server = byId.get(id);
    if (server && !seen.has(id)) {
      ordered.push(server);
      seen.add(id);
    }
  }

  for (const server of servers) {
    if (!seen.has(server.id)) {
      ordered.push(server);
    }
  }

  return ordered;
}
