import { cancelResponseBody, scrapeFetch } from "../fetch";
import { resolveHlsPlaylistUrl } from "../hls-url";
import { attachSubtitlesToQualities } from "../linked-config";
import {
  isHlsSourceUrl,
  rankSourcesHlsFirst,
  unwrapProxyUrl,
} from "../source-resolve";
import type {
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeResult,
  ScrapeSubtitle,
} from "../types";

const BINGR_ORIGIN = "https://bingr.one";
const BINGR_API = "https://api.bingr.one/api";

/** Cap each Bingr `/stream` server so a dead scraper cannot eat the 120s budget. */
export const BINGR_SERVER_TIMEOUT_MS = 12_000;
/** Cap HLS master probes so a stalled CDN cannot block the next source/server. */
export const BINGR_HLS_PROBE_TIMEOUT_MS = 8_000;

/**
 * Active Bingr scrapers (order matters):
 * - s3 Edmunds → HLS
 * - s2 Mann → HLS + proxied MP4
 * - s1 Miller → proxied MP4
 */
export const BINGR_SERVERS = ["s3", "s2", "s1"] as const;

export type BingrServer = (typeof BINGR_SERVERS)[number];

type BingrSource = {
  url?: string;
  type?: string;
  quality?: string;
  label?: string;
  headers?: {
    Referer?: string;
    Origin?: string;
  };
};

type BingrStreamResponse = {
  scraperName?: string;
  sources?: BingrSource[];
  subtitles?: Array<{
    lang?: string;
    label?: string;
    url?: string;
  }>;
};

type BingrDetails = {
  title?: string;
  year?: string | number;
};

export type BingrStreamBody = {
  srv: BingrServer;
  t: ScrapeMediaInput["mediaType"];
  id: string;
  query: Record<string, string | number>;
};

const bingrHeaders = {
  Accept: "application/json",
  Origin: BINGR_ORIGIN,
  Referer: `${BINGR_ORIGIN}/`,
} as const;

const encodeLooseUrl = (url: string): string => {
  try {
    const parsed = new URL(url.replace(/ /g, "%20"));
    return parsed.toString();
  } catch {
    return url.replace(/ /g, "%20");
  }
};

/** @deprecated Use unwrapProxyUrl from source-resolve */
export const unwrapBingrProxyUrl = unwrapProxyUrl;

const mergeAbortSignals = (
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

export const raceWithTimeout = async <T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onTimeout: T,
  options?: { signal?: AbortSignal },
): Promise<{ value: T; timedOut: boolean }> => {
  let winner: "work" | "timeout" | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const cancelController = new AbortController();
  const cancelSignal = options?.signal
    ? mergeAbortSignals(cancelController.signal, options.signal)
    : cancelController.signal;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      winner ??= "timeout";
      if (!cancelController.signal.aborted) {
        cancelController.abort();
      }
      resolve(onTimeout);
    }, timeoutMs);
  });

  try {
    const value = await Promise.race([
      work(cancelSignal).then((result) => {
        winner ??= "work";
        return result;
      }),
      timeoutPromise,
    ]);
    return { value, timedOut: winner === "timeout" };
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

export const buildBingrStreamBody = (
  input: ScrapeMediaInput,
  server: BingrServer,
  details: BingrDetails | null,
): BingrStreamBody => {
  const query: Record<string, string | number> = {};
  if (details?.title) {
    query.title = details.title;
  }
  if (details?.year != null && String(details.year).length > 0) {
    query.year = String(details.year);
  }

  switch (input.mediaType) {
    case "movie":
      break;
    case "tv":
      query.season = input.seasonNumber ?? 1;
      query.episode = input.episodeNumber ?? 1;
      break;
    default: {
      const _exhaustive: never = input.mediaType;
      throw new Error(`Unhandled Bingr media type ${_exhaustive}`);
    }
  }

  return {
    srv: server,
    t: input.mediaType,
    id: String(input.tmdbId),
    query,
  };
};

export const parseBingrAbrQualities = (
  masterUrl: string,
  body: string,
  referer: string,
): ScrapeQuality[] => {
  if (!body.includes("#EXT-X-STREAM-INF")) {
    return [];
  }

  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const qualities: ScrapeQuality[] = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.startsWith("#EXT-X-STREAM-INF")) {
      continue;
    }

    const uri = lines[index + 1];
    if (!uri || uri.startsWith("#")) {
      continue;
    }

    const resolved = resolveHlsPlaylistUrl(uri, masterUrl);
    if (!resolved) {
      continue;
    }

    const heightMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
    const height = heightMatch?.[1];
    qualities.push({
      label: height ? `${height}p` : `Source ${qualities.length + 1}`,
      url: resolved,
      referer,
    });
  }

  return qualities;
};

