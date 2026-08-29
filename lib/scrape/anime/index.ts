import { scrapeAnimestream } from "./providers/animestream";
import { scrapeAnimegg } from "./providers/animegg";
import { scrapeAnimeonsen } from "./providers/animeonsen";
import { scrapeAnimepahe } from "./providers/animepahe";
import { scrapeAllmanga } from "./providers/allmanga";
import { scrapeAnizone } from "./providers/anizone";
import { scrapeAnipm } from "./providers/anipm";
import { scrapeHentaigasm } from "./providers/hentaigasm";
import { scrapeKickassanime } from "./providers/kickassanime";
import { scrapeJustanime } from "./providers/justanime";
import { scrapeAnikuro } from "./providers/anikuro";
import { scrapeKyren } from "./providers/kyren";
import {
  ANIME_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeInput,
  type AnimeScrapeProviderId,
  type AnimeScrapeResult,
} from "./types";
import { fetchAnilistMediaMeta } from "./anilist-meta";
import { attachSubtitlesToQualities, dedupeSubtitles } from "../linked-config";
import { isMegaplayPlaybackRefresh } from "../playback-refresh";
import { probeScrapePlaybackPath } from "../playback-probe";
import { fetchSub1x2Subtitles } from "../subtitles";
import { resolveScrapePlaybackUpstreamUrl } from "../vidking-playback";
import { validateStreamUrlWithReferers } from "../validate-stream";

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
  justanime: scrapeJustanime,
  anikuro: scrapeAnikuro,
  kyren: scrapeKyren,
};

const ANIME_MOVIE_FORMATS = new Set(["MOVIE", "ONE_SHOT", "SPECIAL", "OVA"]);

const expectedDurationMinutesForValidation = (
  format: string | null | undefined,
  durationMinutes: number | null | undefined,
): number | null | undefined => {
  if (!durationMinutes) {
    return durationMinutes;
  }
  if (format && ANIME_MOVIE_FORMATS.has(format)) {
    return null;
  }
  return durationMinutes;
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
  let next = result;

  if (!result.validated) {
    const streamUrlForValidation = isMegaplayPlaybackRefresh(
      result.playbackRefresh,
    )
      ? await resolveScrapePlaybackUpstreamUrl(
          result.streamUrl,
          result.playbackRefresh,
        )
      : result.streamUrl;
    const validation = await validateStreamUrlWithReferers(
      streamUrlForValidation,
      result.referer ?? "",
      result.streamKind,
      {
        depth: "full",
        expectedDurationMinutes: expectedDurationMinutesForValidation(
          mediaMeta?.format,
          mediaMeta?.durationMinutes,
        ),
      },
    );

    if (!validation.ok) {
      return {
        ok: false,
        providerId,
        error: "Stream URL failed validation",
      };
    }

    // Prefer the provider referer when present — CDN-origin can pass probes
    // while segments still need the embed referer at play time.
    if (!result.referer && validation.referer) {
      next = { ...next, referer: validation.referer };
    }

    const playProbeOk = await probeScrapePlaybackPath(
      {
        url: next.streamUrl,
        referer: next.referer,
        refresh: next.playbackRefresh,
        cookies: next.cookies,
      },
      next.streamKind,
    );
    if (!playProbeOk) {
      return {
        ok: false,
        providerId,
        error: "Stream failed playback-path probe",
      };
    }
  }

  // Softsub catalog for every mapped title — fill gaps when hosts ship bare
  // video or only a single embedded track.
  if (input.tmdb?.tmdbId) {
    try {
      const fallbackSubtitles = await fetchSub1x2Subtitles({
        mediaType: input.tmdb.mediaType,
        tmdbId: input.tmdb.tmdbId,
        seasonNumber: input.tmdb.seasonNumber,
        episodeNumber: input.tmdb.episodeNumber,
      });
      if (fallbackSubtitles.length > 0) {
        const existing = next.subtitles ?? [];
        const seenLangs = new Set(
          existing.map((track) => track.lang.trim().toLowerCase()),
        );
        const extras = fallbackSubtitles.filter(
          (track) => !seenLangs.has(track.lang.trim().toLowerCase()),
        );
        next = {
          ...next,
          subtitles: dedupeSubtitles([...existing, ...extras]),
        };
      }
    } catch {
      // Softsub miss must not fail an otherwise playable stream.
    }
  }

  const qualities = attachSubtitlesToQualities(next.qualities, next.subtitles);
  if (qualities !== next.qualities) {
    return { ...next, qualities };
  }

  return next;
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
