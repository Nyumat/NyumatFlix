import "server-only";

import {
  DEFAULT_HERO_BACKDROP_OVERRIDES,
  findHeroBackdropOverride,
  type HeroBackdropOverrideEntry,
  type HeroBackdropOverrideMatch,
  type HeroBackdropOverridesConfig,
  withHeroBackdropOverride,
} from "@/lib/flags/hero-backdrop-overrides";
import { readHeroBackdropOverridesConfig } from "@/lib/flags/flipt-client";
import {
  applyDataCacheTags,
  applyDataRevalidateCacheLife,
} from "@/lib/server/route-cache-life";

export const HERO_BACKDROP_OVERRIDES_CACHE_TAG =
  "nyumatflix:hero-backdrop-overrides";

const loadHeroBackdropOverrides =
  async (): Promise<HeroBackdropOverridesConfig> => {
    try {
      return await readHeroBackdropOverridesConfig();
    } catch {
      return DEFAULT_HERO_BACKDROP_OVERRIDES;
    }
  };

export async function getHeroBackdropOverrides(): Promise<HeroBackdropOverridesConfig> {
  "use cache";
  applyDataRevalidateCacheLife(30);
  applyDataCacheTags(HERO_BACKDROP_OVERRIDES_CACHE_TAG);
  return loadHeroBackdropOverrides();
}

export function resolveHeroBackdropOverride(
  config: HeroBackdropOverridesConfig,
  match: HeroBackdropOverrideMatch,
): HeroBackdropOverrideEntry | null {
  return findHeroBackdropOverride(config, match);
}

export function applyHeroBackdropOverride<
  T extends { backdrop_path?: string | null },
>(
  item: T,
  config: HeroBackdropOverridesConfig,
  match: HeroBackdropOverrideMatch,
): T {
  return withHeroBackdropOverride(
    item,
    resolveHeroBackdropOverride(config, match),
  );
}
