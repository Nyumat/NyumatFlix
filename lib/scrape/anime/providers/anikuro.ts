import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";
import { probeScrapePlaybackPath } from "../../playback-probe";
import { validateStreamUrlWithReferers } from "../../validate-stream";

const ANIKURO_ORIGIN = "https://anikuro.ru";
const ANIKURO_API = `${ANIKURO_ORIGIN}/api/v1`;

/** Mirrors AniKuro's parallel source race — ordered by typical playability from our egress. */
const SOURCE_PROVIDERS = [
  "anikoto",
  "senshi",
  "animix",
  "animepahe",
  "allanime",
  "reanime",
  "animedao",
] as const;

type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

type AnikuroSource = {
  url?: string;
  originalUrl?: string;
  upstreamReferer?: string;
  quality?: string;
  type?: string;
  isM3U8?: boolean;
  headers?: { Referer?: string; Origin?: string; referer?: string };
};

type AnikuroTrack = {
  default?: string;
  sources?: AnikuroSource[];
  subtitles?: Array<{
    file?: string;
    url?: string;
    label?: string;
    lang?: string;
  }>;
  headers?: { Referer?: string; referer?: string };
  upstreamReferer?: string;
};

type AnikuroSourcesResponse = {
  ok?: boolean;
  data?: {
    provider?: string;
    raw?: {
      sub?: AnikuroTrack | null;
      dub?: AnikuroTrack | null;
      error?: string;
    };
  };
  error?: { message?: string };
};

const SOURCE_TIMEOUT_MS = 25_000;

const absoluteUrl = (url: string): string => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${ANIKURO_ORIGIN}${url}`;
  }
  return url;
};

const headerReferer = (
  source: AnikuroSource | AnikuroTrack | null | undefined,
): string | undefined =>
  source?.headers?.Referer ??
  source?.headers?.referer ??
  source?.upstreamReferer;

const prefersAnikuroProxy = (
  sourceProvider: SourceProvider,
  source: AnikuroSource,
): boolean =>
  sourceProvider === "senshi" ||
  Boolean(source.url?.startsWith("/api/v1/proxy/"));

const pickStream = (
  track: AnikuroTrack | null | undefined,
  sourceProvider: SourceProvider,
): { url: string; referer: string; qualities?: ScrapeQuality[] } | null => {
  const sources = (track?.sources ?? []).filter(
    (source) =>
      Boolean(source.originalUrl ?? source.url) && source.isM3U8 !== false,
  );

  if (sources.length === 0) {
    if (track?.default) {
      const defaultUrl = absoluteUrl(track.default);
      return {
        url: defaultUrl,
        referer:
          headerReferer(track) ??
          (defaultUrl.includes("proxy.anikuro.ru") ||
          defaultUrl.includes("/api/v1/proxy/")
            ? ANIKURO_ORIGIN
            : "https://megaplay.buzz/"),
      };
    }
    return null;
  }

  const best = sources[0]!;
  const streamUrl = prefersAnikuroProxy(sourceProvider, best)
    ? absoluteUrl(best.url ?? best.originalUrl!)
    : (best.originalUrl ?? absoluteUrl(best.url!));
  const referer =
    headerReferer(best) ??
    headerReferer(track) ??
    (streamUrl.includes("ninstream") || sourceProvider === "senshi"
      ? "https://senshi.live/"
      : streamUrl.includes("mewstream") || streamUrl.includes("megaplay")
        ? "https://megaplay.buzz/"
        : streamUrl.includes("proxy.anikuro.ru") ||
            streamUrl.includes("/api/v1/proxy/")
          ? ANIKURO_ORIGIN
          : ANIKURO_ORIGIN);

  const qualities = sources
    .slice(1)
    .map((source) => {
      const url = prefersAnikuroProxy(sourceProvider, source)
        ? absoluteUrl(source.url ?? source.originalUrl!)
        : (source.originalUrl ?? absoluteUrl(source.url!));
      return {
        label: source.quality ?? "auto",
        url,
        referer: headerReferer(source) ?? referer,
      };
    })
    .filter((quality) => quality.url !== streamUrl);

  return {
    url: streamUrl,
    referer,
    qualities: qualities.length > 0 ? qualities : undefined,
  };
};

const mapSubtitles = (
  track: AnikuroTrack | null | undefined,
): ScrapeSubtitle[] | undefined => {
  const mapped = (track?.subtitles ?? [])
    .map((subtitle) => ({
      lang: subtitle.label ?? subtitle.lang ?? "Unknown",
      url: absoluteUrl(subtitle.file ?? subtitle.url ?? ""),
      format: "vtt" as const,
    }))
    .filter((subtitle) => Boolean(subtitle.url));

  return mapped.length > 0 ? mapped : undefined;
};

const fetchSources = async (
  provider: SourceProvider,
  episodeId: string,
): Promise<AnikuroSourcesResponse | null> => {
  try {
    const response = await scrapeFetch(
      `${ANIKURO_API}/sources/${provider}/${episodeId}`,
      {
        headers: {
          Accept: "application/json",
          Origin: ANIKURO_ORIGIN,
          Referer: `${ANIKURO_ORIGIN}/`,
        },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    return (await response.json()) as AnikuroSourcesResponse;
  } catch {
    return null;
  }
};

const isPlayableCandidate = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> => {
  const validation = await validateStreamUrlWithReferers(
    streamUrl,
    referer,
    "hls",
    { depth: "full" },
  );
  if (!validation.ok) {
    return false;
  }

  const playbackReferer = referer || validation.referer;
  return probeScrapePlaybackPath({
    url: streamUrl,
    referer: playbackReferer,
  });
};

export async function scrapeAnikuro(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anikuro" as const;
  const episodeId = `${input.anilistId}:${input.episodeNumber}`;
  const preferDub = input.translationType === "dub";

  try {
    for (const sourceProvider of SOURCE_PROVIDERS) {
      const payload = await fetchSources(sourceProvider, episodeId);
      if (!payload?.ok || !payload.data?.raw) {
        continue;
      }

      const raw = payload.data.raw;
      if (raw.error && !raw.sub && !raw.dub) {
        continue;
      }

      const track = preferDub ? (raw.dub ?? raw.sub) : (raw.sub ?? raw.dub);
      const picked = pickStream(track, sourceProvider);
      if (!picked) {
        continue;
      }

      if (!(await isPlayableCandidate(picked.url, picked.referer))) {
        continue;
      }

      return {
        ok: true,
        providerId,
        streamUrl: picked.url,
        streamKind: "hls",
        referer: picked.referer,
        subtitles: mapSubtitles(track),
        qualities: picked.qualities,
        preferredAudioLang: preferredAudioLangForTranslation(
          input.translationType,
        ),
      };
    }

    return {
      ok: false,
      providerId,
      error: "AniKuro returned no playable sources",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AniKuro scrape failed",
    };
  }
}
