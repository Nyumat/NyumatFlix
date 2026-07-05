import { scrapeVidKing } from "./providers/vidking";
import { scrapeVidNest } from "./providers/vidnest";
import { scrapeVidsrcMirror } from "./providers/vidsrc-mirror";
import { scrapeVidSrc } from "./providers/vidsrc";
import { scrapeXPass } from "./providers/xpass";
import { fetchSub1x2Subtitles } from "./subtitles";
import type { ScrapeMediaInput, ScrapeProviderId, ScrapeResult } from "./types";
import { SCRAPE_PROVIDER_ORDER } from "./types";
import { validateStreamUrl } from "./validate-stream";

const SCRAPERS: Record<
  ScrapeProviderId,
  (input: ScrapeMediaInput) => Promise<ScrapeResult>
> = {
  vidking: scrapeVidKing,
  vidnest: scrapeVidNest,
  vidsrc: scrapeVidSrc,
  "2embed": scrapeXPass,
  "vidsrc-mirror": scrapeVidsrcMirror,
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

  const isValid = await validateStreamUrl(result.streamUrl, result.referer);
  if (!isValid) {
    return {
      ok: false,
      providerId,
      error: "Stream URL failed validation",
    };
  }

  if (!result.subtitles?.length) {
    const fallbackSubtitles = await fetchSub1x2Subtitles(input);
    if (fallbackSubtitles.length > 0) {
      return { ...result, subtitles: fallbackSubtitles };
    }
  }

  return result;
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
