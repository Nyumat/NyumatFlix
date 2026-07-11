/**
 * Canonical provider catalog — single source for embed vs scrape capabilities,
 * display names, and provider ordering.
 */

export type TmdbScrapeProviderId =
  | "vidking"
  | "vidnest"
  | "vidsrc"
  | "2embed"
  | "vidsrc-mirror";

export type AnimeScrapeProviderId =
  | "anizone"
  | "anipm"
  | "hentaigasm"
  | "kickassanime"
  | "animeonsen"
  | "allmanga"
  | "animestream"
  | "animegg"
  | "animepahe";

export type EmbedProviderId =
  | "vidsrc"
  | "vidsrc-mirror"
  | "superembed"
  | "2embed"
  | "111movies"
  | "vidnest"
  | "vidfast"
  | "videasy"
  | "vidking";

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
  provider("vidsrc-mirror", "VidSrc Mirror", { embed: true, tmdbScrape: true }),
  provider("superembed", "SuperEmbed", { embed: true }),
  provider("2embed", "2Embed", { embed: true, tmdbScrape: true }),
  provider("111movies", "111Movies", { embed: true }),
  provider("vidnest", "VidNest", {
    embed: true,
    tmdbScrape: true,
    animeEmbed: true,
  }),
  provider("vidfast", "VidFast", { embed: true }),
  provider("videasy", "VidEasy", { embed: true, animeEmbed: true }),
  provider("vidking", "VidKing", { embed: true, tmdbScrape: true }),
];

export const TMDB_SCRAPE_PROVIDER_REGISTRY: ProviderDefinition[] = [
  provider("vidsrc", "VidSrc", { embed: true, tmdbScrape: true }),
  provider("vidking", "VidKing", { embed: true, tmdbScrape: true }),
  provider("vidnest", "VidNest", {
    embed: true,
    tmdbScrape: true,
    animeEmbed: true,
  }),
  provider("2embed", "2Embed", { embed: true, tmdbScrape: true }),
  provider("vidsrc-mirror", "VidSrc Mirror", { embed: true, tmdbScrape: true }),
];

export const ANIME_SCRAPE_PROVIDER_REGISTRY: ProviderDefinition[] = [
  provider("anizone", "AniZone", { embed: false, animeScrape: true }),
  provider("anipm", "ani.pm", { embed: false, animeScrape: true }),
  provider("hentaigasm", "Hentaigasm", { embed: false, animeScrape: true }),
  provider("kickassanime", "KickAssAnime", { embed: false, animeScrape: true }),
  provider("animeonsen", "AnimeOnsen", { embed: false, animeScrape: true }),
  provider("animegg", "AnimeGG", { embed: false, animeScrape: true }),
  provider("animepahe", "AnimePahe", { embed: false, animeScrape: true }),
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
    (entry) => entry.capabilities.embed && !tmdbScrapeIdSet.has(entry.id),
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
