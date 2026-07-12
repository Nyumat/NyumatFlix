export const DEVELOPMENT_DATA_CACHE_TTL_MS = 60 * 60 * 1000;
const DEVELOPMENT_DATA_CACHE_MAX_ENTRIES = 500;

type CacheEntry = {
  expiresAt: number;
  value: Promise<unknown>;
};

type GetOrLoadOptions<T> = {
  key: string;
  load: () => Promise<T>;
  ttlMs?: number;
  now?: () => number;
  cacheResult?: (value: T) => boolean;
};

export class AsyncExpiringLruCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries: number) {}

  clear() {
    this.entries.clear();
  }

  async getOrLoad<T>({
    key,
    load,
    ttlMs = DEVELOPMENT_DATA_CACHE_TTL_MS,
    now = Date.now,
    cacheResult,
  }: GetOrLoadOptions<T>): Promise<T> {
    const cached = this.entries.get(key);
    const currentTime = now();

    if (cached && cached.expiresAt > currentTime) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.value as Promise<T>;
    }

    if (cached) this.entries.delete(key);

    const value = load();
    const entry: CacheEntry = {
      expiresAt: currentTime + Math.max(0, ttlMs),
      value,
    };
    this.entries.set(key, entry);
    this.evictOldestEntries();

    try {
      const result = await value;
      if (
        cacheResult &&
        !cacheResult(result) &&
        this.entries.get(key) === entry
      ) {
        this.entries.delete(key);
      }
      return result;
    } catch (error) {
      if (this.entries.get(key) === entry) {
        this.entries.delete(key);
      }
      throw error;
    }
  }

  private evictOldestEntries() {
    const limit = Math.max(1, this.maxEntries);
    while (this.entries.size > limit) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== "string") return;
      this.entries.delete(oldestKey);
    }
  }
}

type DevelopmentCacheGlobal = typeof globalThis & {
  __nyumatflixDevelopmentDataCache?: AsyncExpiringLruCache;
};

const getDevelopmentDataCache = () => {
  const globalStore = globalThis as DevelopmentCacheGlobal;
  globalStore.__nyumatflixDevelopmentDataCache ??= new AsyncExpiringLruCache(
    DEVELOPMENT_DATA_CACHE_MAX_ENTRIES,
  );
  return globalStore.__nyumatflixDevelopmentDataCache;
};

export const withDevelopmentDataCache = <T>(
  options: GetOrLoadOptions<T>,
): Promise<T> => {
  if (process.env.NODE_ENV !== "development") {
    return options.load();
  }

  return getDevelopmentDataCache().getOrLoad(options);
};

export const clearDevelopmentDataCache = () => {
  getDevelopmentDataCache().clear();
};
