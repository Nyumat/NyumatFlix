"use client";

import {
  getTimeRangesEnd,
  isDASHProvider,
  isHLSProvider,
  isVideoProvider,
  MediaAnnouncer,
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaErrorDetail,
  type MediaProviderAdapter,
  type MediaPlayerInstance,
} from "@vidstack/react";
import Hls, { type ErrorData } from "hls.js";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { VidstackIntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import { shouldShowScrapeAudioVariantMenu } from "@/components/media/controls/scrape-audio-variant-menu";
import { useSubtitleOffsetKeyboardShortcuts } from "@/components/media/controls/scrape-subtitle-offset-controls";
import { ScrapeVideoLayout } from "@/components/media/scrape-video-layout";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import { useDedupeVidstackTextTracks } from "@/hooks/use-dedupe-vidstack-text-tracks";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { usePlaybackTrackPreferences } from "@/hooks/use-playback-track-preferences";
import { useSubtitleAppearance } from "@/hooks/use-subtitle-appearance";
import { useVidstackSubtitleOffset } from "@/hooks/use-vidstack-subtitle-offset";
import {
  buildIntroDbChapterGradient,
  buildIntroDbChaptersVtt,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { trackMatchesLanguage } from "@/lib/playback/track-matching";
import {
  getTrackPreferences,
  trackPreferenceStorageKey,
  updateTrackPreferences,
} from "@/lib/playback/track-preferences-storage";
import { pickScrapeQualityIndexForPreference } from "@/lib/playback/playback-preferences";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { resolveScrapeAudioVariantUrl } from "@/lib/scrape/audio-versions";
import {
  isDirectTranscodeHlsUrl,
  mergeTranscodeHlsAuthConfig,
} from "@/lib/direct/transcode-hls-auth";
import { mergeScrapeHlsClientAuthConfig } from "@/lib/api/scrape-hls-client-auth";
import {
  configureScrapeHlsInstance,
  isScrapeHlsMidstream,
  shouldFailoverScrapeHlsFatal,
} from "@/lib/scrape/hls-quality";
import { SCRAPE_VOD_HLS_CONFIG } from "@/lib/scrape/hls-vod-config";
import { resolveActiveSubtitles } from "@/lib/scrape/linked-config";
import {
  buildScrapeQualityPlayOptions,
  buildScrapeSubtitleTracks,
  isAbrOnlyQualityFailover,
} from "@/lib/scrape/player-sources";
import {
  buildScrapePlayUrl,
  extractScrapePlaybackRefreshFromPlayUrl,
} from "@/lib/scrape/playback";
import {
  buildScrapeMediaPlayerSrc,
  type ScrapeStreamKind,
} from "@/lib/scrape/stream-kind";
import { isVidnestClientOnlyCdn } from "@/lib/scrape/vidnest-shared";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { VIDKING_PROACTIVE_REFRESH_AFTER_MS } from "@/lib/scrape/vidking-constants";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import {
  decidePlaybackAutoStart,
  vidstackScrapeStartTimeoutMs,
} from "@/lib/playback/playbackStart";
import { cn } from "@/lib/utils";

import "./scrape-hls-player.css";

const VIDKING_KEEPALIVE_INTERVAL_MS = VIDKING_PROACTIVE_REFRESH_AFTER_MS;

const loadDashjsLibrary = () =>
  import("dashjs").then((module) => ({ default: module.MediaPlayer }));

type ScrapeHlsPlayerProps = {
  playUrl: string;
  streamKind?: ScrapeStreamKind;
  qualities?: ScrapeQuality[];
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  title: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  imdbId?: string | null;
  className?: string;
  autoPlay?: boolean;
  onFatalError?: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
};

type ScrapePlayerStyle = CSSProperties & {
  [name: `--${string}`]: string | number | null | undefined;
};

const readProviderVideo = (
  player: MediaPlayerInstance | null,
): HTMLVideoElement | null => {
  const provider = player?.provider;
  if (
    provider &&
    "video" in provider &&
    provider.video instanceof HTMLVideoElement
  ) {
    return provider.video;
  }

  return null;
};

const readBufferedEnd = (player: MediaPlayerInstance): number => {
  const video = readProviderVideo(player);
  if (video) {
    return getTimeRangesEnd(video.buffered) ?? 0;
  }

  return 0;
};

const isSpuriousEndPosition = (player: MediaPlayerInstance) => {
  const { currentTime, duration } = player;
  const bufferedEnd = readBufferedEnd(player);
  if (!Number.isFinite(duration) || duration <= 0) {
    return false;
  }

  return currentTime >= Math.max(0, duration - 1) && bufferedEnd < 1;
};

export function ScrapeHlsPlayer({
  playUrl,
  streamKind = "hls",
  qualities,
  referer,
  subtitles,
  audioVersions,
  defaultAudioLang,
  defaultHardSubLang,
  preferredAudioLang,
  title,
  poster,
  progressKey,
  imdbId = null,
  className,
  autoPlay = true,
  onFatalError,
  onMediaReady,
  onEnded,
}: ScrapeHlsPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const resumedRef = useRef(false);
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const fatalReportedRef = useRef(false);
  const hlsHopLockRef = useRef(false);
  const hopFromHlsFailureRef = useRef<() => void>(() => undefined);
  const onMediaReadyRef = useRef(onMediaReady);
  const onFatalErrorRef = useRef(onFatalError);
  onMediaReadyRef.current = onMediaReady;
  onFatalErrorRef.current = onFatalError;

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(() => onMediaReadyRef.current?.(), readyRef)();
  }, []);
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const playbackQuality = useAppSettingsStore((state) => state.playbackQuality);
  const playbackEnglishSubtitles = useAppSettingsStore(
    (state) => state.playbackEnglishSubtitles,
  );
  const [audioLang, setAudioLang] = useState(
    defaultAudioLang ?? audioVersions?.[0]?.lang ?? "",
  );
  const [hardSubLang, setHardSubLang] = useState(defaultHardSubLang ?? "off");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setAudioLang(defaultAudioLang ?? audioVersions?.[0]?.lang ?? "");
    setHardSubLang(defaultHardSubLang ?? "off");
  }, [audioVersions, defaultAudioLang, defaultHardSubLang]);

  const trackPreferencesKey = useMemo(
    () => trackPreferenceStorageKey(progressKey),
    [progressKey.contentId, progressKey.mediaType],
  );

  const handleAudioLangChange = useCallback(
    (lang: string) => {
      if (!audioVersions?.length) {
        return;
      }

      setAudioLang(lang);
      updateTrackPreferences(trackPreferencesKey, { audioLang: lang });

      const next = audioVersions.find((version) => version.lang === lang);
      const stillValid = next?.hardSubs?.some(
        (track) => track.lang === hardSubLang,
      );
      if (!stillValid && hardSubLang !== "off") {
        setHardSubLang("off");
      }
      setQualityIndex(0);
    },
    [audioVersions, hardSubLang, trackPreferencesKey],
  );

  const handleHardSubLangChange = useCallback((lang: string) => {
    setHardSubLang(lang);
    setQualityIndex(0);
  }, []);

  const audioVariantMenu = useMemo(() => {
    if (!audioVersions?.length) {
      return undefined;
    }

    if (!shouldShowScrapeAudioVariantMenu(audioVersions, audioLang)) {
      return undefined;
    }

    return {
      audioVersions,
      audioLang: audioLang || audioVersions[0]?.lang || "",
      hardSubLang,
      onAudioLangChange: handleAudioLangChange,
      onHardSubLangChange: handleHardSubLangChange,
    };
  }, [
    audioLang,
    audioVersions,
    handleAudioLangChange,
    handleHardSubLangChange,
    hardSubLang,
  ]);

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
  const activeOption = qualityOptions[qualityIndex] ?? qualityOptions[0];
  const activePlayUrl = activeOption?.playUrl ?? playUrl;
  const activePlaybackUrl = useMemo(() => {
    if (!activePlayUrl.startsWith("/")) {
      return activePlayUrl;
    }

    try {
      return new URL(activePlayUrl, window.location.href).toString();
    } catch {
      return activePlayUrl;
    }
  }, [activePlayUrl]);
  const playerSrc = useMemo(
    () => buildScrapeMediaPlayerSrc(activePlaybackUrl, streamKind),
    [activePlaybackUrl, streamKind],
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

  const textTracks = useMemo(() => {
    const tracks = buildScrapeSubtitleTracks(activeSubtitles, referer);
    const savedSubtitleLang = getTrackPreferences(
      trackPreferenceStorageKey(progressKey),
    )?.subtitleLang;
    const preferredSubtitleLang =
      savedSubtitleLang ?? (playbackEnglishSubtitles ? "English" : undefined);

    if (!preferredSubtitleLang || preferredSubtitleLang === "off") {
      return tracks;
    }

    let matched = false;
    return tracks.map((track) => {
      const isDefault =
        !matched &&
        trackMatchesLanguage(
          { lang: track.lang, label: track.label },
          preferredSubtitleLang,
        );

      if (isDefault) {
        matched = true;
      }

      return {
        ...track,
        default: isDefault,
      };
    });
  }, [activeSubtitles, playbackEnglishSubtitles, progressKey, referer]);

  useDedupeVidstackTextTracks(playerRef, textTracks.length > 0);

  const { segments: introDbSegments } = useIntroDbSegments(
    progressKey,
    duration,
    imdbId,
  );
  const introDbChapters = useMemo(
    () => buildIntroDbChaptersVtt(introDbSegments),
    [introDbSegments],
  );
  const introDbChapterGradient = useMemo(
    () => buildIntroDbChapterGradient(introDbSegments, duration),
    [duration, introDbSegments],
  );
  const introDbPlayerStyle: ScrapePlayerStyle | undefined =
    introDbChapterGradient
      ? ({
          "--nyumat-introdb-chapter-gradient": introDbChapterGradient,
        } as ScrapePlayerStyle)
      : undefined;

  usePlaybackTrackPreferences(
    playerRef,
    progressKey,
    activePlayUrl,
    preferredAudioLang,
    { preferEnglishSubtitles: playbackEnglishSubtitles },
  );

  const subtitleOffset = useVidstackSubtitleOffset(
    playerRef,
    progressKey,
    activeSubtitles.length > 0,
  );
  const subtitleAppearance = useSubtitleAppearance(playerRef);
  useSubtitleOffsetKeyboardShortcuts({
    offsetSeconds: subtitleOffset.offsetSeconds,
    onOffsetChange: subtitleOffset.setOffsetSeconds,
    visible: subtitleOffset.hasTracks,
  });

  const hopFromHlsFailure = useCallback(() => {
    if (hlsHopLockRef.current) {
      return;
    }
    hlsHopLockRef.current = true;
    queueMicrotask(() => {
      hlsHopLockRef.current = false;
    });

    if (
      qualityIndex < qualityOptions.length - 1 &&
      !isAbrOnlyQualityFailover(qualityOptions)
    ) {
      setQualityIndex((index) => index + 1);
      return;
    }

    if (fatalReportedRef.current) {
      return;
    }
    fatalReportedRef.current = true;
    onFatalErrorRef.current?.();
  }, [qualityIndex, qualityOptions]);
  hopFromHlsFailureRef.current = hopFromHlsFailure;

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      if (!provider) {
        return;
      }

      if (autoPlay && isVideoProvider(provider)) {
        provider.video.muted = false;
        provider.video.volume = 1;
      }

      if (
        streamKind === "mp4" &&
        activePlaybackUrl.startsWith("http") &&
        isVidnestClientOnlyCdn(activePlaybackUrl) &&
        isVideoProvider(provider)
      ) {
        // hakunaymatata CDN rejects range requests that carry a site referer.
        provider.video.setAttribute("referrerpolicy", "no-referrer");
      }

      if (isHLSProvider(provider)) {
        provider.library = Hls;
        provider.config = mergeScrapeHlsClientAuthConfig(
          isDirectTranscodeHlsUrl(activePlaybackUrl)
            ? mergeTranscodeHlsAuthConfig(
                activePlaybackUrl,
                SCRAPE_VOD_HLS_CONFIG,
              )
            : SCRAPE_VOD_HLS_CONFIG,
        );
        provider.onInstance((hls) => {
          configureScrapeHlsInstance(hls, {
            onRecoveryExhausted: () => {
              hopFromHlsFailureRef.current();
            },
          });
        });
        return;
      }

      if (isDASHProvider(provider)) {
        provider.config = {
          debug: {
            logLevel: 0,
          },
          streaming: {
            cmcd: { enabled: false },
          },
        };
        provider.library = loadDashjsLibrary;
      }
    },
    [activePlaybackUrl, autoPlay, streamKind],
  );

  const applyResumePosition = useCallback(() => {
    const player = playerRef.current;
    if (!player || resumedRef.current || resumeTime <= 0) {
      return;
    }

    const duration = player.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }

    resumedRef.current = true;
    player.currentTime = Math.min(resumeTime, duration);
  }, [resumeTime]);

  const normalizeSpuriousStartupPosition = useCallback(() => {
    const player = playerRef.current;
    if (!player || resumeTime > 0 || resumedRef.current) {
      return;
    }

    if (!isSpuriousEndPosition(player)) {
      return;
    }

    player.currentTime = 0;
  }, [resumeTime]);

  const updateDuration = useCallback((nextDuration: number) => {
    if (Number.isFinite(nextDuration) && nextDuration > 0) {
      setDuration((currentDuration) => currentDuration || nextDuration);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      updateDuration(player.duration);
    }
    normalizeSpuriousStartupPosition();
  }, [normalizeSpuriousStartupPosition, updateDuration]);

  const attemptPlaybackStart = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const providerVideo =
      player.provider && "video" in player.provider
        ? player.provider.video
        : null;
    const video =
      providerVideo ?? document.querySelector(".nyumat-scrape-player video");
    const isCurrentlyPlaying =
      video instanceof HTMLVideoElement
        ? video.paused === false
        : player.paused === false;
    const decision = decidePlaybackAutoStart({
      autoPlay,
      hasStarted: startedRef.current,
      isCurrentlyPlaying,
    });

    if (decision === "already-playing") {
      startedRef.current = true;
      markMediaReady();
      return;
    }

    if (decision === "skip") {
      return;
    }

    player.muted = false;
    player.volume = 1;
    if (video instanceof HTMLVideoElement) {
      video.muted = false;
      video.volume = 1;
      if (video.readyState < 2) {
        return;
      }
      void video
        .play()
        .then(() => {
          if (!video.paused) {
            startedRef.current = true;
            markMediaReady();
          }
        })
        .catch(() => undefined);
      return;
    }

    void player
      .play()
      .then(() => {
        if (!player.paused) {
          startedRef.current = true;
          markMediaReady();
        }
      })
      .catch(() => undefined);
  }, [autoPlay, markMediaReady]);

  const handleCanPlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    updateDuration(player.duration);
    applyResumePosition();
    normalizeSpuriousStartupPosition();
    attemptPlaybackStart();
  }, [
    applyResumePosition,
    attemptPlaybackStart,
    normalizeSpuriousStartupPosition,
    updateDuration,
  ]);

  const handleLoadedData = useCallback(() => {
    attemptPlaybackStart();
  }, [attemptPlaybackStart]);

  const handlePlaying = useCallback(() => {
    startedRef.current = true;
    markMediaReady();
  }, [markMediaReady]);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      if (detail.currentTime > 0) {
        markMediaReady();
      }

      persist(detail.currentTime, player.duration);
    },
    [markMediaReady, persist],
  );

  const handleEnded = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    persistImmediate(player.currentTime, player.duration);
    void onEnded?.();
  }, [onEnded, persistImmediate]);

  const handlePlaybackError = useCallback(
    (_detail: MediaErrorDetail) => {
      // hls.js fatals come through onHlsError. Ignoring MediaError for HLS
      // avoids aborting streams mid-buffer (VidSrc often emits a startup
      // MediaError right before the first frame).
      if (streamKind === "hls") {
        return;
      }

      if (
        qualityIndex < qualityOptions.length - 1 &&
        !isAbrOnlyQualityFailover(qualityOptions)
      ) {
        setQualityIndex((index) => index + 1);
        return;
      }

      if (fatalReportedRef.current) {
        return;
      }
      fatalReportedRef.current = true;
      onFatalErrorRef.current?.();
    },
    [qualityIndex, qualityOptions, streamKind],
  );

  const handleHlsError = useCallback(
    (detail: ErrorData) => {
      const midstream =
        startedRef.current ||
        isScrapeHlsMidstream(readProviderVideo(playerRef.current));
      if (!shouldFailoverScrapeHlsFatal(detail, midstream)) {
        return;
      }

      hopFromHlsFailure();
    },
    [hopFromHlsFailure],
  );

  useEffect(() => {
    setQualityIndex(
      pickScrapeQualityIndexForPreference(qualityOptions, playbackQuality),
    );
  }, [playbackQuality, qualityOptions]);

  useEffect(() => {
    resumedRef.current = false;
    startedRef.current = false;
    readyRef.current = false;
    fatalReportedRef.current = false;
    hlsHopLockRef.current = false;
    setDuration(0);
  }, [activePlayUrl]);

  useEffect(() => {
    if (!autoPlay) {
      return undefined;
    }

    const pollMs = duration > 0 ? 2000 : 1500;
    const pollForMs = duration > 0 ? 120_000 : 180_000;

    const tick = () => {
      attemptPlaybackStart();
    };

    tick();
    const interval = window.setInterval(tick, pollMs);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, pollForMs);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [activePlayUrl, attemptPlaybackStart, autoPlay, duration]);

  useEffect(() => {
    if (!autoPlay || duration > 0) {
      return undefined;
    }

    const failTimeout = window.setTimeout(() => {
      if (fatalReportedRef.current || startedRef.current || readyRef.current) {
        return;
      }
      fatalReportedRef.current = true;
      onFatalErrorRef.current?.();
    }, vidstackScrapeStartTimeoutMs(activePlayUrl));

    return () => window.clearTimeout(failTimeout);
  }, [activePlayUrl, autoPlay, duration]);

  useEffect(() => {
    const refresh = extractScrapePlaybackRefreshFromPlayUrl(activePlayUrl);
    if (!refresh) {
      return;
    }

    const keepSessionWarm = () => {
      void fetch(activePlayUrl, {
        method: "GET",
        cache: "no-store",
      }).catch(() => undefined);
    };

    keepSessionWarm();
    const interval = setInterval(
      keepSessionWarm,
      VIDKING_KEEPALIVE_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [activePlayUrl]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <MediaPlayer
        key={activePlayUrl}
        ref={playerRef}
        className="nyumat-scrape-player h-full w-full"
        style={introDbPlayerStyle}
        src={playerSrc}
        title={title}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        muted={false}
        volume={1}
        streamType="on-demand"
        playsInline
        load="eager"
        logLevel="silent"
        onProviderChange={handleProviderChange}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleLoadedData}
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onDurationChange={updateDuration}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handlePlaybackError}
        onHlsError={handleHlsError}
      >
        <MediaProvider>
          {textTracks.map((track) => (
            <Track
              key={track.id}
              id={track.id}
              src={track.src}
              kind="subtitles"
              label={track.label}
              lang={track.lang}
              type={track.type}
              default={track.default}
            />
          ))}
          {introDbChapters ? (
            <Track
              id="introdb-chapters"
              content={introDbChapters}
              kind="chapters"
              label="TheIntroDB segments"
              type="vtt"
              default
            />
          ) : null}
        </MediaProvider>
        <MediaAnnouncer />
        <Poster className="vds-poster" alt="" />
        <ScrapeVideoLayout
          audioVariant={audioVariantMenu}
          subtitleOffset={{
            offsetSeconds: subtitleOffset.offsetSeconds,
            onOffsetChange: subtitleOffset.setOffsetSeconds,
            visible: subtitleOffset.hasTracks,
          }}
          subtitleAppearance={{
            appearance: subtitleAppearance.appearance,
            onAppearanceChange: subtitleAppearance.setAppearance,
            onAppearanceReset: subtitleAppearance.resetAppearance,
          }}
        />
        <VidstackIntroDbSegmentControl
          segments={introDbSegments}
          isTv={progressKey.mediaType === "tv"}
          onAdvanceToNextEpisode={onEnded}
        />
      </MediaPlayer>
    </div>
  );
}
