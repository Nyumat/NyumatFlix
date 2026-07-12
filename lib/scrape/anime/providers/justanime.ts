import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const JUSTANIME_ORIGIN = "https://justanime.to";
const JUSTANIME_API = "https://core.justanime.to/api";

type JustAnimeSource = {
  url?: string;
  quality?: string;
  isM3U8?: boolean;
};

type JustAnimeAninekoResponse = {
  sources?: JustAnimeSource[];
  headers?: { Referer?: string; Origin?: string };
  subtitles?: Array<{ url?: string; lang?: string; label?: string }>;
  error?: string;
};

type JustAnimeMegaplayTrack = {
  sources?: JustAnimeSource[];
  headers?: { Referer?: string; Origin?: string };
  subtitles?: Array<{
    file?: string;
    url?: string;
    label?: string;
    lang?: string;
  }>;
};

type JustAnimeMegaplayResponse = {
  sub?: JustAnimeMegaplayTrack;
  dub?: JustAnimeMegaplayTrack;
  error?: string;
};

const qualityRank = (label: string | undefined): number => {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("1080")) return 1080;
  if (normalized.includes("720")) return 720;
  if (normalized.includes("480")) return 480;
  if (normalized.includes("360")) return 360;
  if (normalized.includes("auto") || normalized.includes("master")) return 900;
  return 0;
};

const pickBestSource = (
  sources: JustAnimeSource[] | undefined,
): JustAnimeSource | undefined => {
  const playable = (sources ?? []).filter(
    (source) => Boolean(source.url) && source.isM3U8 !== false,
  );
  if (playable.length === 0) {
    return undefined;
  }

  return [...playable].sort(
    (a, b) => qualityRank(b.quality) - qualityRank(a.quality),
  )[0];
};

const mapQualities = (
  sources: JustAnimeSource[] | undefined,
  bestUrl: string,
  referer: string,
): ScrapeQuality[] | undefined => {
  const extras = (sources ?? [])
    .filter(
      (source) =>
        Boolean(source.url) &&
        source.url !== bestUrl &&
        source.isM3U8 !== false,
    )
    .map((source) => ({
      label: source.quality ?? "auto",
      url: source.url!,
      referer,
    }));

  return extras.length > 0 ? extras : undefined;
};

const mapAninekoSubtitles = (
  subtitles: JustAnimeAninekoResponse["subtitles"],
): ScrapeSubtitle[] | undefined => {
  const mapped = (subtitles ?? [])
    .filter((track) => Boolean(track.url))
    .map((track) => ({
      lang: track.lang ?? track.label ?? "Unknown",
      url: track.url!,
      format: "vtt" as const,
    }));

  return mapped.length > 0 ? mapped : undefined;
};

const mapMegaplaySubtitles = (
  subtitles: JustAnimeMegaplayTrack["subtitles"],
): ScrapeSubtitle[] | undefined => {
  const mapped = (subtitles ?? [])
    .map((track) => ({
      lang: track.label ?? track.lang ?? "Unknown",
      url: track.file ?? track.url ?? "",
      format: "vtt" as const,
    }))
    .filter((track) => Boolean(track.url));

  return mapped.length > 0 ? mapped : undefined;
};

const fetchJson = async <T>(url: string): Promise<T | null> => {
  const response = await scrapeFetch(url, {
    headers: {
      Accept: "application/json",
      Origin: JUSTANIME_ORIGIN,
      Referer: `${JUSTANIME_ORIGIN}/`,
    },
  });

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  return (await response.json()) as T;
};

const scrapeAnineko = async (
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult | null> => {
  const lang = input.translationType === "dub" ? "dub" : "sub";
  const payload = await fetchJson<JustAnimeAninekoResponse>(
    `${JUSTANIME_API}/watch/${input.anilistId}/episode/${input.episodeNumber}/anineko/${lang}/hd1`,
  );

  if (!payload) {
    return null;
  }

  const best = pickBestSource(payload.sources);
  if (!best?.url) {
    return null;
  }

  const referer = payload.headers?.Referer ?? "https://vivibebe.site/";

  return {
    ok: true,
    providerId: "justanime",
    streamUrl: best.url,
    streamKind: "hls",
    referer,
    subtitles: mapAninekoSubtitles(payload.subtitles),
    qualities: mapQualities(payload.sources, best.url, referer),
    preferredAudioLang: preferredAudioLangForTranslation(input.translationType),
  };
};

const scrapeMegaplay = async (
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult | null> => {
  const payload = await fetchJson<JustAnimeMegaplayResponse>(
    `${JUSTANIME_API}/watch/${input.anilistId}/episode/${input.episodeNumber}/megaplay`,
  );

  if (!payload) {
    return null;
  }

  const track =
    input.translationType === "dub"
      ? (payload.dub ?? payload.sub)
      : (payload.sub ?? payload.dub);

  const best = pickBestSource(track?.sources);
  if (!best?.url) {
    return null;
  }

  const referer = track?.headers?.Referer ?? "https://megaplay.buzz/";

  return {
    ok: true,
    providerId: "justanime",
    streamUrl: best.url,
    streamKind: "hls",
    referer,
    subtitles: mapMegaplaySubtitles(track?.subtitles),
    qualities: mapQualities(track?.sources, best.url, referer),
    preferredAudioLang: preferredAudioLangForTranslation(input.translationType),
  };
};

export async function scrapeJustanime(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "justanime" as const;

  try {
    const anineko = await scrapeAnineko(input);
    if (anineko?.ok) {
      return anineko;
    }

    const megaplay = await scrapeMegaplay(input);
    if (megaplay?.ok) {
      return megaplay;
    }

    return {
      ok: false,
      providerId,
      error: "JustAnime returned no playable sources",
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "JustAnime scrape failed",
    };
  }
}
