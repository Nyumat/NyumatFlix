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

/** Mainstream catalogs that do not carry adult OVAs — skip on adult chains. */
export const MAINSTREAM_ONLY_ANIME_PROVIDER_IDS = [
  "animegg",
  "animepahe",
] as const satisfies readonly AnimeScrapeProviderId[];

const ADULT_ONLY_PROVIDER_IDS = new Set<string>(ADULT_ONLY_ANIME_PROVIDER_IDS);
const MAINSTREAM_ONLY_PROVIDER_IDS = new Set<string>(
  MAINSTREAM_ONLY_ANIME_PROVIDER_IDS,
);

export const shouldIncludeTmdbPlaybackProxies = (
  context: AnimePlaybackChainContext,
): boolean => context.mappingConfidence === "high";

const filterAnimeScrapeProviders = (
  context: AnimePlaybackChainContext,
): readonly AnimeScrapeProviderId[] => {
  const includeAdultOnlyProviders = shouldIncludeHentaigasmForGenres(
    context.isAdultAnime,
    context.anilistGenres ?? [],
  );

  const filtered = ANIME_SCRAPE_PROVIDER_ORDER.filter((providerId) => {
    if (ADULT_ONLY_PROVIDER_IDS.has(providerId)) {
      return includeAdultOnlyProviders;
    }

    if (
      includeAdultOnlyProviders &&
      MAINSTREAM_ONLY_PROVIDER_IDS.has(providerId)
    ) {
      return false;
    }

    if (context.translationType === "dub" && providerId === "animeonsen") {
      return false;
    }

    return true;
  });

  if (!includeAdultOnlyProviders) {
    return filtered;
  }

  // Prefer Hentaigasm before ani.pm — measured winner for adult OVAs.
  const adultPriority = ["hentaigasm", "anipm"] as const;
  const adultFirst = adultPriority.filter((providerId) =>
    filtered.includes(providerId),
  );
  const rest = filtered.filter(
    (providerId) => !ADULT_ONLY_PROVIDER_IDS.has(providerId),
  );

  return [...adultFirst, ...rest];
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
