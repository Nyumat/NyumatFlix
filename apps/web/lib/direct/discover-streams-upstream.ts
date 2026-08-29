import "server-only";

import {
  collectStreamsFromDirectSse,
  toDirectStreamsResponse,
} from "@/lib/direct/scrape-sse";
import type { DirectStreamsResponse } from "@nyumatflix/playback";
import { fetchCalluspirates } from "@/lib/scrape/calluspirates-fetch";

export type DiscoverStreamsUpstreamOptions = {
  signal?: AbortSignal;
  fresh?: boolean;
  /** Return after the first SSE batch with streams instead of waiting for done. */
  quick?: boolean;
};

const UPSTREAM_TIMEOUT_MS = 300_000;

function hasAnyStream(streams: ReadonlyArray<{ url: string }>): boolean {
  return streams.length > 0;
}

async function collectFromUpstreamSse(
  upstreamUrl: string,
  options?: DiscoverStreamsUpstreamOptions,
): Promise<DirectStreamsResponse> {
  const response = await fetchCalluspirates(upstreamUrl, {
    timeoutMs: UPSTREAM_TIMEOUT_MS,
    responseKind: "event-stream",
    headers: { Accept: "text/event-stream" },
    signal: options?.signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Upstream ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    );
  }

  const quick = options?.quick ?? false;
  const payload = await collectStreamsFromDirectSse(
    response,
    options?.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    quick ? hasAnyStream : () => false,
  );
  return toDirectStreamsResponse(payload);
}

export async function discoverMovieStreamsUpstream(
  apiBase: string,
  tmdbId: number,
  options?: DiscoverStreamsUpstreamOptions,
): Promise<DirectStreamsResponse> {
  const params = new URLSearchParams();
  if (options?.fresh) {
    params.set("fresh", "1");
  }
  const query = params.toString();
  const upstreamUrl = `${apiBase}/api/movie/${tmdbId}/streams/stream${query ? `?${query}` : ""}`;
  return collectFromUpstreamSse(upstreamUrl, options);
}

export async function discoverTvStreamsUpstream(
  apiBase: string,
  tmdbId: number,
  season: number,
  episode: number,
  options?: DiscoverStreamsUpstreamOptions,
): Promise<DirectStreamsResponse> {
  const params = new URLSearchParams({
    season: String(season),
    episode: String(episode),
  });
  if (options?.fresh) {
    params.set("fresh", "1");
  }
  const upstreamUrl = `${apiBase}/api/tv/${tmdbId}/streams/stream?${params.toString()}`;
  return collectFromUpstreamSse(upstreamUrl, options);
}
