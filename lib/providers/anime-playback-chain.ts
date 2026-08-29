import {
  ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_ORDER,
  isTmdbScrapeProvider,
  type AnimePlaybackScrapeProviderId,
  type AnimeScrapeProviderId,
  type TmdbScrapeProviderId,
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

export type AnimePlaybackProviderOrders = {
  animeOrder?: readonly AnimeScrapeProviderId[];
  tmdbOrder?: readonly TmdbScrapeProviderId[];
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
): boolean => {
  if (context.isAdultAnime) {
    return false;
  }

  return context.mappingConfidence === "high";
};

/** First race batch is these anime scrapers + Direct (concurrency 3). */
export const ANIME_DIRECT_RACE_LEAD = 2;

export const MANUAL_DIRECT_MENU_OPTION: GroupedScrapeProviderOption = {
  providerId: "direct",
  name: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS.direct,
  group: "tmdb",
};

export const withManualDirectMenuOption = (
  options: readonly GroupedScrapeProviderOption[],
  directAvailable: boolean,
): GroupedScrapeProviderOption[] => {
  if (
    !directAvailable ||
    options.some((option) => option.providerId === "direct")
  ) {
    return [...options];
  }

  return [...options, MANUAL_DIRECT_MENU_OPTION];
};

const toGroupedOption = (
  providerId: AnimePlaybackScrapeProviderId,
): GroupedScrapeProviderOption => ({
  providerId,
  name: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS[providerId],
  group: isTmdbScrapeProvider(providerId) ? "tmdb" : "anime",
});

const interleaveDirectAfterLeadingAnime = (
  animeProviders: readonly AnimeScrapeProviderId[],
  tmdbProviders: readonly TmdbScrapeProviderId[],
  translationType?: AnimePlaybackChainContext["translationType"],
): AnimePlaybackScrapeProviderId[] => {
  if (!tmdbProviders.includes("direct")) {
    return [...animeProviders, ...tmdbProviders];
  }

  const tmdbWithoutDirect = tmdbProviders.filter(
    (providerId) => providerId !== "direct",
  );

  // Dub preference should try anime-native scrapers first — TMDB proxies are
  // often a single English track with no in-player language menu.
  if (translationType === "dub") {
    return [...animeProviders, "direct", ...tmdbWithoutDirect];
  }

  return [
    ...animeProviders.slice(0, ANIME_DIRECT_RACE_LEAD),
    "direct",
    ...animeProviders.slice(ANIME_DIRECT_RACE_LEAD),
    ...tmdbWithoutDirect,
  ];
};

const filterAnimeScrapeProviders = (
  context: AnimePlaybackChainContext,
  baseOrder: readonly AnimeScrapeProviderId[] = ANIME_SCRAPE_PROVIDER_ORDER,
): readonly AnimeScrapeProviderId[] => {
  const includeAdultOnlyProviders = shouldIncludeHentaigasmForGenres(
    context.isAdultAnime,
    context.anilistGenres ?? [],
  );

  const filtered = baseOrder.filter((providerId) => {
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
  const adultPriority = ["hentaigasm", "hentaini", "anipm"] as const;
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
  orders?: AnimePlaybackProviderOrders,
): readonly AnimePlaybackScrapeProviderId[] => {
  const animeProviders = filterAnimeScrapeProviders(
    context,
    orders?.animeOrder ?? ANIME_SCRAPE_PROVIDER_ORDER,
  );

  if (!shouldIncludeTmdbPlaybackProxies(context)) {
    return animeProviders;
  }

  return interleaveDirectAfterLeadingAnime(
    animeProviders,
    orders?.tmdbOrder ?? TMDB_SCRAPE_PROVIDER_ORDER,
    context.translationType,
  );
};

export const buildGroupedAnimePlaybackProviderOptions = (
  context: AnimePlaybackChainContext,
  orders?: AnimePlaybackProviderOrders,
): GroupedScrapeProviderOption[] =>
  buildAnimePlaybackProviderOrder(context, orders).map(toGroupedOption);
