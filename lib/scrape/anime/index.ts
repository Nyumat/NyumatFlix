import { scrapeAnimestream } from "./providers/animestream";
import { scrapeAnimegg } from "./providers/animegg";
import { scrapeAnimeonsen } from "./providers/animeonsen";
import { scrapeAnimepahe } from "./providers/animepahe";
import { scrapeAllmanga } from "./providers/allmanga";
import { scrapeAnizone } from "./providers/anizone";
import { scrapeAnipm } from "./providers/anipm";
import { scrapeHentaigasm } from "./providers/hentaigasm";
import { scrapeKickassanime } from "./providers/kickassanime";
import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
  type AnimeScrapeResult,
} from "./types";
import { fetchAnilistMediaMeta } from "./anilist-meta";
import { validateStreamUrl } from "../validate-stream";

const ANIME_SCRAPERS: Record<
  AnimeScrapeProviderId,
  (input: AnimeScrapeInput) => Promise<AnimeScrapeResult>
> = {
  anizone: scrapeAnizone,
  anipm: scrapeAnipm,
  hentaigasm: scrapeHentaigasm,
  kickassanime: scrapeKickassanime,
  animeonsen: scrapeAnimeonsen,
  allmanga: scrapeAllmanga,
  animestream: scrapeAnimestream,
  animegg: scrapeAnimegg,
  animepahe: scrapeAnimepahe,
};

export async function scrapeAnimeProvider(
  providerId: AnimeScrapeProviderId,
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const scraper = ANIME_SCRAPERS[providerId];
  const result = await scraper(input);

  if (!result.ok) {
    return result;
  }

  const mediaMeta = await fetchAnilistMediaMeta(input.anilistId);
  const isValid = await validateStreamUrl(
    result.streamUrl,
    result.referer,
    result.streamKind,
    mediaMeta?.durationMinutes,
  );

  if (!isValid) {
    return {
      ok: false,
      providerId,
      error: mediaMeta?.durationMinutes
        ? "Stream URL failed validation (duration mismatch)"
        : "Stream URL failed validation",
    };
  }

  return result;
}

export async function scrapeAllAnimeProviders(
  input: AnimeScrapeInput,
  providerIds: readonly AnimeScrapeProviderId[] = ANIME_SCRAPE_PROVIDER_ORDER,
): Promise<AnimeScrapeResult> {
  for (const providerId of providerIds) {
    const result = await scrapeAnimeProvider(providerId, input);
    if (result.ok) {
      return result;
    }
  }

  return {
    ok: false,
    providerId: providerIds[providerIds.length - 1] ?? "anizone",
    error: "All anime providers exhausted",
  };
}

export async function scrapeAnimeProviderWithFallback(
  providerId: AnimeScrapeProviderId,
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const requested = await scrapeAnimeProvider(providerId, input);
  if (requested.ok) {
    return requested;
  }

  const fallback = await scrapeAllAnimeProviders(
    input,
    ANIME_SCRAPE_PROVIDER_ORDER.filter((candidate) => candidate !== providerId),
  );

  return fallback.ok
    ? {
        ...fallback,
        fallbackFrom: { providerId, error: requested.error },
      }
    : fallback;
}

export {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_OPTIONS,
  ANIME_SCRAPE_PROVIDER_ORDER,
} from "./types";
export type {
  AnimeScrapeInput,
  AnimeScrapeProviderId,
  AnimeScrapeResult,
} from "./types";
