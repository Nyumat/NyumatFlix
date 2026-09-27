import type { SubtitleAppearance } from "@/lib/playback/subtitle-appearance";
import type {
  PlaybackAudioPreference,
  PlaybackQualityPreference,
} from "@/lib/playback/playback-preferences";
import type { VidsrcApi } from "@/lib/providers/embed-urls";

export type CatalogCardStyle = "poster" | "backdrop";

export type UserSettingsWire = {
  playbackAudio: PlaybackAudioPreference | null;
  playbackQuality: PlaybackQualityPreference | null;
  playbackEnglishSubtitles: boolean | null;
  disableHoverSound: boolean | null;
  disableHeroTrailers: boolean | null;
  ambientGlow: boolean | null;
  catalogCardStyle: CatalogCardStyle | null;
  selectedServerId: string | null;
  userSelectedPlaybackServer: boolean;
  policyGenerationAtChoice: string | null;
  vidnestContentType: "movie" | "tv" | "anime" | "animepahe" | null;
  vidsrcApi: VidsrcApi | null;
  subtitleAppearance: SubtitleAppearance | null;
};

export type UserSettingsPatch = Partial<UserSettingsWire>;
