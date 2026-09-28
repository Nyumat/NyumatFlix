type MetadataCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type MetadataCache<T> = {
  get: (key: string, load: () => Promise<T | null>) => Promise<T | null>;
  clear: () => void;
};

/** in-process ttl cache with in-flight dedupe; null results are never stored. */
export const createMetadataCache = <T>(options: {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}): MetadataCache<T> => {
  const now = options.now ?? Date.now;
  const entries = new Map<string, MetadataCacheEntry<T>>();
  const inFlight = new Map<string, Promise<T | null>>();

  const readFresh = (key: string): T | undefined => {
    const entry = entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  };

  const store = (key: string, value: T) => {
    entries.delete(key);
    entries.set(key, { value, expiresAt: now() + options.ttlMs });
    while (entries.size > options.maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      entries.delete(oldest);
    }
  };

  const get = async (
    key: string,
    load: () => Promise<T | null>,
  ): Promise<T | null> => {
    const cached = readFresh(key);
    if (cached !== undefined) {
      return cached;
    }

    const pending = inFlight.get(key);
    if (pending) {
      return pending;
    }

    const request = load()
      .then((value) => {
        if (value !== null) {
          store(key, value);
        }
        return value;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, request);
    return request;
  };

  const clear = () => {
    entries.clear();
    inFlight.clear();
  };

  return { get, clear };
};

export const SCRAPE_METADATA_TTL_MS = 6 * 60 * 60 * 1000;
export const SCRAPE_METADATA_MAX_ENTRIES = 500;
