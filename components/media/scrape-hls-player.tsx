"use client";

import {
  getTimeRangesEnd,
  isDASHProvider,
  isHLSProvider,
  MediaAnnouncer,
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaErrorDetail,
  type MediaProviderAdapter,
  type MediaPlayerInstance,
} from "@vidstack/react";
import Hls from "hls.js";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ScrapeAudioVariantControls } from "@/components/media/controls/scrape-audio-variant-controls";
import { VidstackIntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import { ScrapeVideoLayout } from "@/components/media/scrape-video-layout";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { usePlaybackTrackPreferences } from "@/hooks/use-playback-track-preferences";
import {
  buildIntroDbChapterGradient,
  buildIntroDbChaptersVtt,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { trackMatchesLanguage } from "@/lib/playback/track-matching";
import {
  getTrackPreferences,
  trackPreferenceStorageKey,
} from "@/lib/playback/track-preferences-storage";
import { resolveScrapeAudioVariantUrl } from "@/lib/scrape/audio-versions";
import { configureScrapeHlsInstance } from "@/lib/scrape/hls-quality";
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
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { VIDKING_PROACTIVE_REFRESH_AFTER_MS } from "@/lib/scrape/vidking-constants";
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
  onFatalError?: () => void;
  onEnded?: () => Promise<boolean>;
};

type ScrapePlayerStyle = CSSProperties & {
  [name: `--${string}`]: string | number | null | undefined;
};

const readBufferedEnd = (player: MediaPlayerInstance): number => {
  const provider = player.provider;
  if (provider && "video" in provider && provider.video) {
    return getTimeRangesEnd(provider.video.buffered) ?? 0;
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
  onFatalError,
  onEnded,
}: ScrapeHlsPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const resumedRef = useRef(false);
  const startedRef = useRef(false);
  const fatalReportedRef = useRef(false);
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const [audioLang, setAudioLang] = useState(
    defaultAudioLang ?? audioVersions?.[0]?.lang ?? "",
  );
  const [hardSubLang, setHardSubLang] = useState(defaultHardSubLang ?? "off");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setAudioLang(defaultAudioLang ?? audioVersions?.[0]?.lang ?? "");
    setHardSubLang(defaultHardSubLang ?? "off");
  }, [audioVersions, defaultAudioLang, defaultHardSubLang]);

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
  const [qualityIndex, setQualityIndex] = useState(0);
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

    if (!savedSubtitleLang || savedSubtitleLang === "off") {
      return tracks;
    }

    let matched = false;
    return tracks.map((track) => {
      const isDefault =
        !matched &&
        trackMatchesLanguage(
          { lang: track.lang, label: track.label },
          savedSubtitleLang,
        );

      if (isDefault) {
        matched = true;
      }

      return {
        ...track,
        default: isDefault,
      };
    });
  }, [activeSubtitles, progressKey, referer]);

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
  );

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      if (!provider) {
        return;
      }

      if (isHLSProvider(provider)) {
        provider.library = Hls;
        provider.config = SCRAPE_VOD_HLS_CONFIG;
        provider.onInstance((hls) => {
          configureScrapeHlsInstance(hls);
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
    [],
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

  const handleCanPlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    updateDuration(player.duration);
    applyResumePosition();
    normalizeSpuriousStartupPosition();

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const hasUserActivation =
      typeof navigator !== "undefined" &&
      "userActivation" in navigator &&
      Boolean(
        (
          navigator as Navigator & {
            userActivation?: { hasBeenActive?: boolean };
          }
        ).userActivation?.hasBeenActive,
      );
    if (!hasUserActivation) {
      return;
    }

    void player.play().catch(() => undefined);
  }, [applyResumePosition, normalizeSpuriousStartupPosition, updateDuration]);

  const handleTimeUpdate = useCallback(
    (detail: { currentTime: number }) => {
      const player = playerRef.current;
      if (!player) {
        return;
      }

      persist(detail.currentTime, player.duration);
    },
    [persist],
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
      onFatalError?.();
    },
    [onFatalError, qualityIndex, qualityOptions, streamKind],
  );

  const handleHlsError = useCallback(
    (detail: { fatal?: boolean }) => {
      if (!detail.fatal) {
        return;
      }

      // ABR height ladders remount the same stream 3× then still fail — skip them.
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
      onFatalError?.();
    },
    [onFatalError, qualityIndex, qualityOptions],
  );

  useEffect(() => {
    setQualityIndex(0);
  }, [qualityOptions]);

  useEffect(() => {
    resumedRef.current = false;
    startedRef.current = false;
    fatalReportedRef.current = false;
    setDuration(0);
  }, [activePlayUrl]);

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
      {audioVersions && audioVersions.length > 0 ? (
        <ScrapeAudioVariantControls
          audioVersions={audioVersions}
          audioLang={audioLang || audioVersions[0]?.lang || ""}
          hardSubLang={hardSubLang}
          onAudioLangChange={(lang) => {
            setAudioLang(lang);
            const next = audioVersions.find((version) => version.lang === lang);
            const stillValid = next?.hardSubs?.some(
              (track) => track.lang === hardSubLang,
            );
            if (!stillValid && hardSubLang !== "off") {
              setHardSubLang("off");
            }
            setQualityIndex(0);
          }}
          onHardSubLangChange={(lang) => {
            setHardSubLang(lang);
            setQualityIndex(0);
          }}
        />
      ) : null}
      <MediaPlayer
        key={activePlayUrl}
        ref={playerRef}
        className="nyumat-scrape-player h-full w-full"
        style={introDbPlayerStyle}
        src={playerSrc}
        title={title}
        poster={poster ?? undefined}
        streamType="on-demand"
        playsInline
        load="eager"
        onProviderChange={handleProviderChange}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
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
        <ScrapeVideoLayout />
        <VidstackIntroDbSegmentControl
          segments={introDbSegments}
          isTv={progressKey.mediaType === "tv"}
          onAdvanceToNextEpisode={onEnded}
        />
      </MediaPlayer>
    </div>
  );
}
