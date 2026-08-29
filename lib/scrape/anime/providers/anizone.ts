import { preferredAudioLangForTranslation } from "../audio-preference";
import { extractHtmlSubtitleTracks, extractM3u8Urls } from "../html-utils";
import {
  extractAnizoneVidstackPlayer,
  searchAnizoneSlugFromQueries,
} from "../anizone-livewire";
import { resolveAnimeSearchQueries } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import type { ScrapeSubtitle } from "../../types";
import { scrapeFetchText } from "../../fetch";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
} from "../../playback-probe";

const ANIZONE_ORIGIN = "https://anizone.to";

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

export async function scrapeAnizone(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "anizone" as const;

  try {
    const queries = await resolveAnimeSearchQueries(input);
    const slug = await searchAnizoneSlugFromQueries(queries);

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
    const master =
      player?.src ??
      streamUrls.find((url) => url.includes("master.m3u8")) ??
      streamUrls[0];

    if (!master) {
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

    return {
      ok: true,
      providerId,
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
