import { getCalluspiratesApiUrl } from "@/lib/scrape/calluspirates-config";
import {
  rewritePlaybackUrlForBrowser,
  toClientDirectPlaybackUrl,
} from "@/lib/scrape/direct-proxy";
import { isStereoscopicDirectStream } from "@calluspirates/shared";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";

export function rewriteDirectStreamUrls(stream: DirectStream): DirectStream {
  return {
    ...stream,
    url: rewritePlaybackUrlForBrowser(stream.url),
    fallbackUrl: stream.fallbackUrl
      ? rewritePlaybackUrlForBrowser(stream.fallbackUrl)
      : undefined,
  };
}

export function rewriteStreamForClient(
  apiBase: string,
  stream: DirectStream,
): DirectStream {
  return {
    ...stream,
    url: toClientDirectPlaybackUrl(apiBase, stream.url),
    fallbackUrl: stream.fallbackUrl
      ? toClientDirectPlaybackUrl(apiBase, stream.fallbackUrl)
      : undefined,
  };
}

export function rewriteStreamsResponse(
  apiBase: string,
  payload: DirectStreamsResponse,
): DirectStreamsResponse {
  return {
    ...payload,
    streams: (payload.streams ?? [])
      .filter((stream) => !isStereoscopicDirectStream(stream))
      .map((stream) => rewriteStreamForClient(apiBase, stream)),
  };
}

type FetchDirectStreamsOptions = {
  signal?: AbortSignal;
  fresh?: boolean;
};

function buildFreshQuery(fresh?: boolean): string {
  return fresh ? "?fresh=1" : "";
}

export async function fetchDirectMovieStreams(
  tmdbId: number,
  options?: FetchDirectStreamsOptions,
): Promise<DirectStreamsResponse> {
  const freshQuery = buildFreshQuery(options?.fresh);
  const response = await fetch(
    `/api/direct/movie/${tmdbId}/streams${freshQuery}`,
    {
      headers: { Accept: "application/json" },
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Direct streams ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    );
  }

  return (await response.json()) as DirectStreamsResponse;
}

export async function fetchDirectTvStreams(
  tmdbId: number,
  season: number,
  episode: number,
  options?: FetchDirectStreamsOptions,
): Promise<DirectStreamsResponse> {
  const params = new URLSearchParams({
    season: String(season),
    episode: String(episode),
  });
  if (options?.fresh) {
    params.set("fresh", "1");
  }
  const response = await fetch(
    `/api/direct/tv/${tmdbId}/streams?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal: options?.signal,
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Direct TV streams ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
    );
  }

  return (await response.json()) as DirectStreamsResponse;
}

export function isDirectMovieApiConfigured(): boolean {
  return Boolean(getCalluspiratesApiUrl());
}

export function isDirectTvApiConfigured(): boolean {
  return Boolean(getCalluspiratesApiUrl());
}
