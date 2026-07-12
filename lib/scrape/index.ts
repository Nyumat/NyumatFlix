import { attachSubtitlesToQualities } from "./linked-config";
import { scrapeVidKing } from "./providers/vidking";
import { scrapeVidNest } from "./providers/vidnest";
import { scrapeVidSrc } from "./providers/vidsrc";
import { scrapeVixsrc } from "./providers/vixsrc";
import { scrapeVidrock } from "./providers/vidrock";
import { scrapeBingr } from "./providers/bingr";
import { scrapeXPass } from "./providers/xpass";
import {
  isMegaplayPlaybackRefresh,
  isVidsrcPlaybackRefresh,
  isVixsrcPlaybackRefresh,
} from "./playback-refresh";
import { probeScrapePlaybackPath } from "./playback-probe";
import { resolveScrapePlaybackUpstreamUrl } from "./vidking-playback";
import { fetchSub1x2Subtitles } from "./subtitles";
import type { ScrapeMediaInput, ScrapeProviderId, ScrapeResult } from "./types";
import { SCRAPE_PROVIDER_ORDER } from "./types";
import { looksLikeStreamUrl, type StreamKind } from "./stream-url-patterns";
import { validateStreamUrlWithReferers } from "./validate-stream";
import {
  isFreshVidnestSignedUrl,
  isVidnestClientOnlyCdn,
} from "./vidnest-shared";

const SCRAPERS: Record<
  ScrapeProviderId,
  (input: ScrapeMediaInput) => Promise<ScrapeResult>
> = {
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
  const hasVidsrcRefresh = isVidsrcPlaybackRefresh(result.playbackRefresh);
  const hasVixsrcRefresh = isVixsrcPlaybackRefresh(result.playbackRefresh);

  if (!result.validated) {
    const streamUrlForValidation =
      hasVidsrcRefresh || hasVixsrcRefresh
        ? await resolveScrapePlaybackUpstreamUrl(
            result.streamUrl,
            result.playbackRefresh,
          )
        : result.streamUrl;
    const providerReferer = result.referer ?? "";
    const validation = await validateStreamUrlWithReferers(
      streamUrlForValidation,
      providerReferer,
      streamKind,
      { depth: "full" },
    );
    if (!validation.ok) {
      return {
        ok: false,
        providerId,
        error: "Stream URL failed validation",
      };
    }
    // Prefer the provider referer for playback. VidSrc's CDN origin can pass
    // probes while segments still need the embed/player referer at play time.
    if (providerReferer) {
      next = { ...next, referer: providerReferer };
    } else if (validation.referer) {
      next = { ...next, referer: validation.referer };
    }
  }

  if (providerId !== "vidking") {
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
    const fallbackSubtitles = await fetchSub1x2Subtitles(input);
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
