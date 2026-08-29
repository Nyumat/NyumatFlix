import { scrapeFetchText } from "./fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
} from "./playback-probe";
import { SUB1X2_SUBTITLE_ORIGIN } from "./subtitle-origin";
import type { ScrapeMediaInput, ScrapeSubtitle } from "./types";

export { SUB1X2_SUBTITLE_ORIGIN };

/** TMDB-indexed softsub catalog used by VidRock's player (sub.vdrk.site). */
export const VDRK_CATALOG_SUBTITLE_ORIGIN = "https://sub.vdrk.site";
export const VDRK_CATALOG_SUBTITLE_REFERER = "https://vidrock.net/";

type Sub1x2SubtitleEntry = {
  label?: string;
  language?: string;
  url?: string;
};

type VdrkCatalogSubtitleEntry = {
  label?: string;
  language?: string;
  lang?: string;
  url?: string;
  file?: string;
};

export const buildSub1x2SubtitleApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${SUB1X2_SUBTITLE_ORIGIN}/api/movie/${input.tmdbId}`;
  }

  return `${SUB1X2_SUBTITLE_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

export const buildVdrkCatalogSubtitleApiUrl = (
  input: ScrapeMediaInput,
): string => {
  if (input.mediaType === "movie") {
    return `${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/movie/${input.tmdbId}`;
  }

  return `${VDRK_CATALOG_SUBTITLE_ORIGIN}/v1/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

export const resolveSub1x2SubtitleUrl = (
  relativeOrAbsolute: string,
): string => {
  if (relativeOrAbsolute.startsWith("http")) {
    return relativeOrAbsolute;
  }

  return `${SUB1X2_SUBTITLE_ORIGIN}${relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`}`;
};

const subtitleFormatFromUrl = (url: string): ScrapeSubtitle["format"] => {
  if (/\.srt(?:[?#]|$)/i.test(url)) {
    return "srt";
  }

  return "vtt";
};

const parseSub1x2SubtitleEntries = (payload: unknown): ScrapeSubtitle[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((entry: Sub1x2SubtitleEntry) => {
    if (!entry.url) {
      return [];
    }

    return [
      {
        lang: entry.label ?? entry.language ?? "und",
        url: resolveSub1x2SubtitleUrl(entry.url),
        format: "vtt" as const,
      },
    ];
  });
};

const normalizeVdrkCatalogSubtitleEntry = (
  entry: VdrkCatalogSubtitleEntry,
  fallbackLang?: string,
): ScrapeSubtitle | null => {
  const url = entry.file ?? entry.url;
  if (!url?.startsWith("http")) {
    return null;
  }

  const lang =
    entry.label ?? entry.language ?? entry.lang ?? fallbackLang ?? "und";

  return {
    lang,
    url,
    format: subtitleFormatFromUrl(url),
    referer: VDRK_CATALOG_SUBTITLE_REFERER,
  };
};

export const parseVdrkCatalogSubtitleEntries = (
  payload: unknown,
): ScrapeSubtitle[] => {
  const fromRows = (rows: VdrkCatalogSubtitleEntry[], fallbackLang?: string) =>
    rows.flatMap((entry) => {
      const track = normalizeVdrkCatalogSubtitleEntry(entry, fallbackLang);
      return track ? [track] : [];
    });

  if (Array.isArray(payload)) {
    return fromRows(payload);
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["subtitles", "data", "results", "items", "list"]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return fromRows(nested as VdrkCatalogSubtitleEntry[]);
    }
  }

  return Object.entries(record).flatMap(([key, value]) => {
    if (!value || typeof value !== "object") {
      return [];
    }

    const track = normalizeVdrkCatalogSubtitleEntry(
      value as VdrkCatalogSubtitleEntry,
      key,
    );
    return track ? [track] : [];
  });
};

export async function fetchSub1x2Subtitles(
  input: ScrapeMediaInput,
): Promise<ScrapeSubtitle[]> {
  const response = await scrapeFetchText(buildSub1x2SubtitleApiUrl(input), {
    Accept: "application/json",
  });

  if (response.status !== 200) {
    return [];
  }

  try {
    const payload = JSON.parse(response.text) as unknown;
    return parseSub1x2SubtitleEntries(payload);
  } catch {
    return [];
  }
}

export async function fetchVdrkCatalogSubtitles(
  input: ScrapeMediaInput,
): Promise<ScrapeSubtitle[]> {
  const response = await scrapeFetchText(
    buildVdrkCatalogSubtitleApiUrl(input),
    {
      Accept: "application/json",
      Referer: VDRK_CATALOG_SUBTITLE_REFERER,
      Origin: VDRK_CATALOG_SUBTITLE_REFERER.replace(/\/$/, ""),
    },
    {
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
    },
  );

  if (response.status !== 200) {
    return [];
  }

  try {
    const payload = JSON.parse(response.text) as unknown;
    return parseVdrkCatalogSubtitleEntries(payload);
  } catch {
    return [];
  }
}

/** Shared softsub fallback chain for TMDB scrapes when providers ship bare video. */
export async function fetchScrapeFallbackSubtitles(
  input: ScrapeMediaInput,
): Promise<ScrapeSubtitle[]> {
  const sub1x2Subtitles = await fetchSub1x2Subtitles(input);
  if (sub1x2Subtitles.length > 0) {
    return sub1x2Subtitles;
  }

  return fetchVdrkCatalogSubtitles(input);
}
