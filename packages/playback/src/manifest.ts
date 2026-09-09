import type { DirectStream } from "./types";

export type PlaybackManifestKind = "hls" | "dash" | "progressive";
export type PlaybackManifestOrigin = "scrape" | "direct";

export type ManifestSubtitle = {
  lang: string;
  url: string;
  format?: "ass" | "srt" | "vtt";
  referer?: string;
  source?: string;
};

export type ManifestQuality = {
  label: string;
  url: string;
  referer?: string;
  subtitles?: ManifestSubtitle[];
};

export type ManifestAudioVersion = {
  lang: string;
  label: string;
  url: string;
  original?: boolean;
};

export type PlayableManifest = {
  id: string;
  origin: PlaybackManifestOrigin;
  url: string;
  kind: PlaybackManifestKind;
  providerId: string;
  providerLabel: string;
  referer?: string;
  headers?: Record<string, string>;
  qualities?: ManifestQuality[];
  subtitles: ManifestSubtitle[];
  audioVersions?: ManifestAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  directStream?: DirectStream;
  directCandidates?: DirectStream[];
  directPlayback?: DirectStream["playback"];
  fallbackUrl?: string;
  streamName?: string;
  fileName?: string;
};
