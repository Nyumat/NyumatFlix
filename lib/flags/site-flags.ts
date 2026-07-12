import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  EMBED_PROVIDER_REGISTRY,
  TMDB_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeProviderId,
  type EmbedProviderId,
  type TmdbScrapeProviderId,
} from "@/lib/providers/registry";
import {
  animeScrapeProviderFlagKey,
  DEFAULT_FLAG_VALUES,
  embedProviderFlagKey,
  tmdbScrapeProviderFlagKey,
} from "@/lib/flags/flag-catalog";
import { readAdminFlagState } from "@/lib/flags/flipt-client";

export type SiteFlags = {
  proxyModeOnly: boolean;
  iframeModeOnly: boolean;
  staticHeroBackdrops: boolean;
  signupDisabled: boolean;
  authEnabled: boolean;
  noAdsModeDefault: boolean;
  liveTvEnabled: boolean;
  scrapeProxyRequired: boolean;
  lockUserSettings: boolean;
  maintenanceMode: boolean;
  embedProviders: Record<string, boolean>;
  tmdbScrapeProviders: Record<string, boolean>;
  animeScrapeProviders: Record<string, boolean>;
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

export function resolveSiteFlags(raw: Record<string, boolean>): SiteFlags {
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
    liveTvEnabled: raw["global.live_tv_enabled"] ?? false,
    scrapeProxyRequired: raw["global.scrape_proxy_required"] ?? false,
    lockUserSettings,
    maintenanceMode: raw["global.maintenance_mode"] ?? false,
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
    locks: {
      playbackMode: proxyModeOnly || iframeModeOnly,
      heroTrailers: staticHeroBackdrops || lockUserSettings,
      browseSettings: lockUserSettings,
    },
  };
}

export async function getSiteFlags(): Promise<SiteFlags> {
  const raw = await readAdminFlagState();
  return resolveSiteFlags(raw);
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
