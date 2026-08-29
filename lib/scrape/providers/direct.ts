import { mintCalluspiratesClientSession } from "@/lib/direct/server-session";
import {
  collectStreamsFromDirectSse,
  type DirectSseStream,
} from "@/lib/direct/scrape-sse";
import {
  isStereoscopicDirectStream,
  rankDirectStreams,
} from "@calluspirates/shared";
import { orderDirectStreamsForScrape } from "@/lib/direct/playback";
import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "../calluspirates-config";
import { fetchCalluspirates } from "../calluspirates-fetch";
import type { DirectPlaybackMode } from "../direct-playback";
import { toClientDirectPlaybackUrl } from "../direct-proxy";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";

const PROVIDER_ID = "direct" as const;

type CalluspiratesStream = {
  name: string;
  resolution: string;
  size: number;
  url: string;
  playback?: "hls" | "direct" | "extended";
  fallbackUrl?: string;
  cached: boolean;
  hash: string;
  fileName?: string;
  mime?: string;
  browserPlayable?: boolean;
  source?: string;
};

const toCalluspiratesStream = (
  stream: DirectSseStream,
): CalluspiratesStream => ({
  name: stream.name,
  resolution: stream.resolution ?? "",
  size: stream.size ?? 0,
  url: stream.url,
  cached: stream.cached ?? true,
  hash: stream.hash,
  ...(stream.playback ? { playback: stream.playback } : {}),
  ...(stream.fallbackUrl ? { fallbackUrl: stream.fallbackUrl } : {}),
  ...(stream.fileName ? { fileName: stream.fileName } : {}),
  ...(stream.mime ? { mime: stream.mime } : {}),
  ...(stream.browserPlayable !== undefined
    ? { browserPlayable: stream.browserPlayable }
    : {}),
  ...(stream.source ? { source: stream.source } : {}),
});

const resolveClientMediaUrl = (
  apiBase: string,
  stream: CalluspiratesStream,
  accessToken?: string,
): string => toClientDirectPlaybackUrl(apiBase, stream.url, accessToken);

const resolveClientTranscodeUrl = (
  apiBase: string,
  stream: CalluspiratesStream,
  accessToken?: string,
): string => {
  if (stream.playback === "extended" && stream.fallbackUrl) {
    return toClientDirectPlaybackUrl(apiBase, stream.fallbackUrl, accessToken);
  }
  return resolveClientMediaUrl(apiBase, stream, accessToken);
};

type DirectScrapeCandidate = {
  name: string;
  url: string;
  resolution?: string;
  size?: number;
  playback?: "hls" | "direct" | "extended";
  fileName?: string;
  browserPlayable?: boolean;
};

export const pickDirectStreamForScrape = <T extends DirectScrapeCandidate>(
  streams: readonly T[],
  preferMultiTrack: boolean,
): T | null => {
  const ranked = orderDirectStreamsForScrape(
    rankDirectStreams([...streams]),
    preferMultiTrack,
  );

  return ranked.find((stream) => stream.url.trim().length > 0) ?? null;
};

const mapQualities = (
  apiBase: string,
  streams: CalluspiratesStream[],
  primaryTranscodeUrl: string,
  accessToken?: string,
): ScrapeQuality[] | undefined => {
  const qualities = streams
    .map((stream) => {
      const url = resolveClientTranscodeUrl(apiBase, stream, accessToken);
      const label = stream.resolution?.trim() || stream.name.slice(0, 40);
      return { label, url };
    })
    .filter((quality) => quality.url.length > 0);

  const unique = new Map<string, ScrapeQuality>();
  for (const quality of qualities) {
    if (!unique.has(quality.url)) {
      unique.set(quality.url, quality);
    }
  }

  const sorted = [...unique.values()].sort(
    (left, right) => qualityHeight(right.label) - qualityHeight(left.label),
  );

  if (sorted.length <= 1) {
    return undefined;
  }

  if (sorted.every((quality) => quality.url === primaryTranscodeUrl)) {
    return undefined;
  }

  return sorted;
};

const qualityHeight = (label: string): number => {
  const match = label.match(/\b(\d{3,4})p\b/i);
  if (match?.[1]) {
    return Number.parseInt(match[1], 10);
  }
  if (/\b4k\b/i.test(label)) {
    return 2160;
  }
  return 0;
};