const headersFromProxyQuery = (
  url: string,
): { Referer?: string; Origin?: string } | undefined => {
  try {
    const parsed = new URL(url);
    const raw = parsed.searchParams.get("headers");
    if (!raw) {
      return undefined;
    }
    const parsedHeaders = JSON.parse(raw) as {
      Referer?: string;
      Origin?: string;
      referer?: string;
      origin?: string;
    };
    return {
      Referer: parsedHeaders.Referer ?? parsedHeaders.referer,
      Origin: parsedHeaders.Origin ?? parsedHeaders.origin,
    };
  } catch {
    return undefined;
  }
};

const resolvePlayable = (
  source: BingrSource,
): { streamUrl: string; referer: string; hls: boolean } | null => {
  const rawUrl = source.url;
  if (!rawUrl) {
    return null;
  }

  const proxyHeaders = headersFromProxyQuery(rawUrl);
  const unwrapped = unwrapProxyUrl(rawUrl);
  const hls =
    isHlsSourceUrl(source, unwrapped) || isHlsSourceUrl(source, rawUrl);

  // MP4 CDNs behind Bingr workers often 403 without the worker proxy.
  if (!hls && /\.workers\.dev$/i.test(new URL(rawUrl).hostname)) {
    return {
      streamUrl: rawUrl,
      referer:
        source.headers?.Referer ?? proxyHeaders?.Referer ?? `${BINGR_ORIGIN}/`,
      hls: false,
    };
  }

  const streamUrl = hls ? unwrapped : encodeLooseUrl(unwrapped);
  let referer = source.headers?.Referer ?? proxyHeaders?.Referer ?? undefined;

  if (!referer) {
    try {
      const host = new URL(streamUrl).hostname;
      if (/kkphimplayer/i.test(host)) {
        referer = `https://${host}/`;
      } else if (hls) {
        referer = "https://nextgencloudfabric.com/";
      } else {
        referer = "https://flaxmovies.xyz/";
      }
    } catch {
      referer = `${BINGR_ORIGIN}/`;
    }
  }

  return { streamUrl, referer, hls };
};

const mapSubtitles = (
  rows: BingrStreamResponse["subtitles"],
): ScrapeSubtitle[] | undefined => {
  if (!rows?.length) {
    return undefined;
  }

  const mapped = rows
    .filter((row): row is { url: string; lang?: string; label?: string } =>
      Boolean(row.url),
    )
    .map((row) => ({
      lang: row.lang || row.label || "und",
      url: row.url,
      format: "vtt" as const,
    }));

  return mapped.length > 0 ? mapped : undefined;
};

const detailsPath = (input: ScrapeMediaInput): string => {
  switch (input.mediaType) {
    case "movie":
      return `/details/movie/${input.tmdbId}`;
    case "tv":
      return `/details/tv/${input.tmdbId}`;
    default: {
      const _exhaustive: never = input.mediaType;
      throw new Error(`Unhandled Bingr media type ${_exhaustive}`);
    }
  }
};

