import type { ScrapePlaybackPayload } from "@/lib/playback/to-playable-manifest";
import type { ScrapeItemStatus } from "@/lib/scrape/types";

export const SOURCE_LOOKUP_CACHE_MAX_ENTRIES = 3;
export const SOURCE_LOOKUP_CACHE_TTL_MS = 60_000;

export type SourceLookupItemPatch = {
  providerId: string;
  status: ScrapeItemStatus;
  error?: string;
};

export type SourceLookupWinner = {
  providerId: string;
  payload: ScrapePlaybackPayload;
  subtitlesDeferred?: boolean;
};

export type SourceLookupRunner = (context: {
  signal: AbortSignal;
  reportItem: (patch: SourceLookupItemPatch) => void;
}) => Promise<SourceLookupWinner | null>;

export type SourceLookupOutcome = {
  winner: SourceLookupWinner | null;
  cached: boolean;
};

export type SourceLookupOptions = {
  signal?: AbortSignal;
  onItem?: (patch: SourceLookupItemPatch) => void;
  fresh?: boolean;
};

type InFlightLookup = {
  controller: AbortController;
  promise: Promise<SourceLookupWinner | null>;
  holders: number;
  listeners: Set<(patch: SourceLookupItemPatch) => void>;
  items: Map<string, SourceLookupItemPatch>;
};

type ResolvedLookup = {
  winner: SourceLookupWinner;
  resolvedAt: number;
};

export type SourceLookupCache = {
  lookup: (
    key: string,
    run: SourceLookupRunner,
    options?: SourceLookupOptions,
  ) => Promise<SourceLookupOutcome>;
  peek: (key: string) => SourceLookupWinner | null;
  isInFlight: (key: string) => boolean;
  replace: (key: string, winner: SourceLookupWinner) => void;
  evict: (key: string) => void;
  clear: () => void;
};

export const createSourceLookupCache = ({
  maxEntries = SOURCE_LOOKUP_CACHE_MAX_ENTRIES,
  ttlMs = SOURCE_LOOKUP_CACHE_TTL_MS,
  now = Date.now,
  releaseGraceMs = 0,
}: {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
  releaseGraceMs?: number;
} = {}): SourceLookupCache => {
  const resolved = new Map<string, ResolvedLookup>();
  const inFlight = new Map<string, InFlightLookup>();

  const peek = (key: string): SourceLookupWinner | null => {
    const entry = resolved.get(key);
    if (!entry) {
      return null;
    }
    if (now() - entry.resolvedAt > ttlMs) {
      resolved.delete(key);
      return null;
    }
    return entry.winner;
  };

  const store = (key: string, winner: SourceLookupWinner) => {
    resolved.delete(key);
    resolved.set(key, { winner, resolvedAt: now() });
    while (resolved.size > maxEntries) {
      const oldest = resolved.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      resolved.delete(oldest);
    }
  };

  const start = (key: string, run: SourceLookupRunner): InFlightLookup => {
    const controller = new AbortController();
    const listeners = new Set<(patch: SourceLookupItemPatch) => void>();
    const items = new Map<string, SourceLookupItemPatch>();

    const reportItem = (patch: SourceLookupItemPatch) => {
      if (controller.signal.aborted) {
        return;
      }
      items.set(patch.providerId, patch);
      for (const listener of listeners) {
        listener(patch);
      }
    };

    const promise = run({ signal: controller.signal, reportItem })
      .catch(() => null)
      .then((winner) => {
        if (inFlight.get(key) === entry) {
          inFlight.delete(key);
        }
        if (!winner || controller.signal.aborted) {
          return null;
        }
        store(key, winner);
        return winner;
      });

    const entry: InFlightLookup = {
      controller,
      promise,
      holders: 0,
      listeners,
      items,
    };
    inFlight.set(key, entry);
    return entry;
  };

  const lookup = (
    key: string,
    run: SourceLookupRunner,
    options?: SourceLookupOptions,
  ): Promise<SourceLookupOutcome> => {
    if (options?.fresh) {
      resolved.delete(key);
    } else {
      const hit = peek(key);
      if (hit) {
        return Promise.resolve({ winner: hit, cached: true });
      }
    }

    const entry = inFlight.get(key) ?? start(key, run);
    entry.holders += 1;
    const onItem = options?.onItem;
    if (onItem) {
      for (const patch of entry.items.values()) {
        onItem(patch);
      }
      entry.listeners.add(onItem);
    }

    return new Promise<SourceLookupOutcome>((resolve) => {
      let released = false;
      const signal = options?.signal;

      const release = () => {
        if (released) {
          return;
        }
        released = true;
        if (onItem) {
          entry.listeners.delete(onItem);
        }
        signal?.removeEventListener("abort", handleAbort);
        entry.holders -= 1;
        if (entry.holders > 0) {
          return;
        }
        // a caller in the same commit (prefetch cleanup, then play) may still join.
        setTimeout(() => {
          if (entry.holders <= 0 && inFlight.get(key) === entry) {
            inFlight.delete(key);
            entry.controller.abort();
          }
        }, releaseGraceMs);
      };

      const handleAbort = () => {
        release();
        resolve({ winner: null, cached: false });
      };

      if (signal?.aborted) {
        handleAbort();
        return;
      }
      signal?.addEventListener("abort", handleAbort, { once: true });

      void entry.promise.then((winner) => {
        if (released) {
          return;
        }
        release();
        resolve({ winner, cached: false });
      });
    });
  };

  const replace = (key: string, winner: SourceLookupWinner) => {
    const entry = resolved.get(key);
    if (!entry) {
      return;
    }
    resolved.set(key, { ...entry, winner });
  };

  return {
    lookup,
    peek,
    isInFlight: (key) => inFlight.has(key),
    replace,
    evict: (key) => {
      resolved.delete(key);
    },
    clear: () => {
      for (const entry of inFlight.values()) {
        entry.controller.abort();
      }
      inFlight.clear();
      resolved.clear();
    },
  };
};

export const buildSourceLookupKey = ({
  lookupKey,
  providerOrder,
  pinnedProviderId,
}: {
  lookupKey: string;
  providerOrder: readonly string[];
  pinnedProviderId?: string;
}): string =>
  [lookupKey, pinnedProviderId ?? "auto", providerOrder.join(",")].join("|");

export const sourceLookupCache = createSourceLookupCache();
