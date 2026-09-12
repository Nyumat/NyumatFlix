import type { SubtitleAppearance } from "@/lib/playback/subtitle-appearance";
import type {
  PlaybackAudioPreference,
  PlaybackQualityPreference,
} from "@/lib/playback/playback-preferences";
import type { VidsrcApi } from "@/lib/providers/embed-urls";

export type UserSettingsWire = {
  playbackAudio: PlaybackAudioPreference;
  playbackQuality: PlaybackQualityPreference;
  playbackEnglishSubtitles: boolean;
  disableHoverSound: boolean;
  disableHeroTrailers: boolean;
  selectedServerId: string | null;
  userSelectedPlaybackServer: boolean;
  policyGenerationAtChoice: string | null;
  vidnestContentType: "movie" | "tv" | "anime" | "animepahe";
  vidsrcApi: VidsrcApi;
  subtitleAppearance: SubtitleAppearance | null;
};

export type UserSettingsPatch = Partial<UserSettingsWire>;
