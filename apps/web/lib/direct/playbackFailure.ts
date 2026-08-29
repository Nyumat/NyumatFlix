import { rankDirectMovieStreams } from "@calluspirates/shared";

import type { DirectPlaybackEngine } from "@nyumatflix/playback";
import type { DirectStream } from "@nyumatflix/playback";
import { streamIdentity } from "@/lib/direct/streamUtils";

export type PlaybackFailureReason =
  | "source_forbidden"
  | "source_not_found"
  | "source_unavailable"
  | "transcode_failed"
  | "decode_failed"
  | "start_timeout"
  | "no_engine"
  | "all_exhausted"
  | "unknown";

export type EngineErrorKind = "error" | "timeout";

export interface MediaProbeResult {
  ok: boolean;
  status: number | null;
}

const PROBE_TIMEOUT_MS = 8_000;

function absoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${window.location.origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export async function probeMediaUrl(
  pathOrUrl: string,
): Promise<MediaProbeResult> {
  const url = absoluteUrl(pathOrUrl);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const status = response.status;
    await response.body?.cancel().catch(() => undefined);
    return {
      ok: status === 200 || status === 206,
      status,
    };
  } catch {
    return { ok: false, status: null };
  }
}

export function reasonFromHttpStatus(
  status: number | null,
): PlaybackFailureReason {
  if (status === 403) return "source_forbidden";
  if (status === 404) return "source_not_found";
  if (status === null) return "source_unavailable";
  if (status >= 500) return "source_unavailable";
  if (status >= 400) return "source_unavailable";
  return "unknown";
}

export async function classifyStreamFailure(
  stream: DirectStream,
  lastEngine: DirectPlaybackEngine | null,
  engineErrorKind: EngineErrorKind = "error",
): Promise<PlaybackFailureReason> {
  if (lastEngine === null) return "no_engine";

  const media = await probeMediaUrl(stream.url);
  if (!media.ok) {
    return reasonFromHttpStatus(media.status);
  }

  if (lastEngine === "vidstack-hls" && stream.fallbackUrl) {
    const playlist = await probeMediaUrl(stream.fallbackUrl);
    if (!playlist.ok) return "transcode_failed";
  }

  if (engineErrorKind === "timeout") return "start_timeout";
  if (lastEngine === "movi") return "decode_failed";
  return "unknown";
}

export async function findNextViableStream(
  candidates: readonly DirectStream[],
  tried: Set<string>,
): Promise<
  | { kind: "stream"; stream: DirectStream }
  | { kind: "none"; reason: PlaybackFailureReason }
> {
  const remaining = rankDirectMovieStreams(
    candidates.filter((stream) => !tried.has(streamIdentity(stream))),
  );

  let lastReason: PlaybackFailureReason = "all_exhausted";

  for (const stream of remaining) {
    const id = streamIdentity(stream);
    const probe = await probeMediaUrl(stream.url);
    if (probe.ok) {
      return { kind: "stream", stream };
    }
    tried.add(id);
    lastReason = reasonFromHttpStatus(probe.status);
  }

  return {
    kind: "none",
    reason: remaining.length === 0 ? "all_exhausted" : lastReason,
  };
}

export function streamAdvanceNote(
  reason: PlaybackFailureReason,
  nextName: string,
): string {
  const shortName =
    nextName.length > 48 ? `${nextName.slice(0, 45).trimEnd()}…` : nextName;

  switch (reason) {
    case "source_forbidden":
      return `Link expired — trying ${shortName}`;
    case "source_not_found":
      return `File missing — trying ${shortName}`;
    case "source_unavailable":
      return `Source unreachable — trying ${shortName}`;
    case "transcode_failed":
      return `Transcode failed — trying ${shortName}`;
    case "decode_failed":
      return `Decode failed — trying ${shortName}`;
    case "start_timeout":
      return `Timed out — trying ${shortName}`;
    default:
      return `Trying next stream — ${shortName}`;
  }
}
