"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { pickScrapeQualityIndexForPreference } from "@/lib/playback/playback-preferences";
import { resolveScrapeAudioVariantUrl } from "@/lib/scrape/audio-versions";
import { resolveActiveSubtitles } from "@/lib/scrape/linked-config";
import {
  buildScrapeQualityPlayOptions,
  isAbrOnlyQualityFailover,
  type ScrapePlayerTextTrack,
} from "@/lib/scrape/player-sources";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  buildScrapePlayUrl,
  extractScrapePlaybackRefreshFromPlayUrl,
} from "@/lib/scrape/playback";
import type { ScrapeStreamKind } from "@/lib/scrape/stream-kind";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import type {
  ManifestAudioVersion,
  ManifestQuality,
  ManifestSubtitle,
  PlayableManifest,
  PlaybackManifestKind,
} from "@nyumatflix/playback";

const manifestKindToStreamKind = (
  kind: PlaybackManifestKind,
): ScrapeStreamKind => {
  if (kind === "dash") {
    return "dash";
  }
  if (kind === "progressive") {
    return "mp4";
  }
  return "hls";
};

const mapManifestSubtitle = (track: ManifestSubtitle): ScrapeSubtitle => ({
  lang: track.lang,
  url: track.url,
  format: track.format,
  referer: track.referer,
  source: track.source,
});

const mapManifestQuality = (quality: ManifestQuality): ScrapeQuality => ({
  label: quality.label,
  url: quality.url,
  referer: quality.referer,
  subtitles: quality.subtitles?.map(mapManifestSubtitle),
});

const mapManifestAudioVersion = (
  version: ManifestAudioVersion,
): ScrapeAudioVersion => ({
  lang: version.lang,
  label: version.label,
  url: version.url,
  original: version.original,
});

export const resolveAbsolutePlaybackUrl = (playUrl: string): string => {
  if (playUrl.startsWith("http://") || playUrl.startsWith("https://")) {
    return playUrl;
  }

  try {
    return new URL(playUrl, window.location.href).toString();
  } catch {
    return playUrl;
  }
};

export type ScrapePlaybackOptions = {
  playUrl: string;
  streamKind: ScrapeStreamKind;
  referer?: string;
  subtitles: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  qualityOptions: ReturnType<typeof buildScrapeQualityPlayOptions>;
  qualityIndex: number;
  setQualityIndex: React.Dispatch<React.SetStateAction<number>>;
  activeOption: ReturnType<typeof buildScrapeQualityPlayOptions>[number];
  activePlayUrl: string;
  activePlaybackUrl: string;
  activeSubtitles: ScrapeSubtitle[];
  audioLang: string;
  hardSubLang: string;
  handleAudioLangChange: (lang: string) => void;
  handleHardSubLangChange: (lang: string) => void;
  bumpQualityOrFail: (reportFatal: () => void) => void;
};

