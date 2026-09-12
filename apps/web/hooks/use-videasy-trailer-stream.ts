"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VideasyTrailerStreamStatus = "idle" | "loading" | "ready" | "error";

export interface UseVideasyTrailerStreamResult {
  mp4Url: string | null;
  hlsUrl: string | null;
  status: VideasyTrailerStreamStatus;
  handleStreamError: () => void;
}

const MAX_STREAM_RETRIES = 2;
const STREAM_CACHE_TTL_MS = 60_000;
const INITIAL_STREAM_DELAY_MS = 2500;
const STREAM_IDLE_TIMEOUT_MS = 2000;

type TrailerStreams = { mp4: string | null; hls: string | null };

type TrailerStreamCacheEntry = {
  expiresAt: number;
  promise: Promise<TrailerStreams>;
};

const streamCache = new Map<string, TrailerStreamCacheEntry>();

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

const fetchTrailerStreams = async (imdbId: string): Promise<TrailerStreams> => {
  const res = await fetch(
    `/api/trailers/videasy?imdbId=${encodeURIComponent(imdbId)}`,
    { cache: "no-store" },
  );
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error("trailer_fetch_failed");
  }

  const streams = parseBody(body);
  if (!streams.mp4 && !streams.hls) {
    throw new Error("trailer_streams_empty");
  }

  return streams;
};

const getTrailerStreams = (imdbId: string): Promise<TrailerStreams> => {
  const cached = streamCache.get(imdbId);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchTrailerStreams(imdbId);
  streamCache.set(imdbId, {
    expiresAt: now + STREAM_CACHE_TTL_MS,
    promise,
  });
  promise.catch(() => {
    if (streamCache.get(imdbId)?.promise === promise) {
      streamCache.delete(imdbId);
    }
  });

  return promise;
};

export const useVideasyTrailerStream = (
  imdbId: string | undefined,
  enabled: boolean,
): UseVideasyTrailerStreamResult => {
  const [mp4Url, setMp4Url] = useState<string | null>(null);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VideasyTrailerStreamStatus>("idle");
  const retryCountRef = useRef(0);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  const loadStreams = useCallback(
    async (options?: { isRetry?: boolean }) => {
      if (!imdbId?.startsWith("tt")) {
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
        const streams = await getTrailerStreams(imdbId);

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
    },
    [imdbId],
  );

  const handleStreamError = useCallback(() => {
    if (!imdbId?.startsWith("tt") || !enabled || loadingRef.current) {
      return;
    }
    if (retryCountRef.current >= MAX_STREAM_RETRIES) {
      return;
    }
    retryCountRef.current += 1;
    void loadStreams({ isRetry: true });
  }, [enabled, imdbId, loadStreams]);

  useEffect(() => {
    if (!enabled || !imdbId?.startsWith("tt")) {
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
    }, INITIAL_STREAM_DELAY_MS);

    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      requestIdRef.current += 1;
      if (startDelayId !== null) window.clearTimeout(startDelayId);
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [imdbId, enabled, loadStreams]);

  return { mp4Url, hlsUrl, status, handleStreamError };
};
