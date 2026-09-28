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
  | "global.ambient_glow_enabled"
  | "global.signup_disabled"
  | "global.auth_enabled"
  | "global.passkeys_enabled"
  | "global.no_ads_mode_default"
  | "global.default_proxy_playback"
  | "global.live_tv_enabled"
  | "global.scrape_proxy_required"
  | "global.lock_user_settings"
  | "global.announcement_banner"
  | "global.hero_backdrop_overrides"
  | "global.maintenance_mode"
  | "global.card_hover_previews"
  | "global.youtube_hover_fallback"
  | "global.adblock_prompt"
  | "global.devtools_trap"
  | "global.mal_sync"
  | "global.home_top10"
  | "global.experience_defaults";

export type ProviderFlagKind = "embed" | "scrape.tmdb" | "scrape.anime";

export type FlagDefinition = {
  key: string;
  defaultValue: boolean;
  label: string;
  description?: string;
  section: "playback" | "auth" | "power" | "surfaces" | "providers";
  providerKind?: ProviderFlagKind;
  providerId?: string;
  /**
   * Pure metadata carrier (holds JSON in Flipt metadata, configured by a
   * dedicated panel). Hidden from the generic toggle lists.
   */
  metadataOnly?: boolean;
};

export const GLOBAL_FLAG_DEFINITIONS: FlagDefinition[] = [
  {
    key: "global.proxy_mode_only",
    defaultValue: false,
    label: "Force proxy for everyone",
    description: "Hard lock: proxy only. Hides the iframe tab.",
    section: "playback",
  },
  {
    key: "global.iframe_mode_only",
    defaultValue: false,
    label: "Force iframe for everyone",
    description: "Hard lock: embed only. Hides the proxy tab.",
    section: "playback",
  },
  {
    key: "global.default_proxy_playback",
    defaultValue: false,
    label: "Default: proxy (iframe optional)",
    description:
      "New visitors start on proxy. Iframe stays in the server menu.",
    section: "playback",
  },
  {
    key: "global.no_ads_mode_default",
    defaultValue: false,
    label: "Default: no ads (hide iframe)",
    description:
      "New visitors get no-ads mode: proxy only, no iframe tab, no embed fallback.",
    section: "playback",
  },
  {
    key: "global.static_hero_backdrops",
    defaultValue: false,
    label: "Static hero backdrops",
    description: "Use backdrop images instead of Videasy hero trailers",
    section: "playback",
  },
  {
    key: "global.ambient_glow_enabled",
    defaultValue: false,
    label: "Ambient glow",
    description:
      "Allow the player ambient glow effect and the user setting to enable it.",
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
    key: "global.passkeys_enabled",
    defaultValue: false,
    label: "Passkeys",
    description:
      "Enable passkey sign-in, enrollment, management, and WebAuthn endpoints.",
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
    key: "global.announcement_banner",
    defaultValue: false,
    label: "Announcement banner",
    description: "Show the configured site-wide announcement",
    section: "power",
  },
  {
    key: "global.hero_backdrop_overrides",
    defaultValue: true,
    label: "Hero backdrop overrides",
    description: "Metadata carrier for per-title hero backdrop overrides",
    section: "power",
    metadataOnly: true,
  },
  {
    key: "global.maintenance_mode",
    defaultValue: false,
    label: "Maintenance mode",
    description: "Block playback/scrape only",
    section: "power",
  },
  {
    key: "global.card_hover_previews",
    defaultValue: true,
    label: "Card hover previews",
    description: "Trailer previews on catalog cards (desktop backdrop mode)",
    section: "surfaces",
  },
  {
    key: "global.youtube_hover_fallback",
    defaultValue: true,
    label: "YouTube hover fallback",
    description: "Use YouTube when Videasy trailer stream is unavailable",
    section: "surfaces",
  },
  {
    key: "global.adblock_prompt",
    defaultValue: true,
    label: "Adblock prompt",
    description: "Show adblock recommendation on embed playback",
    section: "surfaces",
  },
  {
    key: "global.devtools_trap",
    defaultValue: true,
    label: "Devtools trap",
    description: "Block fetches when browser devtools are open (production)",
    section: "surfaces",
  },
  {
    key: "global.mal_sync",
    defaultValue: true,
    label: "MAL sync",
    description: "MyAnimeList connect, sync, and list controls",
    section: "surfaces",
  },
  {
    key: "global.home_top10",
    defaultValue: true,
    label: "Home Top 10",
    description: "Top 10 Today row on the home hub",
    section: "surfaces",
  },
  {
    key: "global.experience_defaults",
    defaultValue: true,
    label: "Experience defaults",
    description: "Metadata carrier for site-wide preference defaults",
    section: "power",
    metadataOnly: true,
  },
  {
    key: "global.provider_menu_order",
    defaultValue: true,
    label: "Provider menu order",
    description: "Metadata carrier for server menu ordering",
    section: "power",
    metadataOnly: true,
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

export const PASSKEYS_FLAG_KEY = "global.passkeys_enabled";
export const AMBIENT_GLOW_FLAG_KEY = "global.ambient_glow_enabled";

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
  changedKey?: string,
): AdminFlagState {
  const next = { ...state };

  if (next["global.proxy_mode_only"] && next["global.iframe_mode_only"]) {
    next["global.iframe_mode_only"] = false;
  }

  if (next["global.proxy_mode_only"]) {
    next["global.default_proxy_playback"] = false;
    next["global.no_ads_mode_default"] = false;
  }

  if (next["global.iframe_mode_only"]) {
    next["global.default_proxy_playback"] = false;
    next["global.no_ads_mode_default"] = false;
  }

  if (
    next["global.no_ads_mode_default"] &&
    next["global.default_proxy_playback"]
  ) {
    if (changedKey === "global.default_proxy_playback") {
      next["global.no_ads_mode_default"] = false;
    } else {
      next["global.default_proxy_playback"] = false;
    }
  }

  return next;
}
