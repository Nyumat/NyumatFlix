import { scrapeAnimegg } from "./providers/animegg";
import { scrapeAnimeonsen } from "./providers/animeonsen";
import { scrapeAllmanga } from "./providers/allmanga";
import { scrapeAnikuro } from "./providers/anikuro";
import { scrapeAnimepahe } from "./providers/animepahe";
import { scrapeAnizone } from "./providers/anizone";
import { scrapeAnipm } from "./providers/anipm";
import { scrapeHentaigasm } from "./providers/hentaigasm";
import { scrapeHentaini } from "./providers/hentaini";
import { scrapeKickassanime } from "./providers/kickassanime";
import { scrapeJustanime } from "./providers/justanime";
import { scrapeKyren } from "./providers/kyren";
import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
  type AnimeScrapeResult,
} from "./types";
import type { ScrapeSubtitle } from "../types";
import { attachSubtitlesToQualities, dedupeSubtitles } from "../linked-config";
import { stampDonorSubtitles } from "../subtitle-harvest";
import { attachHlsTrackCapabilities } from "../hls-track-capabilities";
import { isScrapeAborted } from "../abort";
import { probeScrapePlaybackPath } from "../playback-probe";
import { fetchScrapeFallbackSubtitles } from "../subtitles";
import { resolveAnimeSubtitleTmdbLookup } from "./resolve-subtitle-tmdb-lookup";
import type { ScrapeMediaInput } from "../types";

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
  animegg: scrapeAnimegg,
  justanime: scrapeJustanime,
  kyren: scrapeKyren,
  anikuro: scrapeAnikuro,
  animepahe: scrapeAnimepahe,
  hentaini: scrapeHentaini,
};

const mergeAnimeCatalogSubtitles = async (
  input: AnimeScrapeInput,
  subtitles: ScrapeSubtitle[] | undefined,
): Promise<ScrapeSubtitle[] | undefined> => {
  const tmdbLookup: ScrapeMediaInput | null = input.tmdb?.tmdbId
    ? {
        mediaType: input.tmdb.mediaType,
        tmdbId: input.tmdb.tmdbId,
        seasonNumber: input.tmdb.seasonNumber,
        episodeNumber: input.tmdb.episodeNumber,
      }
    : await resolveAnimeSubtitleTmdbLookup(input);

  if (!tmdbLookup?.tmdbId) {
    return subtitles;
  }

  try {
    const catalogSubtitles = await fetchScrapeFallbackSubtitles(tmdbLookup);
    if (catalogSubtitles.length === 0) {
      return subtitles;
    }

    const existing = subtitles ?? [];
    const seenLangs = new Set(
      existing.map((track) => track.lang.trim().toLowerCase()),
    );
    const extras = catalogSubtitles.filter(
      (track) => !seenLangs.has(track.lang.trim().toLowerCase()),
    );

    return dedupeSubtitles([...existing, ...extras]);
  } catch {
    return subtitles;
  }
};

export async function scrapeAnimeProvider(
  providerId: AnimeScrapeProviderId,
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  if (isScrapeAborted(input.signal)) {
    return {
      ok: false,
      providerId,
      error: "Request aborted",
    };
  }

  const scraper = ANIME_SCRAPERS[providerId];
  const result = await scraper(input);

  if (!result.ok) {
    return result;
  }

  if (isScrapeAborted(input.signal)) {
    return {
      ok: false,
      providerId,
      error: "Request aborted",
    };
  }

  let next = result;

  if (!result.validated) {
    const playProbeOk = await probeScrapePlaybackPath(
      {
        url: next.streamUrl,
        referer: next.referer,
        refresh: next.playbackRefresh,
        cookies: next.cookies,
      },
      next.streamKind,
      { signal: input.signal },
    );
    if (!playProbeOk) {
      return {
        ok: false,
        providerId,
        error: "Stream failed playback-path probe",
      };
    }
  }

  if (next.subtitles?.length) {
    next = {
      ...next,
      subtitles: stampDonorSubtitles(next.subtitles, {
        referer: next.referer,
        source: ANIME_SCRAPE_PROVIDER_LABELS[providerId],
      }),
    };
  }

  if (isScrapeAborted(input.signal)) {
    return {
      ok: false,
      providerId,
      error: "Request aborted",
    };
  }

  const mergedSubtitles = await mergeAnimeCatalogSubtitles(
    input,
    next.subtitles,
  );
  if (mergedSubtitles !== next.subtitles) {
    next = {
      ...next,
      subtitles: mergedSubtitles,
    };
  }

  const qualities = attachSubtitlesToQualities(next.qualities, next.subtitles);
  if (qualities !== next.qualities) {
    next = { ...next, qualities };
  }

  return attachHlsTrackCapabilities(next);
}

export async function scrapeAllAnimeProviders(
  input: AnimeScrapeInput,
  providerIds: readonly AnimeScrapeProviderId[] = ANIME_SCRAPE_PROVIDER_ORDER,
): Promise<AnimeScrapeResult> {
  for (const providerId of providerIds) {
    if (isScrapeAborted(input.signal)) {
      return {
        ok: false,
        providerId,
        error: "Request aborted",
      };
    }

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
