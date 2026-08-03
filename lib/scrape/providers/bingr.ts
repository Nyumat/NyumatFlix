import { scrapeFetch, scrapeFetchText } from "../fetch";
import { extractAbrQualitiesFromMaster } from "../abr-qualities";
import { attachSubtitlesToQualities } from "../linked-config";
import {
  isHlsSourceUrl,
  rankSourcesHlsFirst,
  unwrapProxyUrl,
} from "../source-resolve";
import type { ScrapeMediaInput, ScrapeResult, ScrapeSubtitle } from "../types";

const BINGR_ORIGIN = "https://bingr.one";
const BINGR_API = "https://api.bingr.one/api";

/**
 * Active Bingr scrapers (order matters):
 * - s3 Edmunds → HLS
 * - s2 Mann → HLS + proxied MP4
 * - s1 Miller → proxied MP4
 */
const BINGR_SERVERS = ["s3", "s2", "s1"] as const;

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

const fetchDetails = async (
  input: ScrapeMediaInput,
): Promise<BingrDetails | null> => {
  const path =
    input.mediaType === "movie"
      ? `/details/movie/${input.tmdbId}`
      : `/details/tv/${input.tmdbId}`;

  const response = await scrapeFetchText(`${BINGR_API}${path}`, {
    ...bingrHeaders,
  });

  if (response.status !== 200) {
    return null;
  }

  try {
    return JSON.parse(response.text) as BingrDetails;
  } catch {
    return null;
  }
};

const postStream = async (
  input: ScrapeMediaInput,
  server: (typeof BINGR_SERVERS)[number],
  details: BingrDetails | null,
): Promise<BingrStreamResponse | null> => {
  const query: Record<string, string | number> = {};
  if (details?.title) {
    query.title = details.title;
  }
  if (details?.year != null && String(details.year).length > 0) {
    query.year = String(details.year);
  }
  if (input.mediaType === "tv") {
    query.season = input.seasonNumber ?? 1;
    query.episode = input.episodeNumber ?? 1;
  }

  const response = await scrapeFetch(`${BINGR_API}/stream`, {
    method: "POST",
    headers: {
      ...bingrHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      srv: server,
      t: input.mediaType,
      id: String(input.tmdbId),
      query,
    }),
  });

  if (!response.ok) {
    return null;
  }

  try {
    return (await response.json()) as BingrStreamResponse;
  } catch {
    return null;
  }
};

export async function scrapeBingr(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "bingr" as const;

  try {
    const details = await fetchDetails(input);

    for (const server of BINGR_SERVERS) {
      const payload = await postStream(input, server, details);
      const sources = payload?.sources?.filter((source) => Boolean(source.url));
      if (!sources?.length) {
        continue;
      }

      const subtitles = mapSubtitles(payload?.subtitles);
      const ranked = rankSourcesHlsFirst(sources);

      for (const source of ranked) {
        const resolved = resolvePlayable(source);
        if (!resolved) {
          continue;
        }

        const { streamUrl, referer, hls } = resolved;

        if (hls) {
          const abr = await extractAbrQualitiesFromMaster(streamUrl, referer);
          return {
            ok: true,
            providerId,
            streamUrl,
            referer,
            subtitles,
            qualities: attachSubtitlesToQualities(
              abr.length > 1 ? abr : undefined,
              subtitles,
            ),
          };
        }

        return {
          ok: true,
          providerId,
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
