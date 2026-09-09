import type {
  ManifestAudioVersion,
  ManifestQuality,
  ManifestSubtitle,
  PlayableManifest,
  PlaybackManifestKind,
} from "@nyumatflix/playback";
import type { DirectStream } from "@nyumatflix/playback";
import {
  progressStorageKey,
  type PlaybackProgressKey,
} from "@/lib/playback/progress-storage";
import { inferScrapeStreamKind } from "@/lib/scrape/stream-kind";
import { trimDashStartupSubtitles } from "@/lib/playback/dash-startup-subtitles";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";

export type ScrapePlaybackPayload = {
  providerId: string;
  providerName: string;
  playUrl: string;
  streamKind?: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  directPlayback?: "hls" | "direct" | "extended";
  directFallbackUrl?: string;
  directStreamName?: string;
  directFileName?: string;
};

const mapSubtitle = (track: ScrapeSubtitle): ManifestSubtitle => ({
  lang: track.lang,
  url: track.url,
  format: track.format,
  referer: track.referer,
  source: track.source,
});

const mapQuality = (quality: ScrapeQuality): ManifestQuality => ({
  label: quality.label,
  url: quality.url,
  referer: quality.referer,
  subtitles: quality.subtitles?.map(mapSubtitle),
});

const mapAudioVersion = (version: ScrapeAudioVersion): ManifestAudioVersion => ({
  lang: version.lang,
  label: version.label,
  url: version.url,
  original: version.original,
});

const streamKindToManifestKind = (
  streamKind: "hls" | "dash" | "mp4",
): PlaybackManifestKind => {
  if (streamKind === "dash") {
    return "dash";
  }
  if (streamKind === "mp4") {
    return "progressive";
  }
  return "hls";
};

export const manifestSessionKey = (
  manifest: PlayableManifest,
  progressKey?: PlaybackProgressKey,
): string => {
  const qualityKey =
    manifest.qualities?.map((quality) => quality.label).join(",") ?? "";
  const audioKey =
    manifest.audioVersions
      ?.map((version) => `${version.lang}:${version.label}`)
      .join("|") ?? "";
  const coordsKey = progressKey ? progressStorageKey(progressKey) : "";
  return `${manifest.id}-${manifest.url}-${qualityKey}-${audioKey}-${coordsKey}`;
};

export const buildManifestId = (input: {
  providerId: string;
  playUrl: string;
  progressKey?: PlaybackProgressKey;
}): string => {
  const coordsKey = input.progressKey
    ? progressStorageKey(input.progressKey)
    : "";
  return `${input.providerId}:${input.playUrl}:${coordsKey}`;
};

export const toPlayableManifestFromScrape = (
  payload: ScrapePlaybackPayload,
  progressKey?: PlaybackProgressKey,
): PlayableManifest => {
  const inferredKind = inferScrapeStreamKind(
    payload.playUrl,
    payload.streamKind,
  );
  const isDirectViaScrape =
    payload.providerId === "direct" && Boolean(payload.directPlayback);
  const manifestKind = streamKindToManifestKind(inferredKind);
  const startupSubtitles =
    manifestKind === "dash"
      ? trimDashStartupSubtitles(
          payload.subtitles,
          payload.preferredAudioLang ?? payload.defaultAudioLang,
        )
      : payload.subtitles;

  return {
    id: buildManifestId({
      providerId: payload.providerId,
      playUrl: payload.playUrl,
      progressKey,
    }),
    origin: isDirectViaScrape ? "direct" : "scrape",
    url: payload.playUrl,
    kind: manifestKind,
    providerId: payload.providerId,
    providerLabel: payload.providerName,
    referer: payload.referer,
    qualities: payload.qualities?.map(mapQuality),
    subtitles: startupSubtitles?.map(mapSubtitle) ?? [],
    audioVersions: payload.audioVersions?.map(mapAudioVersion),
    defaultAudioLang: payload.defaultAudioLang,
    defaultHardSubLang: payload.defaultHardSubLang,
    preferredAudioLang: payload.preferredAudioLang,
    directPlayback: payload.directPlayback,
    fallbackUrl: payload.directFallbackUrl,
    streamName: payload.directStreamName,
    fileName: payload.directFileName,
  };
};

export const toPlayableManifestFromDirect = (
  stream: DirectStream,
  candidates: DirectStream[] | undefined,
  providerLabel = "Direct",
): PlayableManifest => {
  const kind: PlaybackManifestKind =
    stream.playback === "direct" || stream.playback === "extended"
      ? "progressive"
      : "hls";

  return {
    id: `direct:${stream.hash}`,
    origin: "direct",
    url: stream.url,
    kind,
    providerId: "direct",
    providerLabel,
    subtitles: [],
    directStream: stream,
    directCandidates: candidates,
    directPlayback: stream.playback,
    fallbackUrl: stream.fallbackUrl,
    streamName: stream.name,
    fileName: stream.fileName,
  };
};

const manifestKindToStreamKind = (
  kind: PlaybackManifestKind,
): "hls" | "dash" | "mp4" => {
  if (kind === "dash") {
    return "dash";
  }
  if (kind === "progressive") {
    return "mp4";
  }
  return "hls";
};

export const toScrapePlaybackPayloadFromManifest = (
  manifest: PlayableManifest,
): ScrapePlaybackPayload => ({
  providerId: manifest.providerId,
  providerName: manifest.providerLabel,
  playUrl: manifest.url,
  streamKind: manifestKindToStreamKind(manifest.kind),
  referer: manifest.referer,
  qualities: manifest.qualities?.map((quality) => ({
    label: quality.label,
    url: quality.url,
    referer: quality.referer,
    subtitles: quality.subtitles?.map((track) => ({
      lang: track.lang,
      url: track.url,
      format: track.format,
      referer: track.referer,
      source: track.source,
    })),
  })),
  subtitles: manifest.subtitles.map((track) => ({
    lang: track.lang,
    url: track.url,
    format: track.format,
    referer: track.referer,
    source: track.source,
  })),
  audioVersions: manifest.audioVersions?.map((version) => ({
    lang: version.lang,
    label: version.label,
    url: version.url,
    original: version.original,
  })),
  defaultAudioLang: manifest.defaultAudioLang,
  defaultHardSubLang: manifest.defaultHardSubLang,
  preferredAudioLang: manifest.preferredAudioLang,
  directPlayback: manifest.directPlayback,
  directFallbackUrl: manifest.fallbackUrl,
  directStreamName: manifest.streamName,
  directFileName: manifest.fileName,
});