export const useScrapePlaybackOptions = (
  manifest: PlayableManifest,
  _progressKey: PlaybackProgressKey,
): ScrapePlaybackOptions => {
  const playbackQuality = useAppSettingsStore((state) => state.playbackQuality);

  const playUrl = manifest.url;
  const streamKind = manifestKindToStreamKind(manifest.kind);
  const referer = manifest.referer;
  const subtitles = useMemo(
    () => manifest.subtitles.map(mapManifestSubtitle),
    [manifest.subtitles],
  );
  const qualities = useMemo(
    () => manifest.qualities?.map(mapManifestQuality),
    [manifest.qualities],
  );
  const audioVersions = useMemo(
    () => manifest.audioVersions?.map(mapManifestAudioVersion),
    [manifest.audioVersions],
  );
  const defaultAudioLang = manifest.defaultAudioLang;
  const defaultHardSubLang = manifest.defaultHardSubLang;
  const preferredAudioLang = manifest.preferredAudioLang;

  const [audioLang, setAudioLang] = useState(
    defaultAudioLang ?? audioVersions?.[0]?.lang ?? "",
  );
  const [hardSubLang, setHardSubLang] = useState(defaultHardSubLang ?? "off");

  useEffect(() => {
    setAudioLang(defaultAudioLang ?? audioVersions?.[0]?.lang ?? "");
    setHardSubLang(defaultHardSubLang ?? "off");
  }, [audioVersions, defaultAudioLang, defaultHardSubLang]);

  const handleAudioLangChange = useCallback(
    (lang: string) => {
      if (!audioVersions?.length) {
        return;
      }

      setAudioLang(lang);

      const next = audioVersions.find((version) => version.lang === lang);
      const stillValid = next?.hardSubs?.some(
        (track) => track.lang === hardSubLang,
      );
      if (!stillValid && hardSubLang !== "off") {
        setHardSubLang("off");
      }
      setQualityIndex(0);
    },
    [audioVersions, hardSubLang],
  );

  const handleHardSubLangChange = useCallback((lang: string) => {
    setHardSubLang(lang);
    setQualityIndex(0);
  }, []);

  const variantRawUrl = useMemo(() => {
    if (!audioVersions?.length || !audioLang) {
      return null;
    }
    return resolveScrapeAudioVariantUrl(audioVersions, audioLang, hardSubLang);
  }, [audioLang, audioVersions, hardSubLang]);

  const variantPlayUrl = useMemo(() => {
    if (!variantRawUrl) {
      return null;
    }
    const refresh = extractScrapePlaybackRefreshFromPlayUrl(playUrl);
    return buildScrapePlayUrl({
      url: variantRawUrl,
      referer,
      refresh,
    });
  }, [playUrl, referer, variantRawUrl]);

  const qualityOptions = useMemo(
    () =>
      buildScrapeQualityPlayOptions(
        variantPlayUrl ?? playUrl,
        qualities,
        referer,
        subtitles,
      ),
    [playUrl, qualities, referer, subtitles, variantPlayUrl],
  );

  const [qualityIndex, setQualityIndex] = useState(() =>
    pickScrapeQualityIndexForPreference(qualityOptions, playbackQuality),
  );

  useEffect(() => {
    setQualityIndex(
      pickScrapeQualityIndexForPreference(qualityOptions, playbackQuality),
    );
  }, [playbackQuality, qualityOptions]);

  const activeOption = qualityOptions[qualityIndex] ?? qualityOptions[0];
  const activePlayUrl = activeOption?.playUrl ?? playUrl;
  const activePlaybackUrl = useMemo(
    () => resolveAbsolutePlaybackUrl(activePlayUrl),
    [activePlayUrl],
  );

  const activeSubtitles = useMemo(() => {
    const fromAudio = resolveActiveSubtitles({
      audioVersions,
      audioLang,
    });
    if (fromAudio.length > 0) {
      return fromAudio;
    }
    return activeOption?.subtitles ?? subtitles ?? [];
  }, [activeOption?.subtitles, audioLang, audioVersions, subtitles]);

  const bumpQualityOrFail = useCallback(
    (reportFatal: () => void) => {
      if (
        qualityIndex < qualityOptions.length - 1 &&
        !isAbrOnlyQualityFailover(qualityOptions)
      ) {
        setQualityIndex((index) => index + 1);
        return;
      }
      reportFatal();
    },
    [qualityIndex, qualityOptions],
  );

  return {
    playUrl,
    streamKind,
    referer,
    subtitles,
    qualities,
    audioVersions,
    defaultAudioLang,
    defaultHardSubLang,
    preferredAudioLang,
    qualityOptions,
    qualityIndex,
    setQualityIndex,
    activeOption,
    activePlayUrl,
    activePlaybackUrl,
    activeSubtitles,
    audioLang,
    hardSubLang,
    handleAudioLangChange,
    handleHardSubLangChange,
    bumpQualityOrFail,
  };
};

export type { ScrapePlayerTextTrack };
