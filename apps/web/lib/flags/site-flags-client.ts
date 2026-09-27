"use client";

import type { SiteFlags } from "@/lib/flags/site-flags";

const FRESH_FOR_MS = 30_000;

type CacheEntry = {
  flags: SiteFlags;
  storedAt: number;
};

let cache: CacheEntry | null = null;
let inFlight: Promise<SiteFlags | null> | null = null;

export const resetSiteFlagsClientForTests = (): void => {
  cache = null;
  inFlight = null;
};

const readFreshCache = (): SiteFlags | null => {
  if (!cache) {
    return null;
  }
  if (Date.now() - cache.storedAt > FRESH_FOR_MS) {
    return null;
  }
  return cache.flags;
};

const loadSiteFlags = async (): Promise<SiteFlags | null> => {
  try {
    const response = await fetch("/api/site/flags", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const flags = (await response.json()) as SiteFlags;
    cache = { flags, storedAt: Date.now() };
    return flags;
  } catch {
    return null;
  }
};

export const fetchSiteFlags = (options?: {
  force?: boolean;
}): Promise<SiteFlags | null> => {
  if (!options?.force) {
    const fresh = readFreshCache();
    if (fresh) {
      return Promise.resolve(fresh);
    }
    if (inFlight) {
      return inFlight;
    }
  }

  const pending = loadSiteFlags().finally(() => {
    if (inFlight === pending) {
      inFlight = null;
    }
  });

  if (!options?.force) {
    inFlight = pending;
  }

  return pending;
};
