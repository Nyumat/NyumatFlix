"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDirectMovieStreams,
  fetchDirectTvStreams,
} from "@/lib/direct/client-streams";
import { prefetchDirectPlayback } from "@/lib/direct/prefetch-playback";
import { subscribeProgressiveDirectStreams } from "@/lib/direct/progressive-streams";
import { isStreamPlayable } from "@/lib/direct/playback";
import {
  pickBestDirectMovieStream,
  rankDirectMovieStreams,
} from "@calluspirates/shared";
import type { DirectPlaybackStatus, DirectStream } from "@/lib/direct/types";

export type UseDirectPlaybackOptions = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
  enabled: boolean;
  onAllStreamsFailed?: () => void;
};

function buildMediaKey(input: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
}): string {
  if (input.mediaType === "tv") {
    return `${input.tmdbId}:s${input.seasonNumber ?? 0}e${input.episodeNumber ?? 0}`;
  }
  return String(input.tmdbId);
}

async function loadStreamsJson(
  mediaType: "movie" | "tv",
  tmdbId: number,
  seasonNumber: number | undefined,
  episodeNumber: number | undefined,
  fresh: boolean | undefined,
  signal: AbortSignal,
) {
  if (mediaType === "tv") {
    return fetchDirectTvStreams(tmdbId, seasonNumber ?? 0, episodeNumber ?? 0, {
      fresh,
      signal,
    });
  }
  return fetchDirectMovieStreams(tmdbId, { fresh, signal });
}

