import { preferredAudioLangForTranslation } from "../audio-preference";
import { extractHtmlSubtitleTracks, extractM3u8Urls } from "../html-utils";
import {
  extractAnizoneVidstackPlayer,
  searchAnizoneSlugFromQueries,
} from "../anizone-livewire";
import { resolveAnimeSearchContext } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeSubtitle } from "../../types";
import { scrapeFetchText } from "../../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../../playback-probe";
import { firstOkInBatches } from "../../race-first";

const ANIZONE_ORIGIN = "https://anizone.to";
const ANIZONE_PLAYABLE_CANDIDATE_BATCH = 3;

const subtitleFormatFromUrl = (
  url: string,
  declared?: string,
): NonNullable<ScrapeSubtitle["format"]> => {
  if (declared === "ass" || /\.ass(?:[?#]|$)/i.test(url)) {
    return "ass";
  }
  if (declared === "srt" || /\.srt(?:[?#]|$)/i.test(url)) {
    return "srt";
  }
  return "vtt";
};

const scoreAnizoneStreamUrl = (url: string): number => {
  let score = 0;
  if (/\/master\.m3u8(?:[?#]|$)/i.test(url)) {
    score += 100;
  } else if (/\.m3u8(?:[?#]|$)/i.test(url)) {
    score += 80;
  } else if (/\.mp4(?:[?#]|$)/i.test(url)) {
    score += 40;
  }
  return score;
};

export const rankAnizoneStreamCandidates = (
  playerSrc: string | undefined,
  streamUrls: readonly string[],
): string[] => {
  const seen = new Set<string>();
  const ranked: string[] = [];

  const push = (url: string | undefined | null) => {
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    ranked.push(url);
  };

  push(playerSrc);
  for (const url of streamUrls) {
    if (url.includes("master.m3u8")) {
      push(url);
    }
  }
  for (const url of [...streamUrls].sort(
    (left, right) => scoreAnizoneStreamUrl(right) - scoreAnizoneStreamUrl(left),
  )) {
    push(url);
  }

  return ranked;
};

export async function scrapeAnizone(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anizone" as const;

  try {
    const { searchQueries, matchTitles } =
      await resolveAnimeSearchContext(input);
    const slug = await searchAnizoneSlugFromQueries(searchQueries, matchTitles);

    if (!slug) {
      return { ok: false, providerId, error: "AniZone slug not found" };
    }

    const episode = await scrapeFetchText(
      `${ANIZONE_ORIGIN}/anime/${slug}/${input.episodeNumber}`,
      { Referer: `${ANIZONE_ORIGIN}/` },
      {
        timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
        retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
      },
    );

    if (episode.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `AniZone episode page failed (${episode.status}: ${slug}/${input.episodeNumber})`,
      };
    }

    const player = extractAnizoneVidstackPlayer(episode.text);
    const streamUrls = extractM3u8Urls(episode.text);
    const candidates = rankAnizoneStreamCandidates(player?.src, streamUrls);

    if (candidates.length === 0) {
      return {
        ok: false,
        providerId,
        error: "No m3u8 in AniZone episode HTML",
      };
    }

    const playerSubtitles: ScrapeSubtitle[] = [];
    for (const track of player?.subtitles ?? []) {
      if (!track.file?.startsWith("http")) {
        continue;
      }
      playerSubtitles.push({
        lang: track.language?.trim() || track.title?.trim() || "Unknown",
        url: track.file,
        format: subtitleFormatFromUrl(track.file, track.format),
      });
    }
    const htmlSubtitles = extractHtmlSubtitleTracks(episode.text);
    const subtitles =
      playerSubtitles.length > 0 ? playerSubtitles : htmlSubtitles;

    const winner = await firstOkInBatches(
      candidates,
      async (streamUrl) => {
        const streamKind = /\.m3u8(?:[?#]|$)/i.test(streamUrl) ? "hls" : "mp4";
        const ok = await probeScrapePlaybackPath(
          {
            url: streamUrl,
            referer: ANIZONE_ORIGIN,
          },
          streamKind,
        );
        return ok ? streamUrl : null;
      },
      ANIZONE_PLAYABLE_CANDIDATE_BATCH,
    );

    if (!winner) {
      return {
        ok: false,
        providerId,
        error: "AniZone streams failed playback-path probe",
      };
    }

    const master = winner.item;

    return {
      ok: true,
      providerId,
      validated: true,
      streamUrl: master,
      streamKind: /\.m3u8(?:[?#]|$)/i.test(master) ? "hls" : "mp4",
      referer: ANIZONE_ORIGIN,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
      preferredAudioLang: preferredAudioLangForTranslation(
        input.translationType,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AniZone scrape failed",
    };
  }
}
