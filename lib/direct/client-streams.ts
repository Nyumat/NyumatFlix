import { getCalluspiratesApiUrl } from "@/lib/scrape/calluspirates-config";
import { toClientDirectPlaybackUrl } from "@/lib/scrape/direct-proxy";
import { isStereoscopicDirectStream } from "@calluspirates/shared";
import { directDiscoveryJsonPath } from "@/lib/direct/discovery-paths";
import type { DirectStream, DirectStreamsResponse } from "@/lib/direct/types";

export { directDiscoveryJsonPath } from "@/lib/direct/discovery-paths";

export type DirectPlaybackTarget = {
  apiBase: string;
  accessToken: string;
};

export function rewriteStreamForClient(
  apiBase: string,
  stream: DirectStream,
  accessToken?: string,
): DirectStream {
  return {
    ...stream,
    url: toClientDirectPlaybackUrl(apiBase, stream.url, accessToken),
    fallbackUrl: stream.fallbackUrl
      ? toClientDirectPlaybackUrl(apiBase, stream.fallbackUrl, accessToken)
      : undefined,
  };
}

export function rewriteDirectStreamUrls(
  stream: DirectStream,
  target: DirectPlaybackTarget,
): DirectStream {
  return rewriteStreamForClient(target.apiBase, stream, target.accessToken);
}

export function rewriteStreamsResponse(
  apiBase: string,
  payload: DirectStreamsResponse,
  accessToken?: string,
): DirectStreamsResponse {
  return {
    ...payload,
    streams: (payload.streams ?? [])
      .filter((stream) => !isStereoscopicDirectStream(stream))
      .map((stream) => rewriteStreamForClient(apiBase, stream, accessToken)),
  };
}

type FetchDirectStreamsOptions = {
  signal?: AbortSignal;
  fresh?: boolean;
  /**
   * When true (default), return after the first SSE batch instead of waiting for
   * the full indexer scan (~25–70s on cold titles).
   */
  quick?: boolean;
};

const DIRECT_FETCH_RETRIES = 2;
const DIRECT_FETCH_RETRY_DELAY_MS = 500;

async function fetchDirectStreamsJson(
  path: string,
  options?: FetchDirectStreamsOptions,
): Promise<DirectStreamsResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= DIRECT_FETCH_RETRIES; attempt++) {
    if (options?.signal?.aborted) {
      throw new Error("Aborted");
    }

    if (attempt > 0) {
      await new Promise<void>((resolve) => {
        if (options?.signal?.aborted) {
          resolve();
          return;
        }
        const timer = setTimeout(
          resolve,
          DIRECT_FETCH_RETRY_DELAY_MS * attempt,
        );
        options?.signal?.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
      if (options?.signal?.aborted) {
        throw new Error("Aborted");
      }
    }

    try {
      const response = await fetch(path, {
        headers: { Accept: "application/json" },
        signal: options?.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const error = new Error(
          `Direct streams ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
        );
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          throw error;
        }
        lastError = error;
        continue;
      }

      return (await response.json()) as DirectStreamsResponse;
    } catch (err) {
      lastError = err;
      if (options?.signal?.aborted) {
        throw err;
      }
      if (
        err instanceof Error &&
        /Direct streams 4(?!29)\d\d/.test(err.message)
      ) {
        throw err;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `Direct streams request failed after ${DIRECT_FETCH_RETRIES} retries`,
      );
}

export async function fetchDirectMovieStreams(
  tmdbId: number,
  options?: FetchDirectStreamsOptions,
): Promise<DirectStreamsResponse> {
  const quick = options?.quick ?? true;
  return fetchDirectStreamsJson(
    directDiscoveryJsonPath("movie", tmdbId, {
      fresh: options?.fresh,
      quick,
    }),
    options,
  );
}

export async function fetchDirectTvStreams(
  tmdbId: number,
  season: number,
  episode: number,
  options?: FetchDirectStreamsOptions,
): Promise<DirectStreamsResponse> {
  const quick = options?.quick ?? true;
  return fetchDirectStreamsJson(
    directDiscoveryJsonPath("tv", tmdbId, {
      season,
      episode,
      fresh: options?.fresh,
      quick,
    }),
    options,
  );
}

export function isDirectMovieApiConfigured(): boolean {
  return Boolean(getCalluspiratesApiUrl());
}

export function isDirectTvApiConfigured(): boolean {
  return Boolean(getCalluspiratesApiUrl());
}
