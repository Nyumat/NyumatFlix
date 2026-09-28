import { attachSubtitlesToQualities } from "./linked-config";
import { scrapeVideasy } from "./providers/videasy";
import { scrapeVidKing } from "./providers/vidking";
import { scrapeVidSrc } from "./providers/vidsrc";
import { scrapeVidrock } from "./providers/vidrock";
import { scrapeBingr } from "./providers/bingr";
import { scrapeVidlink } from "./providers/vidlink";
import { scrapeVidNest } from "./providers/vidnest";
import { scrapeKisskh } from "./providers/kisskh";
import { scrapeDirect } from "./providers/direct";
import { scrapeXPass } from "./providers/xpass";
import { probeScrapePlaybackPath } from "./playback-probe";
import { scrapeNow } from "./stage-timing";
import type { ScrapeMediaInput, ScrapeProviderId, ScrapeResult } from "./types";
import { SCRAPE_PROVIDER_ORDER } from "./types";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";
import {
  isFreshVidnestSignedUrl,
  isVidnestClientOnlyCdn,
} from "./vidnest-shared";

type TmdbScraper = (input: ScrapeMediaInput) => Promise<ScrapeResult>;

const SCRAPERS: Record<Exclude<ScrapeProviderId, "hexa">, TmdbScraper> = {
  direct: scrapeDirect,
  videasy: scrapeVideasy,
  vidking: scrapeVidKing,
  vidsrc: scrapeVidSrc,
  "2embed": scrapeXPass,
  vidrock: scrapeVidrock,
  bingr: scrapeBingr,
  vidlink: scrapeVidlink,
  vidnest: scrapeVidNest,
  kisskh: scrapeKisskh,
};

const resolveScraper = async (
  providerId: ScrapeProviderId,
): Promise<TmdbScraper> => {
  if (providerId === "hexa") {
    const { scrapeHexa } = await import("./providers/hexa");
    return scrapeHexa;
  }
  return SCRAPERS[providerId];
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

/**
 * resolves a validated playable source only. fallback subtitles and hls track
 * counts are left to the client (`/api/scrape/subtitles`, active engine tracks)
 * so they never delay startup.
 */
export async function scrapeProvider(
  providerId: ScrapeProviderId,
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const scraper = await resolveScraper(providerId);
  const providerStartedAt = scrapeNow();
  const result = await scraper(input);
  input.timing?.since("provider", providerStartedAt);

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
      const validationStartedAt = scrapeNow();
      const playProbeOk = await probeScrapePlaybackPath(
        {
          url: next.streamUrl,
          referer: next.referer,
          refresh: next.playbackRefresh,
        },
        streamKind,
        { signal: input.signal },
      );
      input.timing?.since("validation", validationStartedAt);
      if (!playProbeOk) {
        return {
          ok: false,
          providerId,
          error: "Stream failed playback-path probe",
        };
      }
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
