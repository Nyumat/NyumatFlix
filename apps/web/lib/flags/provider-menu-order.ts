import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  EMBED_PROVIDER_REGISTRY,
  TMDB_SCRAPE_PROVIDER_ORDER,
} from "@/lib/providers/registry";

export type ProviderMenuOrderConfig = {
  embed: string[];
  tmdbScrape: string[];
  animeScrape: string[];
};

const defaultEmbedOrder = () =>
  EMBED_PROVIDER_REGISTRY.filter((entry) => entry.capabilities.embed).map(
    (entry) => entry.id,
  );

export const DEFAULT_PROVIDER_MENU_ORDER: ProviderMenuOrderConfig = {
  embed: defaultEmbedOrder(),
  tmdbScrape: [...TMDB_SCRAPE_PROVIDER_ORDER],
  animeScrape: [...ANIME_SCRAPE_PROVIDER_ORDER],
};

const uniqueIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const id = entry.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
};

export function applyProviderMenuOrder(
  defaults: readonly string[],
  customOrder: readonly string[],
): string[] {
  const valid = new Set(defaults);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of customOrder) {
    if (valid.has(id) && !seen.has(id)) {
      result.push(id);
      seen.add(id);
    }
  }

  for (const id of defaults) {
    if (!seen.has(id)) {
      result.push(id);
    }
  }

  return result;
}

export function sanitizeProviderMenuOrderConfig(
  value: unknown,
): ProviderMenuOrderConfig {
  const raw = value && typeof value === "object" ? value : {};
  const config = raw as Partial<Record<keyof ProviderMenuOrderConfig, unknown>>;

  return {
    embed: applyProviderMenuOrder(
      DEFAULT_PROVIDER_MENU_ORDER.embed,
      uniqueIds(config.embed),
    ),
    tmdbScrape: applyProviderMenuOrder(
      DEFAULT_PROVIDER_MENU_ORDER.tmdbScrape,
      uniqueIds(config.tmdbScrape),
    ),
    animeScrape: applyProviderMenuOrder(
      DEFAULT_PROVIDER_MENU_ORDER.animeScrape,
      uniqueIds(config.animeScrape),
    ),
  };
}

export function providerMenuOrderEquals(
  left: ProviderMenuOrderConfig,
  right: ProviderMenuOrderConfig,
): boolean {
  return (
    left.embed.join("\0") === right.embed.join("\0") &&
    left.tmdbScrape.join("\0") === right.tmdbScrape.join("\0") &&
    left.animeScrape.join("\0") === right.animeScrape.join("\0")
  );
}
