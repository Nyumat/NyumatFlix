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
import {
  DEFAULT_ANNOUNCEMENT_BANNER_CONFIG,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  applyProviderMenuOrder,
  DEFAULT_PROVIDER_MENU_ORDER,
  type ProviderMenuOrderConfig,
} from "@/lib/flags/provider-menu-order";
import {
  DEFAULT_EXPERIENCE_DEFAULTS,
  sanitizeExperienceDefaultsConfig,
  type ExperienceDefaultsConfig,
} from "@/lib/flags/experience-defaults";
import { SITE_FLAGS_CACHE_TAG } from "@/lib/flags/site-flags-cache-tag";
import { computePolicyGeneration } from "@/lib/flags/policy-generation";
import type { VideoServer } from "@/lib/stores/video-servers";
import { videoServers } from "@/lib/stores/video-servers";

export type SiteFlags = {
  policyGeneration: string;
  proxyModeOnly: boolean;
  iframeModeOnly: boolean;
  staticHeroBackdrops: boolean;
  ambientGlowEnabled: boolean;
  signupDisabled: boolean;
  authEnabled: boolean;
  passkeysEnabled: boolean;
  noAdsModeDefault: boolean;
  /** Choice mode: prefer scrape/proxy without hiding iframe. */
  defaultProxyPlayback: boolean;
  liveTvEnabled: boolean;
  scrapeProxyRequired: boolean;
  lockUserSettings: boolean;
  maintenanceMode: boolean;
  cardHoverPreviews: boolean;
  youtubeHoverFallback: boolean;
  adblockPrompt: boolean;
  devtoolsTrap: boolean;
  malSync: boolean;
  homeTop10: boolean;
  experienceDefaults: ExperienceDefaultsConfig;
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
  experienceDefaultsConfig: ExperienceDefaultsConfig = DEFAULT_EXPERIENCE_DEFAULTS,
): SiteFlags {
  const proxyModeOnly = raw["global.proxy_mode_only"] ?? false;
  const iframeModeOnly = raw["global.iframe_mode_only"] ?? false;
  const staticHeroBackdrops = raw["global.static_hero_backdrops"] ?? false;
  const lockUserSettings = raw["global.lock_user_settings"] ?? false;

  const embedIds = EMBED_PROVIDER_REGISTRY.filter(
    (p) => p.capabilities.embed,
  ).map((p) => p.id);

  const flagsWithoutGeneration = {
    proxyModeOnly,
    iframeModeOnly: proxyModeOnly ? false : iframeModeOnly,
    staticHeroBackdrops,
    ambientGlowEnabled: raw["global.ambient_glow_enabled"] ?? false,
    signupDisabled: raw["global.signup_disabled"] ?? false,
    authEnabled: raw["global.auth_enabled"] ?? true,
    passkeysEnabled: raw["global.passkeys_enabled"] ?? false,
    noAdsModeDefault: raw["global.no_ads_mode_default"] ?? false,
    defaultProxyPlayback: raw["global.default_proxy_playback"] ?? false,
    liveTvEnabled: raw["global.live_tv_enabled"] ?? false,
    scrapeProxyRequired: raw["global.scrape_proxy_required"] ?? false,
    lockUserSettings,
    maintenanceMode: raw["global.maintenance_mode"] ?? false,
    cardHoverPreviews: raw["global.card_hover_previews"] ?? true,
    youtubeHoverFallback: raw["global.youtube_hover_fallback"] ?? true,
    adblockPrompt: raw["global.adblock_prompt"] ?? true,
    devtoolsTrap: raw["global.devtools_trap"] ?? true,
    malSync: raw["global.mal_sync"] ?? true,
    homeTop10: raw["global.home_top10"] ?? true,
    experienceDefaults: sanitizeExperienceDefaultsConfig(
      experienceDefaultsConfig,
    ),
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
  } satisfies Omit<SiteFlags, "policyGeneration">;

  return {
    ...flagsWithoutGeneration,
    policyGeneration: computePolicyGeneration(flagsWithoutGeneration),
  };
}

export { SITE_FLAGS_CACHE_TAG };

export function getDefaultSiteFlags(): SiteFlags {
  return resolveSiteFlags(DEFAULT_FLAG_VALUES);
}

export function getPlaybackModePolicy(flags: SiteFlags): PlaybackModePolicy {
  if (flags.proxyModeOnly) return "proxy";
  if (flags.iframeModeOnly) return "iframe";
  return "choice";
}

export function canOfferEmbedPlayback(input: {
  flagsReady: boolean;
  proxyModeOnly: boolean;
  iframeModeOnly: boolean;
  noAdsMode: boolean;
}): boolean {
  if (!input.flagsReady) return false;
  if (input.proxyModeOnly) return false;
  if (input.iframeModeOnly) return true;
  return !input.noAdsMode;
}

export function shouldSeedDefaultProxyPlayback(input: {
  policy: PlaybackModePolicy;
  defaultProxyPlayback: boolean;
  hasUserSelectedPlaybackServer: boolean;
  selectedServerIsScrape: boolean;
}): boolean {
  return (
    input.policy === "choice" &&
    input.defaultProxyPlayback &&
    !input.hasUserSelectedPlaybackServer &&
    !input.selectedServerIsScrape
  );
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
