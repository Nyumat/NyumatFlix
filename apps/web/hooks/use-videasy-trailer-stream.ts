"use client";

import type { CardPreviewSource } from "@/lib/catalog-card-presentation";
import { useCallback, useEffect, useRef, useState } from "react";

export type VideasyTrailerStreamStatus = "idle" | "loading" | "ready" | "error";

export interface UseVideasyTrailerStreamResult {
  mp4Url: string | null;
  hlsUrl: string | null;
  status: VideasyTrailerStreamStatus;
  handleStreamError: () => void;
}

const MAX_STREAM_RETRIES = 2;
const STREAM_CACHE_TTL_MS = 120_000;
const INITIAL_STREAM_DELAY_MS = 2500;
const STREAM_IDLE_TIMEOUT_MS = 2000;
const PREFETCH_CONCURRENCY = 3;
const PREFETCH_QUEUE_MAX = 6;

type TrailerStreams = { mp4: string | null; hls: string | null };

type TrailerStreamCacheEntry = {
  expiresAt: number;
  promise: Promise<TrailerStreams>;
};

const streamCache = new Map<string, TrailerStreamCacheEntry>();

const isStreamSource = (
  source: CardPreviewSource | undefined,
): source is CardPreviewSource &
  ({ imdbId: string } | { tmdbId: number; mediaType: "movie" | "tv" }) =>
  Boolean(
    source &&
      (source.imdbId?.startsWith("tt") ||
        (source.tmdbId && source.tmdbId > 0 && source.mediaType)),
  );

const buildStreamCacheKey = (
  source: CardPreviewSource &
    ({ imdbId: string } | { tmdbId: number; mediaType: "movie" | "tv" }),
): string => source.imdbId ?? `${source.mediaType}:${source.tmdbId}`;

const buildStreamQuery = (
  source: CardPreviewSource &
    ({ imdbId: string } | { tmdbId: number; mediaType: "movie" | "tv" }),
): string => {
  if (source.imdbId) {
    return `imdbId=${encodeURIComponent(source.imdbId)}`;
  }
  return `tmdbId=${encodeURIComponent(String(source.tmdbId))}&mediaType=${encodeURIComponent(
    source.mediaType as string,
  )}`;
};

const parseBody = (
  body: unknown,
): { mp4: string | null; hls: string | null } => {
  if (!body || typeof body !== "object") {
    return { mp4: null, hls: null };
  }
  const o = body as { url?: unknown; hlsUrl?: unknown };
  const mp4 = typeof o.url === "string" && o.url.length > 0 ? o.url : null;
  const hls =
    typeof o.hlsUrl === "string" && o.hlsUrl.length > 0 ? o.hlsUrl : null;
  return { mp4, hls };
};

