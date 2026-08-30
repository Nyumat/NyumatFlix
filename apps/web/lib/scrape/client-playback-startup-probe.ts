"use client";

import { resolveHlsPlaylistUrl } from "./hls-url";
import { extractHlsProbeTargets } from "./hls-probe-targets";

export type ClientPlaybackStartupProbeResult = {
  ok: boolean;
  ms: number;
};

export const CLIENT_PLAYBACK_STARTUP_PROBE_TIMEOUT_MS = 12_000;

const SEGMENT_RANGE = "bytes=0-65535";

const resolveClientPlayUrl = (playUrl: string): string => {
  if (playUrl.startsWith("/")) {
    return `${window.location.origin}${playUrl}`;
  }
  return playUrl;
};

const mergeSignals = (
  primary: AbortSignal,
  secondary: AbortSignal,
): AbortSignal => {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([primary, secondary]);
  }

  const merged = new AbortController();
  const abort = () => merged.abort();
  if (primary.aborted || secondary.aborted) {
    merged.abort();
    return merged.signal;
  }
  primary.addEventListener("abort", abort, { once: true });
  secondary.addEventListener("abort", abort, { once: true });
  return merged.signal;
};

const fetchWithRange = async (
  url: string,
  signal: AbortSignal,
  range?: string,
): Promise<boolean> => {
  const headers: HeadersInit = range ? { Range: range } : {};
  const response = await fetch(url, {
    signal,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return false;
  }

  await response.arrayBuffer();
  return true;
};

const firstMediaSegmentUrl = (
  body: string,
  playlistUrl: string,
): string | null => {
  const { childPlaylist, requiredAssets } = extractHlsProbeTargets(
    body,
    playlistUrl,
  );
  if (childPlaylist) {
    return childPlaylist;
  }
  return requiredAssets[0] ?? null;
};

const probeHlsStartup = async (
  playUrl: string,
  signal: AbortSignal,
): Promise<boolean> => {
  const absolute = resolveClientPlayUrl(playUrl);
  const masterResponse = await fetch(absolute, { signal, cache: "no-store" });
  if (!masterResponse.ok) {
    return false;
  }

  const masterBody = await masterResponse.text();
  if (!masterBody.includes("#EXTM3U")) {
    return false;
  }

  const nextTarget = firstMediaSegmentUrl(masterBody, absolute);
  if (!nextTarget) {
    return false;
  }

  if (nextTarget.includes(".m3u8") || nextTarget.includes("/asset.m3u8")) {
    const variantResponse = await fetch(nextTarget, {
      signal,
      cache: "no-store",
    });
    if (!variantResponse.ok) {
      return false;
    }
    const variantBody = await variantResponse.text();
    const segmentUrl = firstMediaSegmentUrl(variantBody, nextTarget);
    if (!segmentUrl || segmentUrl.includes(".m3u8")) {
      return false;
    }
    return fetchWithRange(segmentUrl, signal, SEGMENT_RANGE);
  }

  return fetchWithRange(nextTarget, signal, SEGMENT_RANGE);
};

export async function probeClientPlaybackStartup(
  playUrl: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<ClientPlaybackStartupProbeResult> {
  const timeoutMs =
    options?.timeoutMs ?? CLIENT_PLAYBACK_STARTUP_PROBE_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(
    () => timeoutController.abort(),
    timeoutMs,
  );
  const signal = options?.signal
    ? mergeSignals(options.signal, timeoutController.signal)
    : timeoutController.signal;

  const started = performance.now();

  try {
    const absolute = resolveClientPlayUrl(playUrl);
    if (/\.mp4(?:[?#]|$)/i.test(absolute)) {
      const ok = await fetchWithRange(absolute, signal, SEGMENT_RANGE);
      return { ok, ms: performance.now() - started };
    }

    if (/\.mpd(?:[?#]|$)/i.test(absolute)) {
      const ok = await fetchWithRange(absolute, signal);
      return { ok, ms: performance.now() - started };
    }

    const ok = await probeHlsStartup(playUrl, signal);
    return { ok, ms: performance.now() - started };
  } catch {
    return { ok: false, ms: performance.now() - started };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const prefetchScrapePlayback = (playUrl: string): void => {
  if (typeof window === "undefined" || !playUrl) {
    return;
  }

  void probeClientPlaybackStartup(playUrl, {
    timeoutMs: CLIENT_PLAYBACK_STARTUP_PROBE_TIMEOUT_MS,
  }).catch(() => undefined);
};
