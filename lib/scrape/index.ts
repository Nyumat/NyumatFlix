import { attachSubtitlesToQualities } from "./linked-config";
import { scrapeVideasy } from "./providers/videasy";
import { scrapeVidKing } from "./providers/vidking";
import { scrapeVidNest } from "./providers/vidnest";
import { scrapeVidSrc } from "./providers/vidsrc";
import { scrapeVixsrc } from "./providers/vixsrc";
import { scrapeVidrock } from "./providers/vidrock";
import { scrapeBingr } from "./providers/bingr";
import { scrapeDirect } from "./providers/direct";
import { scrapeXPass } from "./providers/xpass";
import { probeScrapePlaybackPath } from "./playback-probe";
import { fetchScrapeFallbackSubtitles } from "./subtitles";
import type { ScrapeMediaInput, ScrapeProviderId, ScrapeResult } from "./types";
import { SCRAPE_PROVIDER_ORDER } from "./types";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";
import {
  isFreshVidnestSignedUrl,
  isVidnestClientOnlyCdn,
} from "./vidnest-shared";

const SCRAPERS: Record<
  ScrapeProviderId,
  (input: ScrapeMediaInput) => Promise<ScrapeResult>
> = {
  direct: scrapeDirect,
  videasy: scrapeVideasy,
  vidking: scrapeVidKing,
  vidnest: scrapeVidNest,
  vidsrc: scrapeVidSrc,
  "2embed": scrapeXPass,
  vixsrc: scrapeVixsrc,
  vidrock: scrapeVidrock,
  bingr: scrapeBingr,
};

const inferTmdbStreamKind = (streamUrl: string): StreamKind => {
  if (looksLikeStreamUrl(streamUrl, "dash")) {
    return "dash";
  }
  if (looksLikeStreamUrl(streamUrl, "mp4")) {
    return "mp4";
  }
  return "hls";
};

const isWingsdatabaseScrapeProvider = (
  providerId: ScrapeProviderId,
): providerId is "vidking" | "videasy" =>
  providerId === "vidking" || providerId === "videasy";

const isDirectScrapeProvider = (
  providerId: ScrapeProviderId,
): providerId is "direct" => providerId === "direct";

export async function scrapeProvider(
  providerId: ScrapeProviderId,
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const scraper = SCRAPERS[providerId];
  const result = await scraper(input);

  if (!result.ok) {
    return result;
  }

  let next = result;
  const streamKind = inferTmdbStreamKind(result.streamUrl);

  if (
    !isWingsdatabaseScrapeProvider(providerId) &&
    !isDirectScrapeProvider(providerId)
  ) {
    if (isVidnestClientOnlyCdn(next.streamUrl)) {
      if (!isFreshVidnestSignedUrl(next.streamUrl)) {
        return {
          ok: false,
          providerId,
          error: "VidNest signed stream URL is missing or expired",
        };
      }
    } else if (!result.validated) {
      const playProbeOk = await probeScrapePlaybackPath(
        {
          url: next.streamUrl,
          referer: next.referer,
          refresh: next.playbackRefresh,
        },
        streamKind,
      );
      if (!playProbeOk) {
        return {
          ok: false,
          providerId,
          error: "Stream failed playback-path probe",
        };
      }
    }
  }

  if (!next.subtitles?.length) {
    const fallbackSubtitles = await fetchScrapeFallbackSubtitles(input);
    if (fallbackSubtitles.length > 0) {
      next = { ...next, subtitles: fallbackSubtitles };
    }
  }

  const qualities = attachSubtitlesToQualities(next.qualities, next.subtitles);
  if (qualities !== next.qualities) {
    next = { ...next, qualities };
  }

  return next;
}

export async function scrapeAllProviders(
  input: ScrapeMediaInput,
  providerIds: readonly ScrapeProviderId[] = SCRAPE_PROVIDER_ORDER,
): Promise<ScrapeResult> {
  for (const providerId of providerIds) {
    const result = await scrapeProvider(providerId, input);
    if (result.ok) {
      return result;
    }
  }

  return {
    ok: false,
    providerId: providerIds[providerIds.length - 1] ?? "vidking",
    error: "All providers exhausted",
  };
}

export { SCRAPE_PROVIDER_ORDER } from "./types";
