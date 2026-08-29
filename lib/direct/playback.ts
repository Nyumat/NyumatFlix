/** Mirrors calluspirates/web/src/lib/playback.ts */

import type { DirectStream } from "@/lib/direct/types";

export type DirectPlaybackEngine = "movi" | "vidstack-hls" | "vidstack-direct";

const HEAVY_MOVI_SEEK_PATTERN = /\b(remux|complete\.bluray|blu-ray|bluray)\b/i;

const HEAVY_MOVI_SIZE_BYTES = 15 * 1024 * 1024 * 1024;

export function supportsWebCodecs(): boolean {
  return typeof VideoDecoder !== "undefined";
}

export function prefersSeekableHlsFallback(input: {
  fallbackUrl?: string;
  mediaUrl?: string;
  url?: string;
  fileName?: string;
  name?: string;
  size?: number | string;
}): boolean {
  if (!input.fallbackUrl) {
    return false;
  }

  const blob = `${input.fileName ?? ""} ${input.name ?? ""} ${input.mediaUrl ?? input.url ?? ""}`;
  if (HEAVY_MOVI_SEEK_PATTERN.test(blob)) {
    return true;
  }

  const size =
    typeof input.size === "string" ? Number(input.size) : (input.size ?? NaN);
  return Number.isFinite(size) && size > HEAVY_MOVI_SIZE_BYTES;
}

function buildEngineCandidates(stream: DirectStream): DirectPlaybackEngine[] {
  const candidates: DirectPlaybackEngine[] = [];
  const add = (engine: DirectPlaybackEngine) => {
    if (!candidates.includes(engine)) {
      candidates.push(engine);
    }
  };

  if (stream.playback === "hls" || stream.url.includes(".m3u8")) {
    add("vidstack-hls");
    if (supportsWebCodecs()) {
      add("movi");
    }
    return candidates;
  }

  if (stream.playback === "direct") {
    add("vidstack-direct");
    if (stream.fallbackUrl) {
      add("vidstack-hls");
    }
    return candidates;
  }

  if (stream.playback === "extended") {
    if (supportsWebCodecs()) {
      add("movi");
    }
    if (stream.fallbackUrl) {
      add("vidstack-hls");
    }
    return candidates;
  }

  if (stream.browserPlayable !== false) {
    add("vidstack-direct");
  }
  if (supportsWebCodecs()) {
    add("movi");
  }
  if (stream.fallbackUrl) {
    add("vidstack-hls");
  }
  return candidates;
}

export function selectInitialEngine(
  stream: DirectStream,
): DirectPlaybackEngine | null {
  return buildEngineCandidates(stream)[0] ?? null;
}

export function isStreamPlayable(stream: DirectStream): boolean {
  return selectInitialEngine(stream) !== null;
}

export function nextFallbackEngine(
  stream: DirectStream,
  current: DirectPlaybackEngine,
  tried?: ReadonlySet<DirectPlaybackEngine>,
): DirectPlaybackEngine | null {
  const excluded = new Set(tried);
  excluded.add(current);
  return (
    buildEngineCandidates(stream).find((engine) => !excluded.has(engine)) ??
    null
  );
}

export function engineSourceUrl(
  stream: DirectStream,
  engine: DirectPlaybackEngine,
): string {
  if (engine === "vidstack-hls") {
    return stream.fallbackUrl ?? stream.url;
  }
  return stream.url;
}

export function engineStreamKind(
  engine: DirectPlaybackEngine,
  sourceUrl?: string,
): "hls" | "mp4" {
  if (engine === "vidstack-hls") {
    return "hls";
  }
  if (engine === "vidstack-direct") {
    return "mp4";
  }
  if (sourceUrl?.includes("/transcode/")) {
    return "hls";
  }
  return "mp4";
}

export function openDownloadUrl(stream: DirectStream): string {
  if (stream.url.startsWith("http://") || stream.url.startsWith("https://")) {
    return stream.url;
  }
  if (typeof window === "undefined") {
    return stream.url;
  }
  return `${window.location.origin}${stream.url.startsWith("/") ? stream.url : `/${stream.url}`}`;
}

export function toDirectStream(input: {
  url: string;
  fallbackUrl?: string;
  playback?: DirectStream["playback"];
  browserPlayable?: boolean;
  name?: string;
  fileName?: string;
  size?: number | string;
  hash?: string;
}): DirectStream {
  return {
    name: input.name ?? "Stream",
    resolution: "",
    size: input.size ?? 0,
    url: input.url,
    playback: input.playback,
    fallbackUrl: input.fallbackUrl,
    cached: true,
    hash: input.hash ?? input.url,
    fileName: input.fileName,
    browserPlayable: input.browserPlayable,
  };
}