const fetchTrailerStreams = async (
  source: CardPreviewSource &
    ({ imdbId: string } | { tmdbId: number; mediaType: "movie" | "tv" }),
): Promise<TrailerStreams> => {
  const res = await fetch(`/api/trailers/videasy?${buildStreamQuery(source)}`, {
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);

  // Never throw: a failed fetch (404/502/network) is surfaced the same way
  // as "no trailer available" — empty streams. All consumers gate on a
  // non-null URL, so playback simply falls back; actual playback failures
  // still trigger retries via handleStreamError on the video element.
  return res.ok ? parseBody(body) : { mp4: null, hls: null };
};

const getTrailerStreams = (
  source: CardPreviewSource &
    ({ imdbId: string } | { tmdbId: number; mediaType: "movie" | "tv" }),
): Promise<TrailerStreams> => {
  const key = buildStreamCacheKey(source);
  const cached = streamCache.get(key);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchTrailerStreams(source);
  streamCache.set(key, {
    expiresAt: now + STREAM_CACHE_TTL_MS,
    promise,
  });
  promise.catch(() => {
    if (streamCache.get(key)?.promise === promise) {
      streamCache.delete(key);
    }
  });

  return promise;
};

/**
 * Fire-and-forget warm-up used by the intersection-observer card prefetch.
 * Shares the same cache/inflight map as the hook, so a later hover resolves
 * from cache. Concurrency is bounded so a fast scroll can't stampede the API.
 */
const prefetchQueue: Array<() => void> = [];
let activePrefetches = 0;

const drainPrefetchQueue = () => {
  while (activePrefetches < PREFETCH_CONCURRENCY && prefetchQueue.length > 0) {
    const next = prefetchQueue.shift();
    if (!next) return;
    activePrefetches += 1;
    next();
  }
};

const isFreshlyCached = (key: string): boolean => {
  const cached = streamCache.get(key);
  return Boolean(cached && cached.expiresAt > Date.now());
};

export const prefetchTrailerStream = (
  source: CardPreviewSource | undefined,
): void => {
  if (typeof window === "undefined" || !isStreamSource(source)) {
    return;
  }

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (
    connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  ) {
    return;
  }

  const key = buildStreamCacheKey(source);
  if (isFreshlyCached(key) || prefetchQueue.length >= PREFETCH_QUEUE_MAX) {
    return;
  }

  prefetchQueue.push(() => {
    getTrailerStreams(source).finally(() => {
      activePrefetches -= 1;
      drainPrefetchQueue();
    });
  });
  drainPrefetchQueue();
};

export const useVideasyTrailerStream = (
  source: CardPreviewSource | undefined,
  enabled: boolean,
  options?: { initialStreamDelayMs?: number },
): UseVideasyTrailerStreamResult => {
  const [mp4Url, setMp4Url] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideasyTrailerStreamStatus>("idle");
  const retryCountRef = useRef(0);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const eligible = isStreamSource(source);
  const sourceKey = eligible ? buildStreamCacheKey(source) : null;
  const initialStreamDelayMs =
    options?.initialStreamDelayMs ?? INITIAL_STREAM_DELAY_MS;

  const loadStreams = useCallback(async (options?: { isRetry?: boolean }) => {
    const current = sourceRef.current;
    if (!isStreamSource(current)) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!options?.isRetry) {
      retryCountRef.current = 0;
    }

    setStatus("loading");
    setMp4Url(null);
    setHlsUrl(null);
    loadingRef.current = true;

    try {
      const streams = await getTrailerStreams(current);

      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }

      setMp4Url(streams.mp4);
      setHlsUrl(streams.hls);
      setStatus("ready");
    } catch (e) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }
      if (e instanceof DOMException && e.name === "AbortError") {
        return;
      }
      setMp4Url(null);
      setHlsUrl(null);
      setStatus("error");
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
      }
    }
  }, []);

  const handleStreamError = useCallback(() => {
    if (!isStreamSource(sourceRef.current) || !enabled || loadingRef.current) {
      return;
    }
    if (retryCountRef.current >= MAX_STREAM_RETRIES) {
      return;
    }
    retryCountRef.current += 1;
    void loadStreams({ isRetry: true });
  }, [enabled, loadStreams]);

  useEffect(() => {
    if (!enabled || !eligible) {
      abortRef.current?.abort();
      abortRef.current = null;
      requestIdRef.current += 1;
      setMp4Url(null);
      setHlsUrl(null);
      setStatus("idle");
      retryCountRef.current = 0;
      return;
    }

    let startDelayId: number | null = null;
    let idleId: number | null = null;

    startDelayId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(
          () => {
            void loadStreams();
          },
          { timeout: STREAM_IDLE_TIMEOUT_MS },
        );
        return;
      }

      void loadStreams();
    }, initialStreamDelayMs);

    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      requestIdRef.current += 1;
      if (startDelayId !== null) window.clearTimeout(startDelayId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
    // Reset/reload when the resolved source identity changes.
  }, [eligible, enabled, loadStreams, initialStreamDelayMs, sourceKey]);

  return { mp4Url, hlsUrl, status, handleStreamError };
};
