/**
 * Canonical provider catalog — single source for embed vs scrape capabilities,
 * display names, and provider ordering.
 */

export type TmdbScrapeProviderId =
  | "direct"
  | "videasy"
  | "vidking"
  | "vidsrc"
  | "2embed"
  | "vidrock"
  | "bingr";

export type AnimeScrapeProviderId =
  | "anizone"
  | "anipm"
  | "hentaigasm"
  | "kickassanime"
  | "animeonsen"
  | "allmanga"
  | "animegg"
  | "justanime"
  | "kyren"
  | "anikuro"
  | "animepahe"
  | "hentaini";

export type EmbedProviderId =
  | "vidsrc"
  | "vidsrc-mirror"
  | "superembed"
  | "2embed"
  | "111movies"
  | "vidnest"
  | "vidfast"
  | "videasy"
  | "vidking"
  | "vixsrc"
  | "vidlink"
  | "vidcore"
  | "1embed"
  | "vidlux"
  | "hentaini";

export type ProviderCapabilities = {
  embed: boolean;
  tmdbScrape: boolean;
  animeScrape: boolean;
  animeEmbed: boolean;
};

export type ProviderDefinition = {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
};

const provider = (
  id: string,
  name: string,
  capabilities: Partial<ProviderCapabilities> &
    Pick<ProviderCapabilities, "embed">,
): ProviderDefinition => ({
  id,
  name,
  capabilities: {
    embed: capabilities.embed,
    tmdbScrape: capabilities.tmdbScrape ?? false,
    animeScrape: capabilities.animeScrape ?? false,
    animeEmbed: capabilities.animeEmbed ?? false,
  },
});

export const EMBED_PROVIDER_REGISTRY: ProviderDefinition[] = [
  provider("vidsrc", "VidSrc", { embed: true, tmdbScrape: true }),
  provider("vidking", "VidKing", { embed: true, tmdbScrape: true }),
  provider("vidsrc-mirror", "VidSrc Mirror", { embed: true }),
  provider("superembed", "SuperEmbed", { embed: true }),
  provider("111movies", "111Movies", { embed: true }),
  provider("vidfast", "VidFast", { embed: true }),
  provider("videasy", "VidEasy", {
    embed: true,
    tmdbScrape: true,
    animeEmbed: true,
  }),
  provider("vidnest", "VidNest", {
    embed: true,
    tmdbScrape: true,
    animeEmbed: true,
  }),
  provider("2embed", "2Embed", { embed: true, tmdbScrape: true }),
  provider("vidrock", "VidRock", { embed: false, tmdbScrape: true }),
  provider("bingr", "Bingr", { embed: false, tmdbScrape: true }),
  provider("vidlink", "VidLink", { embed: true }),
  provider("vidcore", "VidCore", { embed: true }),
  provider("1embed", "1Embed", { embed: true }),
  provider("vidlux", "VidLux", { embed: true }),
  provider("vixsrc", "VixSrc", { embed: true }),
  provider("hentaini", "Hentaini", { embed: true, animeEmbed: true }),
];

/**
 * Direct leads so the overlay solos it first. Remaining order is from latency
 * bench + reliability audits. VidNest scrape removed. VixSrc is embed-only.
 */
export const TMDB_SCRAPE_PROVIDER_REGISTRY: ProviderDefinition[] = [
  provider("direct", "Direct", { embed: false, tmdbScrape: true }),
  provider("vidsrc", "VidSrc", { embed: true, tmdbScrape: true }),
  provider("vidking", "VidKing", { embed: true, tmdbScrape: true }),
  provider("videasy", "VidEasy", {
    embed: true,
    tmdbScrape: true,
    animeEmbed: true,
  }),
  provider("vidrock", "VidRock", { embed: false, tmdbScrape: true }),
  provider("bingr", "Bingr", { embed: false, tmdbScrape: true }),
  provider("2embed", "2Embed", { embed: true, tmdbScrape: true }),
];

/**
 * Race order is a fallback only. Anime playback waits for the batch and picks
 * the highest-scored success from what that title actually returned (multi-audio
 * HLS groups, in-player sub/dub menus, native subs). Adult-only providers stay
 * last — `buildAnimePlaybackProviderOrder` promotes them when eligible, then
 * races Direct with the first two anime scrapers on high-confidence TMDB mappings.
 *
 * Embed-only (not scraped): hentaini (iframe), animepahe (VidNest animepahe route).
 * Removed from scrape: anikuro (redundant allmanga wrapper), animestream
 * (Indonesian hardsub-only, no English/softsub/dub variants).
 */
