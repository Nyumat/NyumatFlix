import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";

const KYREN_ORIGIN = "https://kyren.moe";

type KyrenInfo = {
  title?: string;
  titleEnglish?: string;
  titleRomaji?: string;
};

type KyrenSource = {
  provider?: string;
  url?: string;
  language?: string;
  type?: string;
  quality?: string;
  isDub?: boolean;
};

type KyrenStreamResponse = {
  ok?: boolean;
  sources?: KyrenSource[];
  subtitles?: Array<{ url?: string; lang?: string; label?: string }>;
  error?: string;
};

const qualityRank = (label: string | undefined): number => {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("1080")) return 1080;
  if (normalized.includes("720")) return 720;
  if (normalized.includes("480")) return 480;
  if (normalized.includes("360")) return 360;
  return 0;
};

const resolveTitle = async (anilistId: number): Promise<string> => {
  const response = await scrapeFetch(
    `${KYREN_ORIGIN}/api/anime/info/${anilistId}`,
    {
      headers: {
        Accept: "application/json",
        Origin: KYREN_ORIGIN,
        Referer: `${KYREN_ORIGIN}/`,
      },
    },
  );

  if (!response.ok) {
    await cancelResponseBody(response);
    return "anime";
  }

  const info = (await response.json()) as KyrenInfo;
  return info.titleEnglish || info.title || info.titleRomaji || "anime";
};

const mapSubtitles = (
  subtitles: KyrenStreamResponse["subtitles"],
): ScrapeSubtitle[] | undefined => {
  const mapped = (subtitles ?? [])
    .filter((track) => Boolean(track.url))
    .map((track) => ({
      lang: track.label ?? track.lang ?? "Unknown",
      url: track.url!,
      format: "vtt" as const,
    }));

  return mapped.length > 0 ? mapped : undefined;
};

export async function scrapeKyren(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "kyren" as const;
  const lang = input.translationType === "dub" ? "dub" : "sub";

  try {
    const title = await resolveTitle(input.anilistId);
    const params = new URLSearchParams({ lang, title });
    const response = await scrapeFetch(
      `${KYREN_ORIGIN}/api/stream/${input.anilistId}/${input.episodeNumber}?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          Origin: KYREN_ORIGIN,
          Referer: `${KYREN_ORIGIN}/`,
        },
      },
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return {
        ok: false,
        providerId,
        error: `Kyren stream failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as KyrenStreamResponse;
    const sources = (payload.sources ?? []).filter((source) =>
      Boolean(source.url),
    );
    if (sources.length === 0) {
      return {
        ok: false,
        providerId,
        error: payload.error ?? "Kyren returned no sources",
      };
    }

    const ranked = [...sources].sort(
      (a, b) => qualityRank(b.quality) - qualityRank(a.quality),
    );
    const best = ranked[0]!;
    const referer = `${KYREN_ORIGIN}/`;

    const qualities: ScrapeQuality[] | undefined = ranked
      .slice(1)
      .map((source) => ({
        label: source.quality ?? source.provider ?? "auto",
        url: source.url!,
        referer,
      }));

    return {
      ok: true,
      providerId,
      streamUrl: best.url!,
      streamKind: "hls",
      referer,
      subtitles: mapSubtitles(payload.subtitles),
      qualities: qualities.length > 0 ? qualities : undefined,
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "Kyren scrape failed",
    };
  }
}
