import type {
  PlaybackAudioPreference,
  PlaybackQualityPreference,
} from "@/lib/playback/playback-preferences";
import type { VidsrcApi } from "@/lib/providers/embed-urls";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";
import type { SiteFlags } from "@/lib/flags/site-flags";

export type PlayerEngine = "vidstack" | "movi";

export type DashEngine = "vidstack" | "shaka";

export type VidnestContentType = "movie" | "tv" | "anime" | "animepahe";

export type ExperienceDefaultsConfig = {
  playerEngine: PlayerEngine;
  forcePlayerEngine: boolean;
  dashEngine: DashEngine;
  catalogCardStyle: CatalogCardStyle;
  lockCatalogCardStyle: boolean;
  playbackAudio: PlaybackAudioPreference;
  playbackQuality: PlaybackQualityPreference;
  englishSubtitles: boolean;
  hoverSound: boolean;
  heroTrailers: boolean;
  ambientGlow: boolean;
  vidsrcApi: VidsrcApi;
  vidnestContentType: VidnestContentType;
};

export const DEFAULT_EXPERIENCE_DEFAULTS: ExperienceDefaultsConfig = {
  playerEngine: "vidstack",
  forcePlayerEngine: false,
  dashEngine: "vidstack",
  catalogCardStyle: "backdrop",
  lockCatalogCardStyle: false,
  playbackAudio: "sub",
  playbackQuality: "1080p",
  englishSubtitles: true,
  hoverSound: false,
  heroTrailers: true,
  ambientGlow: false,
  vidsrcApi: "1",
  vidnestContentType: "tv",
};

const PLAYER_ENGINES = new Set<PlayerEngine>(["vidstack", "movi"]);
const DASH_ENGINES = new Set<DashEngine>(["vidstack", "shaka"]);
const CARD_STYLES = new Set<CatalogCardStyle>(["poster", "backdrop"]);
const AUDIO_PREFS = new Set<PlaybackAudioPreference>(["sub", "dub"]);
const QUALITY_PREFS = new Set<PlaybackQualityPreference>([
  "1080p",
  "720p",
  "480p",
]);
const VIDSRC_APIS = new Set<VidsrcApi>(["1", "2", "3", "4"]);
const VIDNEST_TYPES = new Set<VidnestContentType>([
  "movie",
  "tv",
  "anime",
  "animepahe",
]);

const pickEnum = <T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
): T => {
  if (typeof value === "string" && allowed.has(value as T)) {
    return value as T;
  }
  return fallback;
};

const pickBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export const sanitizeExperienceDefaultsConfig = (
  raw: unknown,
): ExperienceDefaultsConfig => {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    playerEngine: pickEnum(
      input.playerEngine,
      PLAYER_ENGINES,
      DEFAULT_EXPERIENCE_DEFAULTS.playerEngine,
    ),
    forcePlayerEngine: pickBool(
      input.forcePlayerEngine,
      DEFAULT_EXPERIENCE_DEFAULTS.forcePlayerEngine,
    ),
    dashEngine: pickEnum(
      input.dashEngine,
      DASH_ENGINES,
      DEFAULT_EXPERIENCE_DEFAULTS.dashEngine,
    ),
    catalogCardStyle: pickEnum(
      input.catalogCardStyle,
      CARD_STYLES,
      DEFAULT_EXPERIENCE_DEFAULTS.catalogCardStyle,
    ),
    lockCatalogCardStyle: pickBool(
      input.lockCatalogCardStyle,
      DEFAULT_EXPERIENCE_DEFAULTS.lockCatalogCardStyle,
    ),
    playbackAudio: pickEnum(
      input.playbackAudio,
      AUDIO_PREFS,
      DEFAULT_EXPERIENCE_DEFAULTS.playbackAudio,
    ),
    playbackQuality: pickEnum(
      input.playbackQuality,
      QUALITY_PREFS,
      DEFAULT_EXPERIENCE_DEFAULTS.playbackQuality,
    ),
    englishSubtitles: pickBool(
      input.englishSubtitles,
      DEFAULT_EXPERIENCE_DEFAULTS.englishSubtitles,
    ),
    hoverSound: pickBool(
      input.hoverSound,
      DEFAULT_EXPERIENCE_DEFAULTS.hoverSound,
    ),
    heroTrailers: pickBool(
      input.heroTrailers,
      DEFAULT_EXPERIENCE_DEFAULTS.heroTrailers,
    ),
    ambientGlow: pickBool(
      input.ambientGlow,
      DEFAULT_EXPERIENCE_DEFAULTS.ambientGlow,
    ),
    vidsrcApi: pickEnum(
      input.vidsrcApi,
      VIDSRC_APIS,
      DEFAULT_EXPERIENCE_DEFAULTS.vidsrcApi,
    ),
    vidnestContentType: pickEnum(
      input.vidnestContentType,
      VIDNEST_TYPES,
      DEFAULT_EXPERIENCE_DEFAULTS.vidnestContentType,
    ),
  };
};

