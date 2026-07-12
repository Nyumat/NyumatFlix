import { preferredAudioLangForTranslation } from "../audio-preference";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeQuality, ScrapeSubtitle } from "../../types";
import { cancelResponseBody, scrapeFetch } from "../../fetch";
import type { MegaplayPlaybackRefresh } from "../../megaplay-constants";
import {
  MEGAPLAY_ORIGIN,
  resolveMegaplayEmbedStream,
} from "../../megaplay-sources";

const KYREN_ORIGIN = "https://kyren.moe";

/** Kyren stream servers — raze (megaplay) replaces neon (vidnest-direct, upstream 403). */
const KYREN_SERVERS_SUB = ["viper", "kayo", "raze", "jett"] as const;
const KYREN_SERVERS_DUB = ["kayo", "raze", "viper", "jett"] as const;

type KyrenInfo = {
  idMal?: number;
  title?: string;
  titleEnglish?: string;
  titleRomaji?: string;
  seasonYear?: number;
  episodes?: number;
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

const kyrenPlayerReferer = (
  idMal: number | undefined,
  episodeNumber: number,
): string =>
  typeof idMal === "number" && idMal > 0
    ? `${KYREN_ORIGIN}/player/${idMal}?ep=${episodeNumber}`
    : `${KYREN_ORIGIN}/`;

const kyrenHeaders = (referer: string) => ({
  Accept: "application/json",
  Origin: KYREN_ORIGIN,
  Referer: referer,
});

const resolveKyrenPlayableSource = async (
  source: KyrenSource,
  kyrenReferer: string,
): Promise<{
  streamUrl: string;
  referer: string;
  playbackRefresh?: MegaplayPlaybackRefresh;
} | null> => {
  const url = source.url?.trim();
  if (!url) {
    return null;
  }

  if (/api\.kyren\.moe\/v1\/hls\//i.test(url)) {
    return { streamUrl: url, referer: kyrenReferer };
  }

  if (/megaplay\.buzz/i.test(url) || source.provider === "megaplay") {
    const resolved = await resolveMegaplayEmbedStream(url);
    if (!resolved) {
      return null;
    }

    const megaplayReferer = `${MEGAPLAY_ORIGIN}/`;
    return {
      streamUrl: resolved.streamUrl,
      referer: megaplayReferer,
      playbackRefresh: {
        providerId: "megaplay",
        referer: megaplayReferer,
        seedStreamUrl: resolved.streamUrl,
        megaplayId: resolved.megaplayId,
      },
    };
  }

  return null;
};

const resolveAnimeInfo = async (
  anilistId: number,
  referer: string,
): Promise<KyrenInfo | null> => {
  const response = await scrapeFetch(
    `${KYREN_ORIGIN}/api/anime/info/${anilistId}`,
    { headers: kyrenHeaders(referer) },
  );

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  return (await response.json()) as KyrenInfo;
};

const resolveStreamTitle = (info: KyrenInfo | null, query?: string): string =>
  query?.trim() ||
  info?.titleEnglish?.trim() ||
  info?.title?.trim() ||
  info?.titleRomaji?.trim() ||
  "anime";

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
  const servers = lang === "dub" ? KYREN_SERVERS_DUB : KYREN_SERVERS_SUB;

  try {
    const info = await resolveAnimeInfo(input.anilistId, `${KYREN_ORIGIN}/`);
    const title = resolveStreamTitle(info, input.query);
    const playerReferer = kyrenPlayerReferer(info?.idMal, input.episodeNumber);
    let lastError = "Kyren returned no sources";

    for (const server of servers) {
      const params = new URLSearchParams({ lang, title, server });
      if (typeof info?.seasonYear === "number" && info.seasonYear > 0) {
        params.set("year", String(info.seasonYear));
      }
      if (typeof info?.episodes === "number" && info.episodes > 0) {
        params.set("episodes", String(info.episodes));
      }

      const response = await scrapeFetch(
        `${KYREN_ORIGIN}/api/stream/${input.anilistId}/${input.episodeNumber}?${params.toString()}`,
        { headers: kyrenHeaders(playerReferer) },
      );

      if (!response.ok) {
        await cancelResponseBody(response);
        lastError = `Kyren stream failed (${response.status})`;
        continue;
      }

      const payload = (await response.json()) as KyrenStreamResponse;
      const sources = (payload.sources ?? []).filter((source) =>
        Boolean(source.url),
      );
      if (sources.length === 0) {
        lastError = payload.error ?? "Kyren returned no sources";
        continue;
      }

      const ranked = [...sources].sort(
        (a, b) => qualityRank(b.quality) - qualityRank(a.quality),
      );

      for (const source of ranked) {
        const playable = await resolveKyrenPlayableSource(
          source,
          playerReferer,
        );
        if (!playable) {
          continue;
        }

        const qualities: ScrapeQuality[] = (
          await Promise.all(
            ranked
              .filter((candidate) => candidate.url !== source.url)
              .map(async (candidate) => {
                const resolved = await resolveKyrenPlayableSource(
                  candidate,
                  playerReferer,
                );
                if (!resolved) {
                  return null;
                }

                return {
                  label: candidate.quality ?? candidate.provider ?? "auto",
                  url: resolved.streamUrl,
                  referer: resolved.referer,
                } satisfies ScrapeQuality;
              }),
          )
        ).filter((quality) => quality !== null);

        return {
          ok: true,
          providerId,
          streamUrl: playable.streamUrl,
          streamKind: "hls",
          referer: playable.referer,
          playbackRefresh: playable.playbackRefresh,
          subtitles: mapSubtitles(payload.subtitles),
          qualities: qualities.length > 0 ? qualities : undefined,
          preferredAudioLang: preferredAudioLangForTranslation(
            input.translationType,
          ),
        };
      }

      lastError = payload.error ?? "Kyren returned no playable sources";
    }

    return {
      ok: false,
      providerId,
      error: lastError,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "Kyren scrape failed",
    };
  }
}
