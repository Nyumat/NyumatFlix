export const PREFERRED_SCRAPE_PROVIDERS_STORAGE_KEY =
  "nyumatflix.scrape.preferred-providers";

type PreferredProviderEntry = {
  providerId: string;
  updatedAt: number;
};

type PreferredProviderMap = Record<string, PreferredProviderEntry>;

const readMap = (): PreferredProviderMap => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      PREFERRED_SCRAPE_PROVIDERS_STORAGE_KEY,
    );
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PreferredProviderMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map: PreferredProviderMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PREFERRED_SCRAPE_PROVIDERS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    void 0;
  }
};

export const getPreferredScrapeProvider = (mediaKey: string): string | null => {
  const entry = readMap()[mediaKey];
  if (!entry || typeof entry.providerId !== "string" || !entry.providerId) {
    return null;
  }

  return entry.providerId;
};

import { UNTRUSTED_PREFERRED_SCRAPE_PROVIDERS } from "@/lib/scrape/provider-race";

export const setPreferredScrapeProvider = (
  mediaKey: string,
  providerId: string,
): void => {
  if (
    !mediaKey ||
    !providerId ||
    UNTRUSTED_PREFERRED_SCRAPE_PROVIDERS.has(providerId)
  ) {
    return;
  }

  const map = readMap();
  map[mediaKey] = {
    providerId,
    updatedAt: Date.now(),
  };
  writeMap(map);
};

export const clearPreferredScrapeProvider = (mediaKey: string): void => {
  if (!mediaKey) {
    return;
  }

  const map = readMap();
  delete map[mediaKey];
  writeMap(map);
};
