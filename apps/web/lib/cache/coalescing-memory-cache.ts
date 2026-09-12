type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

export type CoalescingMemoryCacheOptions = {
  ttlMs: number;
  maxEntries?: number;
};

export class CoalescingMemoryCache {
  private readonly ttlMs: number;

  private readonly maxEntries: number;

  private readonly storage = new Map<string, CacheEntry>();

  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(options: CoalescingMemoryCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries ?? 250;
  }

  get<T>(key: string): T | undefined {
    const entry = this.storage.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.storage.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });

    if (this.storage.size <= this.maxEntries) {
      return;
    }

    const oldestKey = this.storage.keys().next().value;
    if (oldestKey) {
      this.storage.delete(oldestKey);
    }
  }

  async load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) {
      return hit;
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = loader()
      .then((result) => {
        this.set(key, result);
        return result;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }
}

const globalCaches = new Map<string, CoalescingMemoryCache>();

export const getCoalescingMemoryCache = (
  namespace: string,
  options: CoalescingMemoryCacheOptions,
): CoalescingMemoryCache => {
  const existing = globalCaches.get(namespace);
  if (existing) {
    return existing;
  }

  const created = new CoalescingMemoryCache(options);
  globalCaches.set(namespace, created);
  return created;
};