export function inferDirectStreamKind(
  playUrl: string,
  directPlayback?: DirectPlaybackMode,
): "hls" | "mp4" {
  if (directPlayback === "hls") {
    return "hls";
  }

  if (
    playUrl.includes("/transcode/playlist") ||
    playUrl.includes("/direct/transcode/playlist")
  ) {
    return "hls";
  }

  try {
    const parsed = new URL(playUrl, "http://local.invalid");
    const upstream = parsed.searchParams.get("u") ?? "";
    if (/\.m3u8/i.test(upstream)) {
      return "hls";
    }
    if (/\.mp4|\.m4v|\.webm/i.test(upstream)) {
      return "mp4";
    }
    if (/\.mkv|matroska|\.hevc|\.x265/i.test(upstream)) {
      return "mp4";
    }
  } catch {
    // fall through
  }

  if (directPlayback === "extended") {
    return "mp4";
  }

  return playUrl.includes("/api/direct/media") ||
    /\/api\/media(?:[?#]|$)/.test(playUrl)
    ? "mp4"
    : "hls";
}

const DIRECT_SCRAPE_UPSTREAM_TIMEOUT_MS = 300_000;

const hasAnyPlayableStream = (streams: readonly DirectSseStream[]): boolean =>
  streams.some((stream) => stream.url.trim().length > 0);

async function fetchDirectStreamsForScrape(
  apiBase: string,
  input: ScrapeMediaInput,
  signal?: AbortSignal,
): Promise<CalluspiratesStream[] | null> {
  const upstreamUrl =
    input.mediaType === "tv"
      ? `${apiBase}/api/tv/${input.tmdbId}/streams/stream?season=${input.seasonNumber}&episode=${input.episodeNumber}`
      : `${apiBase}/api/movie/${input.tmdbId}/streams/stream`;

  const response = await fetchCalluspirates(upstreamUrl, {
    timeoutMs: DIRECT_SCRAPE_UPSTREAM_TIMEOUT_MS,
    responseKind: "event-stream",
    headers: { Accept: "text/event-stream" },
    signal,
  });

  if (!response.ok) {
    return null;
  }

  const payload = await collectStreamsFromDirectSse(
    response,
    signal ?? AbortSignal.timeout(DIRECT_SCRAPE_UPSTREAM_TIMEOUT_MS),
    hasAnyPlayableStream,
  );
  return payload.streams.map(toCalluspiratesStream);
}

export async function scrapeDirect(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  if (!isDirectScrapeProviderConfigured()) {
    return {
      ok: false,
      providerId: PROVIDER_ID,
      error: "Direct provider is not configured for this site",
    };
  }

  if (input.mediaType === "tv") {
    if (
      input.seasonNumber == null ||
      input.episodeNumber == null ||
      input.seasonNumber < 1 ||
      input.episodeNumber < 1
    ) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        error: "Direct TV scrape requires seasonNumber and episodeNumber",
      };
    }
  }

  const apiBase = getCalluspiratesApiUrl();
  if (!apiBase) {
    return {
      ok: false,
      providerId: PROVIDER_ID,
      error: "CALLUSPIRATES_API_URL is not configured",
    };
  }

  const referer = `${apiBase}/`;

  try {
    const discoveredStreams = await fetchDirectStreamsForScrape(
      apiBase,
      input,
      input.signal,
    );
    if (discoveredStreams?.length) {
      const streams = discoveredStreams.filter(
        (stream) => !isStereoscopicDirectStream(stream),
      );
      const preferMultiTrack = input.preferMultiTrack === true;
      const best = pickDirectStreamForScrape(streams, preferMultiTrack);
      if (best) {
        const session = await mintCalluspiratesClientSession();
        const accessToken = session?.token;
        const clientBase = session?.apiBase ?? apiBase;
        const mediaUrl = resolveClientMediaUrl(clientBase, best, accessToken);
        const fallbackUrl = best.fallbackUrl
          ? toClientDirectPlaybackUrl(clientBase, best.fallbackUrl, accessToken)
          : undefined;
        const transcodeUrl =
          fallbackUrl ??
          resolveClientTranscodeUrl(clientBase, best, accessToken);
        const qualities = mapQualities(
          clientBase,
          streams,
          transcodeUrl,
          accessToken,
        );

        return {
          ok: true,
          providerId: PROVIDER_ID,
          validated: true,
          streamUrl: mediaUrl,
          referer,
          qualities,
          directPlayback: best.playback ?? "direct",
          directFallbackUrl: fallbackUrl,
          directStreamName: best.name,
          directFileName: best.fileName,
        };
      }
    }

    return {
      ok: false,
      providerId: PROVIDER_ID,
      error: "No streams found",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      providerId: PROVIDER_ID,
      error:
        error instanceof Error
          ? error.message
          : "Direct provider scrape failed",
    };
  }
}
