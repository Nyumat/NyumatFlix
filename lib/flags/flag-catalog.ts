import {
  ANIME_SCRAPE_PROVIDER_REGISTRY,
  EMBED_PROVIDER_REGISTRY,
  TMDB_SCRAPE_PROVIDER_REGISTRY,
  type AnimeScrapeProviderId,
  type EmbedProviderId,
  type TmdbScrapeProviderId,
} from "@/lib/providers/registry";

export type GlobalFlagKey =
  | "global.proxy_mode_only"
  | "global.iframe_mode_only"
  | "global.static_hero_backdrops"
  | "global.signup_disabled"
  | "global.auth_enabled"
  | "global.no_ads_mode_default"
  | "global.live_tv_enabled"
  | "global.scrape_proxy_required"
  | "global.lock_user_settings"
  | "global.maintenance_mode";

export type ProviderFlagKind = "embed" | "scrape.tmdb" | "scrape.anime";

export type FlagDefinition = {
  key: string;
  defaultValue: boolean;
  label: string;
  description?: string;
  section: "playback" | "auth" | "power" | "providers";
  providerKind?: ProviderFlagKind;
  providerId?: string;
};

export const GLOBAL_FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    key: "global.proxy_mode_only",
    defaultValue: false,
    label: "Proxy mode for all users",
    description: "Force scrape mode; hide iframe tab",
    section: "playback",
  },
  {
    key: "global.iframe_mode_only",
    defaultValue: false,
    label: "Iframe mode for all users",
    description: "Force embed mode; hide scrape tab",
    section: "playback",
  },
  {
    key: "global.static_hero_backdrops",
    defaultValue: false,
    label: "Static hero backdrops",
    description: "Disable dynamic Videasy hero trailers",
    section: "playback",
  },
  {
    key: "global.no_ads_mode_default",
    defaultValue: false,
    label: "Default no-ads / proxy",
    description: "Seed no-ads mode for new sessions",
    section: "playback",
  },
  {
    key: "global.live_tv_enabled",
    defaultValue: false,
    label: "Live TV",
    description: "Show /live routes and nav",
    section: "playback",
  },
  {
    key: "global.auth_enabled",
    defaultValue: true,
    label: "Auth enabled",
    description: "Allow sign-in and watchlist",
    section: "auth",
  },
  {
    key: "global.signup_disabled",
    defaultValue: false,
    label: "Disable signup",
    description: "Block new magic-link accounts",
    section: "auth",
  },
  {
    key: "global.scrape_proxy_required",
    defaultValue: false,
    label: "Require scrape proxy (VPN)",
    description: "Force proxy egress for scrape fetches",
    section: "power",
  },
  {
    key: "global.lock_user_settings",
    defaultValue: false,
    label: "Lock browse settings",
    description: "Hide user-facing proxy/hero toggles",
    section: "power",
  },
  {
    key: "global.maintenance_mode",
    defaultValue: false,
    label: "Maintenance mode",
    description: "Block playback/scrape only",
    section: "power",
  },
];

const embedProviders = EMBED_PROVIDER_REGISTRY.filter(
  (p) => p.capabilities.embed,
);

export const PROVIDER_FLAG_DEFINITIONS: FlagDefinition[] = [
  ...embedProviders.map((p) => ({
    key: `provider.embed.${p.id}.enabled`,
    defaultValue: true,
    label: p.name,
    section: "providers" as const,
    providerKind: "embed" as const,
    providerId: p.id,
  })),
  ...TMDB_SCRAPE_PROVIDER_REGISTRY.map((p) => ({
    key: `provider.scrape.tmdb.${p.id}.enabled`,
    defaultValue: true,
    label: p.name,
    section: "providers" as const,
    providerKind: "scrape.tmdb" as const,
    providerId: p.id,
  })),
  ...ANIME_SCRAPE_PROVIDER_REGISTRY.map((p) => ({
    key: `provider.scrape.anime.${p.id}.enabled`,
    defaultValue: true,
    label: p.name,
    section: "providers" as const,
    providerKind: "scrape.anime" as const,
    providerId: p.id,
  })),
];

export const ALL_FLAG_DEFINITIONS: FlagDefinition[] = [
  ...GLOBAL_FLAG_DEFINITIONS,
  ...PROVIDER_FLAG_DEFINITIONS,
];

export const ALL_FLAG_KEYS = ALL_FLAG_DEFINITIONS.map((d) => d.key);

export const DEFAULT_FLAG_VALUES: Record<string, boolean> = Object.fromEntries(
  ALL_FLAG_DEFINITIONS.map((d) => [d.key, d.defaultValue]),
);

export type AdminFlagState = Record<string, boolean>;

export function buildDefaultAdminFlagState(): AdminFlagState {
  return { ...DEFAULT_FLAG_VALUES };
}

export function embedProviderFlagKey(id: EmbedProviderId): string {
  return `provider.embed.${id}.enabled`;
}

export function tmdbScrapeProviderFlagKey(id: TmdbScrapeProviderId): string {
  return `provider.scrape.tmdb.${id}.enabled`;
}

export function animeScrapeProviderFlagKey(id: AnimeScrapeProviderId): string {
  return `provider.scrape.anime.${id}.enabled`;
}

export function applyPlaybackMutualExclusion(
  state: AdminFlagState,
): AdminFlagState {
  const next = { ...state };
  if (next["global.proxy_mode_only"] && next["global.iframe_mode_only"]) {
    next["global.iframe_mode_only"] = false;
  }
  return next;
}