const fetchDetails = async (
  input: ScrapeMediaInput,
): Promise<BingrDetails | null> => {
  try {
    const response = await scrapeFetch(`${BINGR_API}${detailsPath(input)}`, {
      headers: { ...bingrHeaders },
      timeoutMs: BINGR_SERVER_TIMEOUT_MS,
      retryAttempts: 1,
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }
    return (await response.json()) as BingrDetails;
  } catch {
    return null;
  }
};

const postStream = async (
  input: ScrapeMediaInput,
  server: BingrServer,
  details: BingrDetails | null,
  signal?: AbortSignal,
): Promise<BingrStreamResponse | null> => {
  try {
    const response = await scrapeFetch(`${BINGR_API}/stream`, {
      method: "POST",
      headers: {
        ...bingrHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBingrStreamBody(input, server, details)),
      timeoutMs: BINGR_SERVER_TIMEOUT_MS,
      retryAttempts: 1,
      signal,
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    return (await response.json()) as BingrStreamResponse;
  } catch {
    return null;
  }
};

const probeHlsMaster = async (
  streamUrl: string,
  referer: string,
  signal?: AbortSignal,
): Promise<{ body: string; qualities: ScrapeQuality[] } | null> => {
  try {
    const response = await scrapeFetch(streamUrl, {
      headers: { Referer: referer },
      timeoutMs: BINGR_HLS_PROBE_TIMEOUT_MS,
      retryAttempts: 1,
      signal,
    });
    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    const body = await response.text();
    if (!body.includes("#EXTM3U")) {
      return null;
    }

    return {
      body,
      qualities: parseBingrAbrQualities(streamUrl, body, referer),
    };
  } catch {
    return null;
  }
};

const probeMp4 = async (
  streamUrl: string,
  referer: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  try {
    const response = await scrapeFetch(streamUrl, {
      method: "GET",
      headers: {
        Referer: referer,
        Range: "bytes=0-511",
      },
      timeoutMs: BINGR_HLS_PROBE_TIMEOUT_MS,
      retryAttempts: 1,
      signal,
    });
    const ok = response.ok || response.status === 206;
    await cancelResponseBody(response);
    return ok;
  } catch {
    return false;
  }
};

export async function scrapeBingr(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "bingr" as const;

  try {
    const details = await fetchDetails(input);

    for (const server of BINGR_SERVERS) {
      const payloadResult = await raceWithTimeout(
        (signal) => postStream(input, server, details, signal),
        BINGR_SERVER_TIMEOUT_MS,
        null,
      );
      if (payloadResult.timedOut || !payloadResult.value) {
        continue;
      }

      const sources = payloadResult.value.sources?.filter((source) =>
        Boolean(source.url),
      );
      if (!sources?.length) {
        continue;
      }

      const subtitles = mapSubtitles(payloadResult.value.subtitles);
      const ranked = rankSourcesHlsFirst(sources);

      for (const source of ranked) {
        const resolved = resolvePlayable(source);
        if (!resolved) {
          continue;
        }

        const { streamUrl, referer, hls } = resolved;

        if (hls) {
          const master = await raceWithTimeout(
            (signal) => probeHlsMaster(streamUrl, referer, signal),
            BINGR_HLS_PROBE_TIMEOUT_MS + 500,
            null,
          );
          if (master.timedOut || !master.value) {
            continue;
          }

          // Full scrapeProvider validation hangs on some Bingr CDNs (30s × retries).
          // Probe the first rendition with the same cap, then skip the outer gate.
          const rendition = master.value.qualities[0];
          if (rendition) {
            const child = await raceWithTimeout(
              (signal) => probeHlsMaster(rendition.url, referer, signal),
              BINGR_HLS_PROBE_TIMEOUT_MS + 500,
              null,
            );
            if (child.timedOut || !child.value) {
              continue;
            }
          }

          return {
            ok: true,
            providerId,
            validated: true,
            streamUrl,
            referer,
            subtitles,
            qualities: attachSubtitlesToQualities(
              master.value.qualities.length > 1
                ? master.value.qualities
                : undefined,
              subtitles,
            ),
          };
        }

        const mp4 = await raceWithTimeout(
          (signal) => probeMp4(streamUrl, referer, signal),
          BINGR_HLS_PROBE_TIMEOUT_MS + 500,
          false,
        );
        if (mp4.timedOut || !mp4.value) {
          continue;
        }

        return {
          ok: true,
          providerId,
          validated: true,
          streamUrl,
          referer,
          subtitles,
        };
      }
    }

    return {
      ok: false,
      providerId,
      error: "Bingr returned no playable sources",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "Bingr scrape failed",
    };
  }
}