export const experienceDefaultsEquals = (
  a: ExperienceDefaultsConfig,
  b: ExperienceDefaultsConfig,
): boolean => JSON.stringify(a) === JSON.stringify(b);

export type StoredExperiencePreferences = {
  playerEngine?: PlayerEngine | null;
  playbackAudio?: PlaybackAudioPreference | null;
  playbackQuality?: PlaybackQualityPreference | null;
  playbackEnglishSubtitles?: boolean | null;
  disableHoverSound?: boolean | null;
  disableHeroTrailers?: boolean | null;
  ambientGlow?: boolean | null;
  catalogCardStyle?: CatalogCardStyle | null;
  vidsrcApi?: VidsrcApi | null;
  vidnestContentType?: VidnestContentType | null;
};

export type ResolvedExperiencePreferences = {
  playerEngine: PlayerEngine;
  dashEngine: DashEngine;
  catalogCardStyle: CatalogCardStyle;
  playbackAudio: PlaybackAudioPreference;
  playbackQuality: PlaybackQualityPreference;
  playbackEnglishSubtitles: boolean;
  disableHoverSound: boolean;
  disableHeroTrailers: boolean;
  ambientGlow: boolean;
  vidsrcApi: VidsrcApi;
  vidnestContentType: VidnestContentType;
  locks: {
    playerEngine: boolean;
    catalogCardStyle: boolean;
    heroTrailers: boolean;
    ambientGlow: boolean;
    browseSettings: boolean;
  };
};

const resolveNullable = <T>(stored: T | null | undefined, fallback: T): T =>
  stored !== null && stored !== undefined ? stored : fallback;

export const resolveExperiencePreferences = (
  flags: SiteFlags,
  stored: StoredExperiencePreferences = {},
): ResolvedExperiencePreferences => {
  const defaults = flags.experienceDefaults;
  const browseLocked = flags.lockUserSettings;

  const playerEngine = defaults.forcePlayerEngine
    ? defaults.playerEngine
    : resolveNullable(stored.playerEngine, defaults.playerEngine);

  const catalogCardStyle = defaults.lockCatalogCardStyle
    ? defaults.catalogCardStyle
    : resolveNullable(stored.catalogCardStyle, defaults.catalogCardStyle);

  const disableHeroTrailers =
    flags.staticHeroBackdrops || browseLocked
      ? true
      : resolveNullable(stored.disableHeroTrailers, !defaults.heroTrailers);

  const ambientGlow = !flags.ambientGlowEnabled
    ? false
    : resolveNullable(stored.ambientGlow, defaults.ambientGlow);

  return {
    playerEngine,
    dashEngine: defaults.dashEngine,
    catalogCardStyle,
    playbackAudio: resolveNullable(
      stored.playbackAudio,
      defaults.playbackAudio,
    ),
    playbackQuality: resolveNullable(
      stored.playbackQuality,
      defaults.playbackQuality,
    ),
    playbackEnglishSubtitles: resolveNullable(
      stored.playbackEnglishSubtitles,
      defaults.englishSubtitles,
    ),
    disableHoverSound: resolveNullable(
      stored.disableHoverSound,
      !defaults.hoverSound,
    ),
    disableHeroTrailers,
    ambientGlow,
    vidsrcApi: resolveNullable(stored.vidsrcApi, defaults.vidsrcApi),
    vidnestContentType: resolveNullable(
      stored.vidnestContentType,
      defaults.vidnestContentType,
    ),
    locks: {
      playerEngine: defaults.forcePlayerEngine,
      catalogCardStyle: defaults.lockCatalogCardStyle,
      heroTrailers: flags.staticHeroBackdrops || browseLocked,
      ambientGlow: !flags.ambientGlowEnabled,
      browseSettings: browseLocked,
    },
  };
};

export const storedFromUserSettingsWire = (settings: {
  playbackAudio: PlaybackAudioPreference | null;
  playbackQuality: PlaybackQualityPreference | null;
  playbackEnglishSubtitles: boolean | null;
  disableHoverSound: boolean | null;
  disableHeroTrailers: boolean | null;
  ambientGlow: boolean | null;
  catalogCardStyle: CatalogCardStyle | null;
  vidsrcApi: VidsrcApi | null;
  vidnestContentType: VidnestContentType | null;
}): StoredExperiencePreferences => ({
  playbackAudio: settings.playbackAudio,
  playbackQuality: settings.playbackQuality,
  playbackEnglishSubtitles: settings.playbackEnglishSubtitles,
  disableHoverSound: settings.disableHoverSound,
  disableHeroTrailers: settings.disableHeroTrailers,
  ambientGlow: settings.ambientGlow,
  catalogCardStyle: settings.catalogCardStyle,
  vidsrcApi: settings.vidsrcApi,
  vidnestContentType: settings.vidnestContentType,
});
