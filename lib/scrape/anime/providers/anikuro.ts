import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const ANIKURO_ORIGIN = "https://anikuro.ru";
const ANIKURO_API = `${ANIKURO_ORIGIN}/api/v1`;

/** Prefer providers that return direct HLS with a usable upstream referer. */
const SOURCE_PROVIDERS = ["anikoto", "senshi"] as const;

type AnikuroSource = {
  url?: string;
  originalUrl?: string;
  upstreamReferer?: string;
  quality?: string;
  type?: string;
  isM3U8?: boolean;
  headers?: { Referer?: string; Origin?: string };
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

const pickStream = (
  track: AnikuroTrack | null | undefined,
): { url: string; referer: string; qualities?: ScrapeQuality[] } | null => {
  const sources = (track?.sources ?? []).filter(
    (source) =>
      Boolean(source.originalUrl ?? source.url) && source.isM3U8 !== false,
  );

  if (sources.length === 0) {
    if (track?.default) {
      return {
        url: absoluteUrl(track.default),
        referer: ANIKURO_ORIGIN,
      };
    }
    return null;
  }

  const best = sources[0]!;
  const streamUrl = best.originalUrl ?? absoluteUrl(best.url!);
  const referer =
    best.headers?.Referer ??
    best.upstreamReferer ??
    (streamUrl.includes("mewstream") || streamUrl.includes("megaplay")
      ? "https://megaplay.buzz/"
      : ANIKURO_ORIGIN);

  const qualities = sources
    .slice(1)
    .map((source) => {
      const url = source.originalUrl ?? absoluteUrl(source.url!);
      return {
        label: source.quality ?? "auto",
        url,
        referer: source.headers?.Referer ?? source.upstreamReferer ?? referer,
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
  provider: (typeof SOURCE_PROVIDERS)[number],
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
      const picked = pickStream(track);
      if (!picked) {
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
