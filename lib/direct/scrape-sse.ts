import { consumeSseFrames } from "@/lib/direct/sse-frames";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";

export type DirectSseStream = {
  name: string;
  url: string;
  hash: string;
  resolution?: string;
  size?: number;
  playback?: "hls" | "direct" | "extended";
  fallbackUrl?: string;
  cached?: boolean;
  fileName?: string;
  mime?: string;
  browserPlayable?: boolean;
  source?: string;
};

export type DirectSsePayload = {
  streams: DirectSseStream[];
  message?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const parseStream = (item: unknown): DirectSseStream | null => {
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
  const playback =
    item.playback === "hls" ||
    item.playback === "direct" ||
    item.playback === "extended"
      ? item.playback
      : undefined;
  return {
    name: item.name,
    url: item.url,
    hash: item.hash,
    ...(typeof item.resolution === "string"
      ? { resolution: item.resolution }
      : {}),
    ...(typeof item.size === "number" ? { size: item.size } : {}),
    ...(playback ? { playback } : {}),
    ...(typeof item.fallbackUrl === "string"
      ? { fallbackUrl: item.fallbackUrl }
      : {}),
    ...(typeof item.cached === "boolean" ? { cached: item.cached } : {}),
    ...(typeof item.fileName === "string" ? { fileName: item.fileName } : {}),
    ...(typeof item.mime === "string" ? { mime: item.mime } : {}),
    ...(typeof item.browserPlayable === "boolean"
      ? { browserPlayable: item.browserPlayable }
      : {}),
    ...(typeof item.source === "string" ? { source: item.source } : {}),
  };
};

const parseStreams = (value: unknown): DirectSseStream[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const streams: DirectSseStream[] = [];
  for (const item of value) {
    const parsed = parseStream(item);
    if (!parsed) {
      return null;
    }
    streams.push(parsed);
  }
  return streams;
};

const mergeByHash = (
  existing: DirectSseStream[],
  incoming: DirectSseStream[],
): DirectSseStream[] => {
  const byHash = new Map(existing.map((stream) => [stream.hash, stream]));
  for (const stream of incoming) {
    byHash.set(stream.hash, stream);
  }
  return [...byHash.values()];
};

export const collectStreamsFromDirectSse = async (
  response: Response,
  signal: AbortSignal,
  hasPlayable: (streams: DirectSseStream[]) => boolean,
): Promise<DirectSsePayload> => {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (!response.ok || !response.body) {
    throw new Error(`Stream discovery ${response.status || "failed"}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = (await response.json()) as {
      streams?: unknown;
      message?: unknown;
    };
    const streams = parseStreams(payload.streams) ?? [];
    return {
      streams,
      ...(typeof payload.message === "string"
        ? { message: payload.message }
        : {}),
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const carry = { buffer: "" };
  let accumulated: DirectSseStream[] = [];
  let message: string | undefined;

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      for (const frame of consumeSseFrames(text, carry)) {
        const payload = parseJson(frame.data);
        if (frame.event === "streams" || frame.event === "done") {
          if (!isRecord(payload)) {
            continue;
          }
          const streams = parseStreams(payload.streams);
          if (!streams) {
            continue;
          }
          accumulated = mergeByHash(accumulated, streams);
          if (typeof payload.message === "string") {
            message = payload.message;
          }
          if (frame.event === "done") {
            return {
              streams: accumulated,
              ...(message ? { message } : {}),
            };
          }
          if (hasPlayable(accumulated)) {
            return { streams: accumulated };
          }
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  return {
    streams: accumulated,
    ...(message ? { message } : {}),
  };
};

export const toDirectStreamsResponse = (
  payload: DirectSsePayload,
): DirectStreamsResponse => ({
  streams: payload.streams.map(
    (stream): DirectStream => ({
      name: stream.name,
      resolution: stream.resolution ?? "unknown",
      size: stream.size ?? 0,
      url: stream.url,
      hash: stream.hash,
      cached: stream.cached ?? false,
      ...(stream.playback ? { playback: stream.playback } : {}),
      ...(stream.fallbackUrl ? { fallbackUrl: stream.fallbackUrl } : {}),
      ...(stream.fileName ? { fileName: stream.fileName } : {}),
      ...(stream.mime ? { mime: stream.mime } : {}),
      ...(typeof stream.browserPlayable === "boolean"
        ? { browserPlayable: stream.browserPlayable }
        : {}),
      ...(stream.source ? { source: stream.source } : {}),
    }),
  ),
  ...(payload.message ? { message: payload.message } : {}),
});