export function useDirectPlayback({
  tmdbId,
  mediaType,
  seasonNumber,
  episodeNumber,
  enabled,
  onAllStreamsFailed,
}: UseDirectPlaybackOptions) {
  const [status, setStatus] = useState<DirectPlaybackStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [streamsMessage, setStreamsMessage] = useState<string | null>(null);
  const [rankedStreams, setRankedStreams] = useState<DirectStream[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);

  const runIdRef = useRef(0);
  const mediaKeyRef = useRef<string | null>(null);
  const statusRef = useRef(status);
  const freshRetryRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const prefetchedStreamRef = useRef<string | null>(null);
  const onAllStreamsFailedRef = useRef(onAllStreamsFailed);
  onAllStreamsFailedRef.current = onAllStreamsFailed;
  statusRef.current = status;

  const activeStream = rankedStreams[streamIndex] ?? null;

  const reset = useCallback(() => {
    runIdRef.current += 1;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    mediaKeyRef.current = null;
    freshRetryRef.current = false;
    prefetchedStreamRef.current = null;
    setStatus("idle");
    setError(null);
    setStreamsMessage(null);
    setRankedStreams([]);
    setStreamIndex(0);
  }, []);

  const maybePrefetch = useCallback((stream: DirectStream) => {
    const key = `${stream.hash}:${stream.url}`;
    if (prefetchedStreamRef.current === key) {
      return;
    }
    prefetchedStreamRef.current = key;
    prefetchDirectPlayback(stream);
  }, []);

  const applyRankedStreams = useCallback(
    (ranked: DirectStream[], options?: { forcePlaying?: boolean }) => {
      if (!ranked.length) {
        return false;
      }
      setRankedStreams(ranked);
      const best = pickBestDirectMovieStream(ranked);
      if (!best || !isStreamPlayable(best)) {
        return false;
      }
      maybePrefetch(best);
      if (options?.forcePlaying || statusRef.current === "loading") {
        setStatus("playing");
      }
      return true;
    },
    [maybePrefetch],
  );

  const loadStreamsJsonFallback = useCallback(
    async (runId: number, fresh?: boolean) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);
      try {
        const payload = await loadStreamsJson(
          mediaType,
          tmdbId,
          seasonNumber,
          episodeNumber,
          fresh,
          controller.signal,
        );
        if (runId !== runIdRef.current) {
          return;
        }
        const ranked = rankDirectMovieStreams(payload.streams ?? []);
        if (!ranked.length) {
          setStatus("error");
          setError(payload.message ?? "No cached streams available");
          onAllStreamsFailedRef.current?.();
          return;
        }
        setStreamsMessage(payload.message ?? null);
        setRankedStreams(ranked);
        setStreamIndex(0);
        maybePrefetch(ranked[0]!);
        setStatus("playing");
      } catch (loadError) {
        if (runId !== runIdRef.current) {
          return;
        }
        setStatus("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load direct streams",
        );
        onAllStreamsFailedRef.current?.();
      } finally {
        window.clearTimeout(timeout);
      }
    },
    [episodeNumber, maybePrefetch, mediaType, seasonNumber, tmdbId],
  );

  const loadStreams = useCallback(
    async (options?: { fresh?: boolean }) => {
      if (!enabled || !Number.isInteger(tmdbId) || tmdbId <= 0) {
        return;
      }

      if (mediaType === "tv") {
        if (
          seasonNumber == null ||
          episodeNumber == null ||
          seasonNumber < 1 ||
          episodeNumber < 1
        ) {
          return;
        }
      }

      const mediaKey = buildMediaKey({
        tmdbId,
        mediaType,
        seasonNumber,
        episodeNumber,
      });

      if (
        mediaKeyRef.current === mediaKey &&
        statusRef.current === "playing" &&
        !options?.fresh
      ) {
        return;
      }

      runIdRef.current += 1;
      const runId = runIdRef.current;
      mediaKeyRef.current = mediaKey;
      prefetchedStreamRef.current = null;

      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      setStatus("loading");
      setError(null);
      setStreamsMessage(null);
      setRankedStreams([]);
      setStreamIndex(0);

      const progressiveRequest =
        mediaType === "tv"
          ? {
              mediaType: "tv" as const,
              tmdbId,
              season: seasonNumber ?? 0,
              episode: episodeNumber ?? 0,
              fresh: options?.fresh,
            }
          : {
              mediaType: "movie" as const,
              tmdbId,
              fresh: options?.fresh,
            };

      unsubscribeRef.current = subscribeProgressiveDirectStreams(
        progressiveRequest,
        {
          onStatus: (event) => {
            if (runId !== runIdRef.current) {
              return;
            }
            setStreamsMessage(event.message);
          },
          onStreams: (event) => {
            if (runId !== runIdRef.current) {
              return;
            }
            applyRankedStreams(event.streams);
          },
          onDone: (payload) => {
            if (runId !== runIdRef.current) {
              return;
            }
            unsubscribeRef.current = null;
            if (payload.message) {
              setStreamsMessage(payload.message);
            }
            const ranked = rankDirectMovieStreams(payload.streams);
            if (!ranked.length) {
              setStatus("error");
              setError(payload.message ?? "No cached streams available");
              onAllStreamsFailedRef.current?.();
              return;
            }
            applyRankedStreams(ranked, { forcePlaying: true });
            setStreamIndex(0);
          },
          onError: () => {
            if (runId !== runIdRef.current) {
              return;
            }
            unsubscribeRef.current = null;
            void loadStreamsJsonFallback(runId, options?.fresh);
          },
        },
      );
    },
    [
      applyRankedStreams,
      enabled,
      episodeNumber,
      loadStreamsJsonFallback,
      mediaType,
      seasonNumber,
      tmdbId,
    ],
  );

  const tryNextStream = useCallback(() => {
    setStreamIndex((current) => {
      const next = current + 1;
      if (next >= rankedStreams.length) {
        if (!freshRetryRef.current) {
          freshRetryRef.current = true;
          mediaKeyRef.current = null;
          void loadStreams({ fresh: true });
          return current;
        }
        setStatus("error");
        setError("All direct streams failed playback");
        onAllStreamsFailedRef.current?.();
        return current;
      }
      setStatus("playing");
      setError(null);
      const nextStream = rankedStreams[next];
      if (nextStream) {
        maybePrefetch(nextStream);
      }
      return next;
    });
  }, [loadStreams, maybePrefetch, rankedStreams]);

  const retryAll = useCallback(() => {
    mediaKeyRef.current = null;
    freshRetryRef.current = false;
    void loadStreams({ fresh: true });
  }, [loadStreams]);

  useEffect(() => {
    if (!enabled) {
      reset();
    }
  }, [enabled, reset]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    },
    [],
  );

  return {
    status,
    error,
    streamsMessage,
    rankedStreams,
    streamIndex,
    activeStream,
    loadStreams,
    tryNextStream,
    retryAll,
    reset,
  };
}

export type UseDirectPlaybackReturn = ReturnType<typeof useDirectPlayback>;

export type UseDirectMoviePlaybackOptions = {
  tmdbId: number;
  enabled: boolean;
  onAllStreamsFailed?: () => void;
};

export function useDirectMoviePlayback({
  tmdbId,
  enabled,
  onAllStreamsFailed,
}: UseDirectMoviePlaybackOptions) {
  return useDirectPlayback({
    tmdbId,
    mediaType: "movie",
    enabled,
    onAllStreamsFailed,
  });
}

export type UseDirectMoviePlaybackReturn = UseDirectPlaybackReturn;
