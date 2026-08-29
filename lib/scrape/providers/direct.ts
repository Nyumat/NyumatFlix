import {
  getCalluspiratesApiUrl,
  isDirectScrapeProviderConfigured,
} from "../calluspirates-config";
import { fetchCalluspirates } from "../calluspirates-fetch";
import type { DirectPlaybackMode } from "../direct-playback";
import {
  toClientDirectPlaybackUrl,
  toUpstreamCalluspiratesPlaybackUrl,
} from "../direct-proxy";
import {
  isDirectBrowserMedia,
  isExtendedContainerMedia,
} from "../direct-media-probe";
import {
  isStereoscopicDirectStream,
  rankDirectStreams,
} from "@calluspirates/shared";
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

type CalluspiratesStreamsResponse = {
  streams: CalluspiratesStream[];
  message?: string;
};

const resolveClientMediaUrl = (
  apiBase: string,
  stream: CalluspiratesStream,
): string => toClientDirectPlaybackUrl(apiBase, stream.url);

const resolveUpstreamMediaUrl = (
  apiBase: string,
  stream: CalluspiratesStream,
): string => toUpstreamCalluspiratesPlaybackUrl(apiBase, stream.url);

const resolveClientTranscodeUrl = (
  apiBase: string,
  stream: CalluspiratesStream,
): string => {
  if (stream.playback === "extended" && stream.fallbackUrl) {
    return toClientDirectPlaybackUrl(apiBase, stream.fallbackUrl);
  }
  return resolveClientMediaUrl(apiBase, stream);
};

async function probeCalluspiratesMediaUrl(
  apiBase: string,
  stream: CalluspiratesStream,
  mode: "direct-mp4" | "extended",
): Promise<boolean> {
  const url = resolveUpstreamMediaUrl(apiBase, stream);
  try {
    const response = await fetchCalluspirates(url, {
      method: "GET",
      headers: { Range: "bytes=0-8191" },
      timeoutMs: 20_000,
    });
    if (!response.ok && response.status !== 206) {
      return false;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type");
    return mode === "direct-mp4"
      ? isDirectBrowserMedia(contentType, bytes)
      : isExtendedContainerMedia(contentType, bytes);
  } catch {
    return false;
  }
}

function streamNameBlob(stream: CalluspiratesStream): string {
  return `${stream.fileName ?? ""} ${stream.name}`.toLowerCase();
}

/** 50GB+ remux MKVs routinely crash movi WASM — probe encodes before remux. */
function isHeavyMoviRemux(stream: CalluspiratesStream): boolean {
  return /\b(remux|complete\.bluray)\b/.test(streamNameBlob(stream));
}

function orderExtendedForMoviPlayback(
  streams: CalluspiratesStream[],
): CalluspiratesStream[] {
  const light: CalluspiratesStream[] = [];
  const heavy: CalluspiratesStream[] = [];

  for (const stream of streams) {
    if (stream.playback === "direct" && stream.browserPlayable === true) {
      continue;
    }
    if (isHeavyMoviRemux(stream)) {
      heavy.push(stream);
    } else {
      light.push(stream);
    }
  }

  const bySize = (left: CalluspiratesStream, right: CalluspiratesStream) =>
    (left.size > 0 ? left.size : Number.MAX_SAFE_INTEGER) -
    (right.size > 0 ? right.size : Number.MAX_SAFE_INTEGER);

  light.sort(bySize);
  heavy.sort(bySize);

  return [...light, ...heavy];
}

async function pickValidatedDirectStream(
  apiBase: string,
  streams: CalluspiratesStream[],
): Promise<CalluspiratesStream | null> {
  const ranked = rankDirectStreams(streams);

  const directCandidates = ranked.filter(
    (stream) => stream.playback === "direct" && stream.browserPlayable === true,
  );
  for (const stream of directCandidates) {
    if (await probeCalluspiratesMediaUrl(apiBase, stream, "direct-mp4")) {
      return stream;
    }
  }

  for (const stream of orderExtendedForMoviPlayback(ranked)) {
    // Match calluspirates: accept MKV/extended when media bytes validate.
    // HLS transcode is a client-side fallback (movi → vidstack-hls), not a scrape gate.
    if (await probeCalluspiratesMediaUrl(apiBase, stream, "extended")) {
      return stream;
    }
  }
  return null;
}

const mapQualities = (
  apiBase: string,
  streams: CalluspiratesStream[],
  primaryTranscodeUrl: string,
): ScrapeQuality[] | undefined => {
  const qualities = streams
    .map((stream) => {
      const url = resolveClientTranscodeUrl(apiBase, stream);
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
    const streamsUrl =
      input.mediaType === "tv"
        ? `${apiBase}/api/tv/${input.tmdbId}/streams?season=${input.seasonNumber}&episode=${input.episodeNumber}`
        : `${apiBase}/api/movie/${input.tmdbId}/streams`;

    const response = await fetchCalluspirates(streamsUrl, {
      timeoutMs: 120_000,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        providerId: PROVIDER_ID,
        error: `Call Us Pirates API ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`,
      };
    }

    const payload = (await response.json()) as CalluspiratesStreamsResponse;
    const streams = (payload.streams ?? []).filter(
      (stream) => !isStereoscopicDirectStream(stream),
    );

    if (!streams.length) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        error: payload.message ?? "No cached streams available",
      };
    }

    const best = await pickValidatedDirectStream(apiBase, streams);
    if (!best) {
      return {
        ok: false,
        providerId: PROVIDER_ID,
        error: "No playable streams returned (all sources failed validation)",
      };
    }

    const mediaUrl = resolveClientMediaUrl(apiBase, best);
    const fallbackUrl = best.fallbackUrl
      ? toClientDirectPlaybackUrl(apiBase, best.fallbackUrl)
      : undefined;
    const transcodeUrl =
      fallbackUrl ?? resolveClientTranscodeUrl(apiBase, best);
    const qualities = mapQualities(apiBase, streams, transcodeUrl);

    return {
      ok: true,
      providerId: PROVIDER_ID,
      validated: true,
      streamUrl: mediaUrl,
      referer,
      qualities,
      directPlayback: best.playback ?? "direct",
      directFallbackUrl: fallbackUrl,
    };
  } catch (error) {
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
