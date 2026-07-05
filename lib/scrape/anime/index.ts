import { scrapeAnimestream } from "./providers/animestream";
import { scrapeAnimegg } from "./providers/animegg";
import { scrapeAnimeonsen } from "./providers/animeonsen";
import { scrapeAnimepahe } from "./providers/animepahe";
import { scrapeAllmanga } from "./providers/allmanga";
import { scrapeAnizone } from "./providers/anizone";
import { scrapeKickassanime } from "./providers/kickassanime";
import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
  type AnimeScrapeResult,
} from "./types";
import { validateStreamUrl } from "../validate-stream";

const ANIME_SCRAPERS: Record<
  AnimeScrapeProviderId,
  (input: AnimeScrapeInput) => Promise<AnimeScrapeResult>
> = {
  anizone: scrapeAnizone,
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

  const isValid = await validateStreamUrl(
    result.streamUrl,
    result.referer,
    result.streamKind,
  );

  if (!isValid) {
    return {
      ok: false,
      providerId,
      error: "Stream URL failed validation",
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
