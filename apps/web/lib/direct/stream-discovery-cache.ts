import { prefetchDirectPlayback } from "@/lib/direct/prefetch-playback";
import { prefetchDirectPlaybackPlayer } from "@/lib/direct/prefetch-playback-player";
import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import {
  subscribeProgressiveDirectStreams,
  type ProgressiveDirectStreamCallbacks,
} from "@/lib/direct/progressive-streams";
import type { ProgressiveDirectStreamRequest } from "@/lib/direct/progressive-streams-request";
import type { DirectStream, DirectStreamsResponse } from "@nyumatflix/playback";
import {
  pickBestDirectMovieStream,
  rankDirectMovieStreams,
} from "@calluspirates/shared";

type DiscoveryListener = ProgressiveDirectStreamCallbacks;

type CacheEntry = {
  ranked: DirectStream[];
  message?: string;
  listeners: Set<DiscoveryListener>;
  closeUpstream?: () => void;
};

const cache = new Map<string, CacheEntry>();

export function buildDirectMediaKey(
  request: ProgressiveDirectStreamRequest,
): string {
  if (request.mediaType === "movie") {
    return `movie:${request.tmdbId}`;
  }
  return `tv:${request.tmdbId}:s${request.season}:e${request.episode}`;
}

export function peekCachedDirectStreams(mediaKey: string): {
  ranked: DirectStream[];
  message?: string;
} | null {
  const entry = cache.get(mediaKey);
  if (!entry || entry.ranked.length === 0) {
    return null;
  }
  return { ranked: entry.ranked, message: entry.message };
}

export function isDirectStreamDiscoveryActive(mediaKey: string): boolean {
  const entry = cache.get(mediaKey);
  return Boolean(entry?.closeUpstream);
}

function prefetchBestStream(streams: DirectStream[]): void {
  const ranked = rankDirectMovieStreams(streams);
  const best = pickBestDirectMovieStream(ranked);
  if (!best) {
    return;
  }
  prefetchDirectPlaybackPlayer();
  prefetchDirectPlayback(best);
}

function notify(
  entry: CacheEntry,
  emit: (listener: DiscoveryListener) => void,
): void {
  for (const listener of [...entry.listeners]) {
    emit(listener);
  }
}

function release(mediaKey: string, listener: DiscoveryListener): void {
  const entry = cache.get(mediaKey);
  if (!entry) {
    return;
  }
  entry.listeners.delete(listener);
  if (entry.listeners.size > 0) {
    return;
  }
  entry.closeUpstream?.();
  cache.delete(mediaKey);
}

export function subscribeDirectStreamDiscovery(
  request: ProgressiveDirectStreamRequest,
  callbacks: DiscoveryListener,
): () => void {
  const mediaKey = buildDirectMediaKey(request);
  if (request.fresh) {
    const existing = cache.get(mediaKey);
    existing?.closeUpstream?.();
    cache.delete(mediaKey);
  }

  let entry = cache.get(mediaKey);
  if (!entry) {
    entry = {
      ranked: [],
      listeners: new Set([callbacks]),
    };
    cache.set(mediaKey, entry);
    const current = entry;
    current.closeUpstream = subscribeProgressiveDirectStreams(request, {
      onStatus: (event) => {
        notify(current, (listener) => listener.onStatus?.(event));
      },
      onStreams: (event) => {
        current.ranked = rankDirectMovieStreams(
          mergeDirectStreams(current.ranked, event.streams),
        );
        prefetchBestStream(current.ranked);
        notify(current, (listener) =>
          listener.onStreams?.({
            ...event,
            streams: current.ranked,
          }),
        );
      },
      onDone: (payload) => {
        current.ranked = rankDirectMovieStreams(
          mergeDirectStreams(current.ranked, payload.streams),
        );
        current.message = payload.message;
        current.closeUpstream = undefined;
        prefetchBestStream(current.ranked);
        const donePayload: DirectStreamsResponse = {
          streams: current.ranked,
          ...(current.message ? { message: current.message } : {}),
        };
        notify(current, (listener) => listener.onDone(donePayload));
        if (current.ranked.length === 0) {
          cache.delete(mediaKey);
        }
      },
      onError: (message) => {
        current.closeUpstream = undefined;
        notify(current, (listener) => listener.onError(message));
        if (current.ranked.length === 0) {
          cache.delete(mediaKey);
        }
      },
    });
    return () => release(mediaKey, callbacks);
  }

  entry.listeners.add(callbacks);
  if (entry.ranked.length > 0) {
    callbacks.onStreams?.({
      streams: entry.ranked,
      partial: Boolean(entry.closeUpstream),
    });
    if (!entry.closeUpstream) {
      callbacks.onDone({
        streams: entry.ranked,
        ...(entry.message ? { message: entry.message } : {}),
      });
    }
  }

  return () => release(mediaKey, callbacks);
}

export function prefetchDirectStreamDiscovery(
  request: ProgressiveDirectStreamRequest,
): () => void {
  if (request.mediaType === "tv") {
    if (request.season < 1 || request.episode < 1) {
      return () => undefined;
    }
  }
  return subscribeDirectStreamDiscovery(request, {
    onDone: () => undefined,
    onError: () => undefined,
  });
}
