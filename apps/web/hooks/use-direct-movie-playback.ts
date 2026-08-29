"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDirectMovieStreams,
  fetchDirectTvStreams,
} from "@/lib/direct/client-streams";
import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import { prefetchDirectPlayback } from "@/lib/direct/prefetch-playback";
import {
  buildDirectMediaKey,
  isDirectStreamDiscoveryActive,
  peekCachedDirectStreams,
  subscribeDirectStreamDiscovery,
} from "@/lib/direct/stream-discovery-cache";
import {
  isFastStartDirectStream,
  isStreamPlayable,
} from "@nyumatflix/playback";
import { streamIdentity } from "@/lib/direct/streamUtils";
import {
  pickBestDirectMovieStream,
  rankDirectMovieStreams,
} from "@calluspirates/shared";
import type { DirectPlaybackStatus, DirectStream } from "@nyumatflix/playback";

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
  const rankedStreamsRef = useRef(rankedStreams);
  const freshRetryRef = useRef(false);
  rankedStreamsRef.current = rankedStreams;
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
    (
      ranked: DirectStream[],
      options?: { forcePlaying?: boolean; partial?: boolean },
    ) => {
      if (!ranked.length) {
        return false;
      }
      const playable = ranked.filter(isStreamPlayable);
      const best =
        pickBestDirectMovieStream(playable) ?? playable[0] ?? ranked[0];
      if (!best) {
        return false;
      }
      const bestIndex = ranked.findIndex(
        (stream) => streamIdentity(stream) === streamIdentity(best),
      );
      const canStartPlayback =
        options?.forcePlaying ||
        !options?.partial ||
        isFastStartDirectStream(best);

      setRankedStreams(ranked);
      maybePrefetch(best);

      if (
        canStartPlayback &&
        (options?.forcePlaying || statusRef.current === "loading")
      ) {
        setStatus("playing");
        if (bestIndex >= 0) {
          setStreamIndex(bestIndex);
        }
        return true;
      }

      if (statusRef.current === "playing" && bestIndex >= 0) {
        setStreamIndex((current) => {
          const currentStream = rankedStreamsRef.current[current];
          if (
            currentStream &&
            streamIdentity(currentStream) === streamIdentity(best)
          ) {
            return current;
          }
          if (
            isFastStartDirectStream(best) &&
            !isFastStartDirectStream(currentStream)
          ) {
            return bestIndex;
          }
          return current;
        });
      }

      return true;
    },
    [maybePrefetch],
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

      const cached = !options?.fresh
        ? peekCachedDirectStreams(buildDirectMediaKey(progressiveRequest))
        : null;

      runIdRef.current += 1;
      const runId = runIdRef.current;
      mediaKeyRef.current = mediaKey;
      prefetchedStreamRef.current = null;

      unsubscribeRef.current?.();
      unsubscribeRef.current = null;

      if (cached?.ranked.length) {
        setStatus("playing");
        setError(null);
        setStreamsMessage(cached.message ?? null);
        setStreamIndex(0);
        applyRankedStreams(cached.ranked, { forcePlaying: true });
      } else {
        setStatus("loading");
        setError(null);
        setStreamsMessage(null);
        setRankedStreams([]);
        setStreamIndex(0);
      }

      unsubscribeRef.current = subscribeDirectStreamDiscovery(
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
            applyRankedStreams(event.streams, { partial: event.partial });
          },
          onDone: (payload) => {
            if (runId !== runIdRef.current) {
              return;
            }
            if (payload.message) {
              setStreamsMessage(payload.message);
            }
            const ranked = rankDirectMovieStreams(payload.streams);
            if (!ranked.length) {
              if (statusRef.current === "playing") {
                return;
              }
              setStatus("error");
              setError(payload.message ?? "No streams found");
              onAllStreamsFailedRef.current?.();
              return;
            }
            applyRankedStreams(ranked, { forcePlaying: true });
            setStreamIndex(0);
          },
          onError: (message) => {
            if (runId !== runIdRef.current) {
              return;
            }
            if (statusRef.current === "playing") {
              return;
            }
            setStatus("error");
            setError(message);
            onAllStreamsFailedRef.current?.();
          },
        },
      );
    },
    [
      applyRankedStreams,
      enabled,
      episodeNumber,
      mediaType,
      seasonNumber,
      tmdbId,
    ],
  );

  const refreshMoreStreamsInBackground = useCallback(
    async (currentIndex: number) => {
      if (!enabled || !Number.isInteger(tmdbId) || tmdbId <= 0) {
        return;
      }

      const progressiveRequest =
        mediaType === "tv"
          ? {
              mediaType: "tv" as const,
              tmdbId,
              season: seasonNumber ?? 0,
              episode: episodeNumber ?? 0,
              fresh: true,
            }
          : {
              mediaType: "movie" as const,
              tmdbId,
              fresh: true,
            };

      const mediaKey = buildDirectMediaKey(progressiveRequest);
      if (isDirectStreamDiscoveryActive(mediaKey)) {
        return;
      }

      const cached = peekCachedDirectStreams(mediaKey);
      if (cached && cached.ranked.length > 1) {
        return;
      }

      try {
        const payload =
          mediaType === "tv"
            ? await fetchDirectTvStreams(
                tmdbId,
                seasonNumber ?? 0,
                episodeNumber ?? 0,
                { fresh: true, quick: true },
              )
            : await fetchDirectMovieStreams(tmdbId, {
                fresh: true,
                quick: true,
              });

        const incoming = payload.streams ?? [];
        if (!incoming.length) {
          return;
        }

        setRankedStreams((previous) => {
          const merged = mergeDirectStreams(previous, incoming);
          rankedStreamsRef.current = merged;

          if (merged.length <= 1) {
            const replacement = merged[0];
            if (
              replacement &&
              streamIdentity(replacement) !==
                streamIdentity(previous[currentIndex]!)
            ) {
              setStreamIndex(0);
              maybePrefetch(replacement);
            }
            return merged;
          }

          const nextIndex = (currentIndex + 1) % merged.length;
          setStreamIndex(nextIndex);
          const nextStream = merged[nextIndex];
          if (nextStream) {
            maybePrefetch(nextStream);
          }
          return merged;
        });
        setStatus("playing");
        setError(null);
      } catch {
        // Fire-and-forget background refresh.
      }
    },
    [enabled, episodeNumber, maybePrefetch, mediaType, seasonNumber, tmdbId],
  );

  const tryNextStream = useCallback(() => {
    setStreamIndex((current) => {
      const streams = rankedStreamsRef.current;
      if (!streams.length) {
        return current;
      }

      setStatus("playing");
      setError(null);

      if (streams.length > 1) {
        const next = (current + 1) % streams.length;
        const nextStream = streams[next];
        if (nextStream) {
          maybePrefetch(nextStream);
        }
        return next;
      }

      void refreshMoreStreamsInBackground(current);
      return current;
    });
  }, [maybePrefetch, refreshMoreStreamsInBackground]);

  const handlePlaybackExhausted = useCallback(() => {
    if (!freshRetryRef.current) {
      freshRetryRef.current = true;
      mediaKeyRef.current = null;
      void loadStreams({ fresh: true });
      return;
    }
    setStatus("error");
    setError("All direct streams failed playback");
    onAllStreamsFailedRef.current?.();
  }, [loadStreams]);

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
    handlePlaybackExhausted,
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
