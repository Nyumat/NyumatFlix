import type { IndexFeatureHeroItem } from "@/components/catalog/index-feature-hero";
import type {
  HeroBackdropOverrideEntry,
  HeroBackdropOverrideMediaType,
  HeroBackdropOverridesConfig,
} from "@/lib/flags/hero-backdrop-overrides";
import { sanitizeHeroBackdropOverridesConfig } from "@/lib/flags/hero-backdrop-overrides";

export const HERO_FEATURED_MAX_ITEMS = 5;

export type HeroFeaturedHubKind = "movie" | "tv" | "anime";

export const HERO_FEATURED_HUB_MEDIA_TYPES: Record<
  HeroFeaturedHubKind,
  readonly HeroBackdropOverrideMediaType[]
> = {
  movie: ["movie"],
  tv: ["tv"],
  anime: ["anime"],
};

type IndexHeroItemWithSource = IndexFeatureHeroItem & {
  sourceAnilistId?: number;
};

export const heroFeaturedEntryIdentityKeys = (
  entry: HeroBackdropOverrideEntry,
): string[] => {
  const keys: string[] = [];
  if (entry.tmdbId) {
    keys.push(`${entry.mediaType}:tmdb:${entry.tmdbId}`);
    if (entry.mediaType === "anime") {
      keys.push(`movie:tmdb:${entry.tmdbId}`);
      keys.push(`tv:tmdb:${entry.tmdbId}`);
    }
  }
  if (entry.anilistId) {
    keys.push(`anime:anilist:${entry.anilistId}`);
  }
  if (entry.malId) {
    keys.push(`anime:mal:${entry.malId}`);
  }
  return keys;
};

export const heroFeaturedItemIdentityKeys = (
  item: IndexFeatureHeroItem,
): string[] => {
  const keys: string[] = [];
  const extended = item as IndexHeroItemWithSource;

  if (
    typeof extended.sourceAnilistId === "number" &&
    Number.isInteger(extended.sourceAnilistId) &&
    extended.sourceAnilistId > 0
  ) {
    keys.push(`anime:anilist:${extended.sourceAnilistId}`);
  }

  if (typeof item.id === "number" && Number.isInteger(item.id) && item.id > 0) {
    const mediaType = item.media_type ?? "movie";
    if (mediaType === "movie" || mediaType === "tv") {
      keys.push(`${mediaType}:tmdb:${item.id}`);
    }
  }

  return keys;
};

export const selectFeaturedEntriesForHub = (
  config: HeroBackdropOverridesConfig,
  hubKind: HeroFeaturedHubKind,
): HeroBackdropOverrideEntry[] => {
  const allowed = new Set(HERO_FEATURED_HUB_MEDIA_TYPES[hubKind]);
  return config.entries.filter((entry) => allowed.has(entry.mediaType));
};

export const featuredPinCountForHub = (
  config: HeroBackdropOverridesConfig,
  hubKind: HeroFeaturedHubKind,
): number => selectFeaturedEntriesForHub(config, hubKind).length;

export const canAddFeaturedPinForHub = (
  config: HeroBackdropOverridesConfig,
  hubKind: HeroFeaturedHubKind,
): boolean => featuredPinCountForHub(config, hubKind) < HERO_FEATURED_MAX_ITEMS;

export const hubKindForMediaType = (
  mediaType: HeroBackdropOverrideMediaType,
): HeroFeaturedHubKind | null => {
  if (mediaType === "movie") return "movie";
  if (mediaType === "tv") return "tv";
  if (mediaType === "anime") return "anime";
  return null;
};

export const hubKindToMediaType = (
  hubKind: HeroFeaturedHubKind,
): HeroBackdropOverrideMediaType => hubKind;

export const mergeFeaturedHeroItems = (
  pinned: IndexFeatureHeroItem[],
  automatic: IndexFeatureHeroItem[],
  maxItems = HERO_FEATURED_MAX_ITEMS,
): IndexFeatureHeroItem[] => {
  const merged: IndexFeatureHeroItem[] = [];
  const seen = new Set<string>();

  const tryAdd = (item: IndexFeatureHeroItem) => {
    if (merged.length >= maxItems) return;
    const keys = heroFeaturedItemIdentityKeys(item);
    if (keys.some((key) => seen.has(key))) return;
    for (const key of keys) {
      seen.add(key);
    }
    merged.push(item);
  };

  for (const item of pinned) {
    tryAdd(item);
  }

  for (const item of automatic) {
    tryAdd(item);
  }

  return merged;
};

export function reorderHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  key: string,
  direction: "up" | "down",
): HeroBackdropOverridesConfig {
  const index = config.entries.findIndex((entry) => entry.key === key);
  if (index === -1) return config;

  const mediaType = config.entries[index]?.mediaType;
  if (!mediaType) return config;

  let swapIndex = index;
  if (direction === "up") {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (config.entries[cursor]?.mediaType === mediaType) {
        swapIndex = cursor;
        break;
      }
    }
  } else {
    for (let cursor = index + 1; cursor < config.entries.length; cursor += 1) {
      if (config.entries[cursor]?.mediaType === mediaType) {
        swapIndex = cursor;
        break;
      }
    }
  }

  if (swapIndex === index) return config;

  const entries = [...config.entries];
  const current = entries[index];
  const swap = entries[swapIndex];
  if (!current || !swap) return config;

  entries[index] = swap;
  entries[swapIndex] = current;

  return sanitizeHeroBackdropOverridesConfig({ version: 1, entries });
}
