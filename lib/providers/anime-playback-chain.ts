import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
  type AnimePlaybackScrapeProviderId,
  type AnimeScrapeProviderId,
} from "@/lib/providers/registry";
import type { MappingConfidence } from "@/lib/anime/tmdb-anilist-map";
import {
  ADULT_ONLY_ANIME_PROVIDER_IDS,
  shouldIncludeHentaigasmForGenres,
} from "@/lib/scrape/anime/hentaigasm-eligible";

export type AnimePlaybackChainContext = {
  mappingConfidence: MappingConfidence | null;
  isAdultAnime: boolean;
  anilistGenres?: readonly string[];
  translationType?: "sub" | "dub";
};

export type ScrapeProviderGroup = "anime" | "tmdb";

export type GroupedScrapeProviderOption = {
  providerId: AnimePlaybackScrapeProviderId;
  name: string;
  group: ScrapeProviderGroup;
};

export const shouldIncludeTmdbPlaybackProxies = (
  context: AnimePlaybackChainContext,
): boolean => {
  if (context.isAdultAnime) {
    return false;
  }

  return context.mappingConfidence === "high";
};

const filterAnimeScrapeProviders = (
  context: AnimePlaybackChainContext,
): readonly AnimeScrapeProviderId[] => {
  const includeAdultOnlyProviders = shouldIncludeHentaigasmForGenres(
    context.isAdultAnime,
    context.anilistGenres ?? [],
  );

  return ANIME_SCRAPE_PROVIDER_ORDER.filter((providerId) => {
    if (
      ADULT_ONLY_ANIME_PROVIDER_IDS.includes(
        providerId as "anipm" | "hentaigasm",
      )
    ) {
      return includeAdultOnlyProviders;
    }

    if (context.translationType === "dub" && providerId === "animeonsen") {
      return false;
    }

    return true;
  });
};

export const buildAnimePlaybackProviderOrder = (
  context: AnimePlaybackChainContext,
): readonly AnimePlaybackScrapeProviderId[] => {
  const animeProviders = filterAnimeScrapeProviders(context);

  if (!shouldIncludeTmdbPlaybackProxies(context)) {
    return animeProviders;
  }

  return [...animeProviders, ...TMDB_SCRAPE_PROVIDER_ORDER];
};

export const buildGroupedAnimePlaybackProviderOptions = (
  context: AnimePlaybackChainContext,
): GroupedScrapeProviderOption[] => {
  const animeOptions: GroupedScrapeProviderOption[] =
    filterAnimeScrapeProviders(context).map((providerId) => ({
      providerId,
      name: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS[providerId],
      group: "anime",
    }));

  if (!shouldIncludeTmdbPlaybackProxies(context)) {
    return animeOptions;
  }

  const tmdbOptions: GroupedScrapeProviderOption[] =
    TMDB_SCRAPE_PROVIDER_ORDER.map((providerId) => ({
      providerId,
      name: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS[providerId],
      group: "tmdb",
    }));

  return [...animeOptions, ...tmdbOptions];
};
