import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";
import { probeScrapePlaybackPath } from "../../playback-probe";
import { raceFirstOk } from "../../race-first";
import { scrapeAllmanga } from "./allmanga";

const ANIKURO_ORIGINS = ["https://anikuro.ru", "https://anikuro.to"] as const;

/**
 * Live keys from /api/v1/sources invalid_provider.details.supported.
 * `allani` answers quickly; most others currently CF-504.
 */
const SOURCE_PROVIDERS = [
  "allani",
  "animepahe",
  "anikoto",
  "animegg",
  "senshi",
  "animix",
  "reanime",
  "animedao",
  "anidb",
  "animedunya",
  "animeverse",
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

const FAST_SOURCE_TIMEOUT_MS = 8_000;
const SLOW_SOURCE_TIMEOUT_MS = 14_000;

const absoluteUrl = (origin: string, url: string): string => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${origin}${url}`;
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
): boolean => {
  const candidate = source.url ?? source.originalUrl ?? "";
  if (/nekostream|mewstream|megaplay/i.test(candidate)) {
    return Boolean(source.url);
  }
  return (
    sourceProvider === "senshi" ||
    (typeof source.url === "string" && source.url.startsWith("/api/v1/proxy/"))
  );
};

const pickStream = (
  origin: string,
  track: AnikuroTrack | null | undefined,
  sourceProvider: SourceProvider,
): { url: string; referer: string; qualities?: ScrapeQuality[] } | null => {
  const sources = (track?.sources ?? []).filter(
    (source) =>
      Boolean(source.originalUrl ?? source.url) && source.isM3U8 !== false,
  );

  if (sources.length === 0) {
    if (track?.default) {
      const defaultUrl = absoluteUrl(origin, track.default);
      return {
        url: defaultUrl,
        referer:
          headerReferer(track) ??
          (defaultUrl.includes("proxy.anikuro.") ||
          defaultUrl.includes("/api/v1/proxy/")
            ? origin
            : "https://megaplay.buzz/"),
      };
    }
    return null;
  }

  const best = sources[0]!;
  const streamUrl = prefersAnikuroProxy(sourceProvider, best)
    ? absoluteUrl(origin, best.url ?? best.originalUrl!)
    : (best.originalUrl ?? absoluteUrl(origin, best.url!));
  const referer =
    headerReferer(best) ??
    headerReferer(track) ??
    (streamUrl.includes("ninstream") || sourceProvider === "senshi"
      ? "https://senshi.live/"
      : streamUrl.includes("mewstream") || streamUrl.includes("megaplay")
        ? "https://megaplay.buzz/"
        : origin);

  const qualities = sources
    .slice(1)
    .map((source) => {
      const url = prefersAnikuroProxy(sourceProvider, source)
        ? absoluteUrl(origin, source.url ?? source.originalUrl!)
        : (source.originalUrl ?? absoluteUrl(origin, source.url!));
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
  origin: string,
  track: AnikuroTrack | null | undefined,
): ScrapeSubtitle[] | undefined => {
  const mapped = (track?.subtitles ?? [])
    .map((subtitle) => ({
      lang: subtitle.label ?? subtitle.lang ?? "Unknown",
      url: absoluteUrl(origin, subtitle.file ?? subtitle.url ?? ""),
      format: "vtt" as const,
    }))
    .filter((subtitle) => Boolean(subtitle.url));

  return mapped.length > 0 ? mapped : undefined;
};

const fetchSources = async (
  origin: string,
  provider: SourceProvider,
  episodeId: string,
  timeoutMs: number,
): Promise<{ origin: string; payload: AnikuroSourcesResponse } | null> => {
  try {
    const response = await scrapeFetch(
      `${origin}/api/v1/sources/${provider}/${episodeId}`,
      {
        headers: {
          Accept: "application/json",
          Origin: origin,
          Referer: `${origin}/watch/${episodeId}`,
        },
        timeoutMs,
        retryAttempts: 1,
      },
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return null;
    }

    return {
      origin,
      payload: (await response.json()) as AnikuroSourcesResponse,
    };
  } catch {
    return null;
  }
};

const isPlayableCandidate = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> => {
  try {
    return probeScrapePlaybackPath(
      {
        url: streamUrl,
        referer,
      },
      "hls",
    );
  } catch {
    return false;
  }
};

type AnikuroWinner = {
  origin: string;
  track: AnikuroTrack | null | undefined;
  picked: { url: string; referer: string; qualities?: ScrapeQuality[] };
};

const tryProviderBatch = async (
  origins: readonly string[],
  providers: readonly SourceProvider[],
  episodeId: string,
  preferDub: boolean,
  timeoutMs: number,
): Promise<AnikuroWinner | null> => {
  const attempts = origins.flatMap((origin) =>
    providers.map((sourceProvider) => ({ origin, sourceProvider })),
  );

  const winner = await raceFirstOk(
    attempts,
    async ({ origin, sourceProvider }) => {
      const fetched = await fetchSources(
        origin,
        sourceProvider,
        episodeId,
        timeoutMs,
      );
      if (!fetched?.payload.ok || !fetched.payload.data?.raw) {
        return null;
      }

      const raw = fetched.payload.data.raw;
      if (raw.error && !raw.sub && !raw.dub) {
        return null;
      }

      const track = preferDub ? (raw.dub ?? raw.sub) : (raw.sub ?? raw.dub);
      const picked = pickStream(fetched.origin, track, sourceProvider);
      if (!picked) {
        return null;
      }

      if (!(await isPlayableCandidate(picked.url, picked.referer))) {
        return null;
      }

      return {
        origin: fetched.origin,
        track,
        picked,
      } satisfies AnikuroWinner;
    },
  );

  return winner?.value ?? null;
};

/**
 * AniKuro's allani worker maps AniList → AllAnime showId but its aaReq is
 * stale (empty sourceUrls). Finish the hop with our fixed AllAnime client.
 */
const fallbackViaAllmanga = async (
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult | null> => {
  const result = await scrapeAllmanga(input);
  if (!result.ok) {
    return null;
  }

  return {
    ...result,
    providerId: "anikuro",
  };
};

export async function scrapeAnikuro(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anikuro" as const;
  const episodeId = `${input.anilistId}:${input.episodeNumber}`;
  const preferDub = input.translationType === "dub";

  try {
    // Fast path: allani only (usually 200 in ~1s, even when sources empty).
    const fast = await tryProviderBatch(
      ANIKURO_ORIGINS,
      ["allani"],
      episodeId,
      preferDub,
      FAST_SOURCE_TIMEOUT_MS,
    );
    if (fast) {
      return {
        ok: true,
        providerId,
        validated: true,
        streamUrl: fast.picked.url,
        streamKind: "hls",
        referer: fast.picked.referer,
        subtitles: mapSubtitles(fast.origin, fast.track),
        qualities: fast.picked.qualities,
        preferredAudioLang: preferredAudioLangForTranslation(
          input.translationType,
        ),
      };
    }

    // AllAnime fallback before waiting on CF-504 workers.
    const fallback = await fallbackViaAllmanga(input);
    if (fallback?.ok) {
      return fallback;
    }

    const remaining = SOURCE_PROVIDERS.filter(
      (provider) => provider !== "allani",
    );
    const slow = await tryProviderBatch(
      ANIKURO_ORIGINS,
      remaining,
      episodeId,
      preferDub,
      SLOW_SOURCE_TIMEOUT_MS,
    );
    if (slow) {
      return {
        ok: true,
        providerId,
        validated: true,
        streamUrl: slow.picked.url,
        streamKind: "hls",
        referer: slow.picked.referer,
        subtitles: mapSubtitles(slow.origin, slow.track),
        qualities: slow.picked.qualities,
        preferredAudioLang: preferredAudioLangForTranslation(
          input.translationType,
        ),
      };
    }

    return {
      ok: false,
      providerId,
      error:
        "AniKuro source workers unavailable (504 / empty) and AllAnime fallback failed",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AniKuro scrape failed",
    };
  }
}