export const ANIME_SCRAPE_PROVIDER_REGISTRY: ProviderDefinition[] = [
  provider("kickassanime", "KickAssAnime", { embed: false, animeScrape: true }),
  provider("anizone", "AniZone", { embed: false, animeScrape: true }),
  provider("allmanga", "AllManga", { embed: false, animeScrape: true }),
  provider("animeonsen", "AnimeOnsen", { embed: false, animeScrape: true }),
  provider("animegg", "AnimeGG", { embed: false, animeScrape: true }),
  provider("kyren", "Kyren", { embed: false, animeScrape: true }),
  provider("justanime", "JustAnime", { embed: false, animeScrape: true }),
  provider("anipm", "ani.pm", { embed: false, animeScrape: true }),
  provider("hentaigasm", "Hentaigasm", { embed: false, animeScrape: true }),
];

export const TMDB_SCRAPE_PROVIDER_ORDER = TMDB_SCRAPE_PROVIDER_REGISTRY.map(
  (entry) => entry.id,
) as readonly TmdbScrapeProviderId[];

export const ANIME_SCRAPE_PROVIDER_ORDER = ANIME_SCRAPE_PROVIDER_REGISTRY.map(
  (entry) => entry.id,
) as readonly AnimeScrapeProviderId[];

export const TMDB_SCRAPE_PROVIDER_LABELS = Object.fromEntries(
  TMDB_SCRAPE_PROVIDER_REGISTRY.map((entry) => [entry.id, entry.name]),
) as Record<TmdbScrapeProviderId, string>;

export const ANIME_SCRAPE_PROVIDER_LABELS = Object.fromEntries(
  ANIME_SCRAPE_PROVIDER_REGISTRY.map((entry) => [entry.id, entry.name]),
) as Record<AnimeScrapeProviderId, string>;

export const TMDB_SCRAPE_PROVIDER_OPTIONS = TMDB_SCRAPE_PROVIDER_REGISTRY.map(
  (entry) => ({ providerId: entry.id, name: entry.name }),
);

export const ANIME_SCRAPE_PROVIDER_OPTIONS = ANIME_SCRAPE_PROVIDER_REGISTRY.map(
  (entry) => ({ providerId: entry.id, name: entry.name }),
);

export type AnimePlaybackScrapeProviderId =
  | AnimeScrapeProviderId
  | TmdbScrapeProviderId;

export const ANIME_PLAYBACK_SCRAPE_PROVIDER_ORDER = [
  ...ANIME_SCRAPE_PROVIDER_ORDER,
  ...TMDB_SCRAPE_PROVIDER_ORDER,
] as const satisfies readonly AnimePlaybackScrapeProviderId[];

export const ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS: Record<
  AnimePlaybackScrapeProviderId,
  string
> = {
  ...ANIME_SCRAPE_PROVIDER_LABELS,
  ...TMDB_SCRAPE_PROVIDER_LABELS,
};

export const ANIME_PLAYBACK_SCRAPE_PROVIDER_OPTIONS =
  ANIME_PLAYBACK_SCRAPE_PROVIDER_ORDER.map((providerId) => ({
    providerId,
    name: ANIME_PLAYBACK_SCRAPE_PROVIDER_LABELS[providerId],
  }));

const tmdbScrapeIdSet = new Set<string>(TMDB_SCRAPE_PROVIDER_ORDER);
const animeScrapeIdSet = new Set<string>(ANIME_SCRAPE_PROVIDER_ORDER);

export const embedOnlyProviderIds = (): string[] =>
  EMBED_PROVIDER_REGISTRY.filter(
    (entry) =>
      entry.capabilities.embed &&
      !tmdbScrapeIdSet.has(entry.id) &&
      !animeScrapeIdSet.has(entry.id),
  ).map((entry) => entry.id);

export const dualCapabilityEmbedProviderIds = (): string[] =>
  EMBED_PROVIDER_REGISTRY.filter(
    (entry) => entry.capabilities.embed && tmdbScrapeIdSet.has(entry.id),
  ).map((entry) => entry.id);

export const isTmdbScrapeProvider = (id: string): id is TmdbScrapeProviderId =>
  tmdbScrapeIdSet.has(id);

export const isAnimeScrapeProvider = (
  id: string,
): id is AnimeScrapeProviderId => animeScrapeIdSet.has(id);

export const getProviderName = (id: string): string | undefined => {
  const entry =
    EMBED_PROVIDER_REGISTRY.find((p) => p.id === id) ??
    ANIME_SCRAPE_PROVIDER_REGISTRY.find((p) => p.id === id);
  return entry?.name;
};
