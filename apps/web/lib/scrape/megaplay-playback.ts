import "server-only";

import type { MegaplayPlaybackRefresh } from "./megaplay-constants";
import { unwrapJustanimeMomoProxyUrl } from "./justanime-momo-proxy";
import {
  resolveJustanimeMegaplayStream,
  resolveMegaplaySourcesById,
} from "./megaplay-sources";

export type { MegaplayPlaybackRefresh } from "./megaplay-constants";

const masterPathKey = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
};

export const isMegaplayMasterPlaybackUrl = (
  upstreamUrl: string,
  refresh: MegaplayPlaybackRefresh,
): boolean => {
  const normalized = unwrapJustanimeMomoProxyUrl(upstreamUrl) ?? upstreamUrl;
  const seedKey = masterPathKey(refresh.seedStreamUrl);
  const currentKey = masterPathKey(normalized);
  if (!seedKey || !currentKey) {
    return false;
  }
  return seedKey === currentKey;
};

export async function fetchMegaplayStreamUrl(
  refresh: MegaplayPlaybackRefresh,
): Promise<string | null> {
  if (refresh.megaplayId) {
    return resolveMegaplaySourcesById(refresh.megaplayId, refresh.referer);
  }

  if (refresh.justanime) {
    const resolved = await resolveJustanimeMegaplayStream(refresh.justanime);
    return resolved?.streamUrl ?? null;
  }

  return null;
}

/**
 * Re-fetch Megaplay sources at play time — getSources ids and JustAnime API
 * URLs are per-request and can go stale mid-playback.
 */
export async function resolveMegaplayPlaybackUrl(
  upstreamUrl: string,
  refresh: MegaplayPlaybackRefresh,
): Promise<string> {
  if (!isMegaplayMasterPlaybackUrl(upstreamUrl, refresh)) {
    return upstreamUrl;
  }

  const fresh = await fetchMegaplayStreamUrl(refresh);
  return fresh ?? upstreamUrl;
}

/** Resolve Megaplay once at scrape time so mount → play is one hop. */
export async function resolveMegaplayStreamAtScrapeTime(
  streamUrl: string,
  refresh: MegaplayPlaybackRefresh,
): Promise<{ streamUrl: string; refresh: MegaplayPlaybackRefresh }> {
  const fresh = await fetchMegaplayStreamUrl(refresh);
  if (!fresh) {
    return { streamUrl, refresh };
  }

  return {
    streamUrl: fresh,
    refresh: { ...refresh, seedStreamUrl: fresh },
  };
}

export const isRetryableMegaplayUpstreamStatus = (status: number) =>
  status === 401 ||
  status === 403 ||
  status === 404 ||
  status === 410 ||
  status === 502 ||
  status === 503;
