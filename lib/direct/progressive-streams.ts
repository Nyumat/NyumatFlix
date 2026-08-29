import { mergeDirectStreams } from "@/lib/direct/merge-direct-streams";
import { collectDirectStreamsClient } from "@/lib/direct/collect-direct-streams-client";
import type { DirectPlaybackTarget } from "@/lib/direct/client-streams";
import { directDiscoveryEventPath } from "@/lib/direct/discovery-paths";
import { ensureDirectSession } from "@/lib/direct/session";
import { consumeSseFrames, type SseFrame } from "@/lib/direct/sse-frames";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";

export { consumeSseFrames, type SseFrame };
export { directDiscoveryEventPath } from "@/lib/direct/discovery-paths";
export type { ProgressiveDirectStreamRequest } from "@/lib/direct/progressive-streams-request";

import type { ProgressiveDirectStreamRequest } from "@/lib/direct/progressive-streams-request";

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

export const MAX_SSE_RECONNECTS = 2;
const RETRY_BASE_MS = 400;
const RETRY_MAX_MS = 8_000;
const DISCOVERY_BUDGET_MS = 180_000;

export function shouldLoadJsonFallback(input: {
  sawTerminalDone: boolean;
  accumulatedCount: number;
}): boolean {
  return !input.sawTerminalDone && input.accumulatedCount === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
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
    streams.push(item as DirectStream);
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

function retryDelayMs(attempt: number): number {
  return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt));
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted || ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function loadJsonStreams(
  request: ProgressiveDirectStreamRequest,
  signal: AbortSignal,
): Promise<DirectStreamsResponse> {
  return collectDirectStreamsClient(request, { signal, quick: true });
}

async function readSseResponse(
  response: Response,
  signal: AbortSignal,
  onFrame: (frame: SseFrame) => boolean | Promise<boolean>,
): Promise<void> {
  if (signal.aborted) {
    return;
  }
  if (!response.ok || !response.body) {
    throw new Error(`Stream discovery ${response.status || "failed"}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error("Stream discovery did not return an event stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const carry = { buffer: "" };
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      for (const frame of consumeSseFrames(text, carry)) {
        const stop = await onFrame(frame);
        if (stop) {
          return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function subscribeProgressiveDirectStreams(
  request: ProgressiveDirectStreamRequest,
  callbacks: ProgressiveDirectStreamCallbacks,
): () => void {
  const abort = new AbortController();
  let finished = false;
  let sawTerminalDone = false;
  let accumulated: DirectStream[] = [];

  const close = (): void => {
    if (abort.signal.aborted) {
      return;
    }
    abort.abort();
  };

  const finishDone = (payload: DirectStreamsResponse): void => {
    if (finished || abort.signal.aborted) {
      return;
    }
    finished = true;
    callbacks.onDone(payload);
    close();
  };

  const finishError = (message: string): void => {
    if (finished || abort.signal.aborted) {
      return;
    }
    if (accumulated.length > 0) {
      finishDone({ streams: accumulated });
      return;
    }
    finished = true;
    callbacks.onError(message);
    close();
  };

  const sessionPromise = ensureDirectSession();
  const resolveTarget = (): Promise<DirectPlaybackTarget> =>
    sessionPromise.then((session) => ({
      apiBase: session.apiBase,
      accessToken: session.token,
    }));

  const handleFrame = async (frame: SseFrame): Promise<boolean> => {
    if (finished || abort.signal.aborted) {
      return true;
    }
    const payload = parseJson(frame.data);
    if (frame.event === "status") {
      const status = parseStatus(payload);
      if (status) {
        callbacks.onStatus?.(status);
      }
      return false;
    }
    if (frame.event === "streams") {
      const chunk = parseChunk(payload);
      if (!chunk) {
        return false;
      }
      const target = await resolveTarget();
      if (finished || abort.signal.aborted) {
        return true;
      }
      accumulated = mergeDirectStreams(accumulated, chunk.streams, target);
      callbacks.onStreams?.({
        streams: accumulated,
        partial: chunk.partial,
        source: chunk.source,
      });
      return false;
    }
    if (frame.event === "done") {
      const response = parseDone(payload);
      if (!response) {
        return false;
      }
      const target = await resolveTarget();
      if (finished || abort.signal.aborted) {
        return true;
      }
      accumulated = mergeDirectStreams(accumulated, response.streams, target);
      sawTerminalDone = true;
      finishDone({
        streams: accumulated,
        ...(response.message ? { message: response.message } : {}),
      });
      return true;
    }
    if (frame.event === "error") {
      return false;
    }
    return false;
  };

  const run = async (): Promise<void> => {
    const startedAt = Date.now();
    let reconnects = 0;

    while (!finished && !abort.signal.aborted) {
      try {
        const response = await fetch(directDiscoveryEventPath(request), {
          headers: { Accept: "text/event-stream" },
          signal: abort.signal,
        });
        await readSseResponse(response, abort.signal, handleFrame);
        if (finished || abort.signal.aborted) {
          return;
        }
        if (accumulated.length > 0) {
          finishDone({ streams: accumulated });
          return;
        }
      } catch (error) {
        if (abort.signal.aborted || finished) {
          return;
        }
        if (accumulated.length > 0) {
          finishDone({ streams: accumulated });
          return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }

      if (finished || abort.signal.aborted) {
        return;
      }

      if (Date.now() - startedAt >= DISCOVERY_BUDGET_MS) {
        break;
      }

      if (reconnects >= MAX_SSE_RECONNECTS) {
        break;
      }

      await wait(retryDelayMs(reconnects), abort.signal);
      reconnects += 1;
    }

    if (finished || abort.signal.aborted) {
      return;
    }

    if (accumulated.length > 0) {
      finishDone({ streams: accumulated });
      return;
    }

    if (
      !shouldLoadJsonFallback({
        sawTerminalDone,
        accumulatedCount: accumulated.length,
      })
    ) {
      finishError("No streams found");
      return;
    }

    try {
      const payload = await loadJsonStreams(request, abort.signal);
      if (abort.signal.aborted || finished) {
        return;
      }
      if (payload.streams.length > 0) {
        finishDone(payload);
        return;
      }
      finishError(payload.message ?? "No streams found");
    } catch (error) {
      if (abort.signal.aborted || finished) {
        return;
      }
      finishError(
        error instanceof Error
          ? error.message
          : "Failed to load direct streams",
      );
    }
  };

  void run();
  return close;
}
