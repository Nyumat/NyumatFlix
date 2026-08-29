import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import { rewriteDirectStreamUrls } from "@/lib/direct/client-streams";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";

export type ProgressiveDirectStreamRequest =
  | {
      mediaType: "movie";
      tmdbId: number;
      fresh?: boolean;
    }
  | {
      mediaType: "tv";
      tmdbId: number;
      season: number;
      episode: number;
      fresh?: boolean;
    };

export interface ProgressiveDirectStreamCallbacks {
  onStatus?: (event: { message: string; loading: string[] }) => void;
  onStreams?: (event: {
    streams: DirectStream[];
    partial: boolean;
    source?: string;
  }) => void;
  onDone: (response: DirectStreamsResponse) => void;
  onError: (message: string) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseEventData(event: Event): unknown {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
    return null;
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
}

function parseStreams(value: unknown): DirectStream[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const streams: DirectStream[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      return null;
    }
    if (
      typeof item.name !== "string" ||
      typeof item.url !== "string" ||
      typeof item.hash !== "string"
    ) {
      return null;
    }
    streams.push(rewriteDirectStreamUrls(item as DirectStream));
  }
  return streams;
}

function parseChunk(value: unknown): {
  streams: DirectStream[];
  partial: boolean;
  source?: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }
  const streams = parseStreams(value.streams);
  if (!streams) {
    return null;
  }
  const partial = value.partial !== false;
  const source = typeof value.source === "string" ? value.source : undefined;
  return { streams, partial, source };
}

function parseStatus(
  value: unknown,
): { message: string; loading: string[] } | null {
  if (!isRecord(value) || typeof value.message !== "string") {
    return null;
  }
  const loading = Array.isArray(value.loading)
    ? value.loading.filter((item): item is string => typeof item === "string")
    : [];
  return { message: value.message, loading };
}

function parseDone(value: unknown): DirectStreamsResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const streams = parseStreams(value.streams);
  if (!streams) {
    return null;
  }
  const message = typeof value.message === "string" ? value.message : undefined;
  return { streams, ...(message ? { message } : {}) };
}

function streamEventUrl(request: ProgressiveDirectStreamRequest): string {
  const params = new URLSearchParams();
  if (request.fresh) {
    params.set("fresh", "1");
  }
  const query = params.toString();
  if (request.mediaType === "movie") {
    return `/api/direct/movie/${request.tmdbId}/streams/stream${query ? `?${query}` : ""}`;
  }
  params.set("season", String(request.season));
  params.set("episode", String(request.episode));
  return `/api/direct/tv/${request.tmdbId}/streams/stream?${params.toString()}`;
}

export function subscribeProgressiveDirectStreams(
  request: ProgressiveDirectStreamRequest,
  callbacks: ProgressiveDirectStreamCallbacks,
): () => void {
  let closed = false;
  let source: EventSource | null = null;
  let accumulated: DirectStream[] = [];

  const close = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    source?.close();
    source = null;
  };

  if (typeof EventSource === "undefined") {
    callbacks.onError("EventSource unavailable");
    return close;
  }

  try {
    source = new EventSource(streamEventUrl(request));
  } catch {
    callbacks.onError("Could not open stream discovery");
    return close;
  }

  source.addEventListener("status", (event) => {
    if (closed) {
      return;
    }
    const status = parseStatus(parseEventData(event));
    if (status) {
      callbacks.onStatus?.(status);
    }
  });

  source.addEventListener("streams", (event) => {
    if (closed) {
      return;
    }
    const chunk = parseChunk(parseEventData(event));
    if (!chunk) {
      return;
    }
    accumulated = mergeDirectStreams(accumulated, chunk.streams);
    callbacks.onStreams?.({
      streams: accumulated,
      partial: chunk.partial,
      source: chunk.source,
    });
  });

  source.addEventListener("done", (event) => {
    if (closed) {
      return;
    }
    const response = parseDone(parseEventData(event));
    if (!response) {
      callbacks.onError("Invalid stream discovery response");
      close();
      return;
    }
    accumulated = mergeDirectStreams(accumulated, response.streams);
    callbacks.onDone({
      streams: accumulated,
      ...(response.message ? { message: response.message } : {}),
    });
    close();
  });

  source.addEventListener("error", (event) => {
    if (closed) {
      return;
    }
    if (event instanceof MessageEvent) {
      const data = parseEventData(event);
      if (isRecord(data) && typeof data.message === "string") {
        callbacks.onError(data.message);
        close();
        return;
      }
    }
    callbacks.onError("Stream discovery connection failed");
    close();
  });

  return close;
}
