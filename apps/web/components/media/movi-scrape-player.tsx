"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import { useMoviPlaybackTrackPreferences } from "@/hooks/use-movi-playback-track-preferences";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { resolveScrapeAudioVariantUrl } from "@/lib/scrape/audio-versions";
import {
  formatIntroDbSegmentTitle,
  type IntroDbSegment,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { pickScrapeQualityIndexForPreference } from "@/lib/playback/playback-preferences";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import { resolvePreferredSubtitleLang } from "@/lib/playback/movi-subtitle-preference";
import { trackPreferenceStorageKey } from "@/lib/playback/track-preferences-storage";
import { trackMatchesLanguage } from "@/lib/playback/track-matching";
import {
  decidePlaybackAutoStart,
  ensurePlaybackAtStart,
  hlsStartPosition,
  PLAYBACK_START_TIMEOUT_MS,
} from "@/lib/playback/playbackStart";
import { loadMoviCompat, resolveMoviMediaUrl } from "@/lib/player/load-player";
import {
  applyMoviChapterMarkers,
  applyMoviExternalQualities,
  applyMoviExternalSubtitles,
  type ChapterMarker,
  type ExternalQualityEntry,
} from "@/lib/player/movi-host-api";
import { buildMoviScrapePlaybackHeaders } from "@/lib/player/movi-scrape-headers";
import {
  clearMoviResumeKeys,
  disposeMoviPlayer,
  resolveMoviPosterUrl,
  type MoviPlayerElement,
} from "@/lib/player/player-element";
import {
  getMoviVideoElement,
  isMoviPlayerMakingProgress,
  isMoviVideoPlaybackReady,
  resetMoviProgressObservation,
} from "@/lib/player/player-playback-ready";
import {
  buildScrapeQualityPlayOptions,
  buildScrapeSubtitleTracks,
  isAbrOnlyQualityFailover,
} from "@/lib/scrape/player-sources";
import {
  buildScrapePlayUrl,
  extractScrapePlaybackRefreshFromPlayUrl,
} from "@/lib/scrape/playback";
import { resolveActiveSubtitles } from "@/lib/scrape/linked-config";
import type { ScrapeStreamKind } from "@/lib/scrape/stream-kind";
import { VIDKING_PROACTIVE_REFRESH_AFTER_MS } from "@/lib/scrape/vidking-constants";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

const VIDKING_KEEPALIVE_INTERVAL_MS = VIDKING_PROACTIVE_REFRESH_AFTER_MS;
const MOVI_STALL_TIMEOUT_MS = 180_000;
const MOVI_STALL_POLL_MS = 5_000;

const toIntroDbChapterMarkers = (segments: IntroDbSegment[]): ChapterMarker[] =>
  segments.map((segment) => ({
    title: formatIntroDbSegmentTitle(segment.type),
    start: segment.startSeconds,
    end: segment.endSeconds,
  }));

type MoviScrapePlayerProps = {
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

const resolveAbsolutePlaybackUrl = (playUrl: string): string => {
  if (playUrl.startsWith("http://") || playUrl.startsWith("https://")) {
    return playUrl;
  }
  try {
    return new URL(playUrl, window.location.href).toString();
  } catch {
    return playUrl;
  }
};

export function MoviScrapePlayer({
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
}: MoviScrapePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const [player, setPlayer] = useState<MoviPlayerElement | null>(null);
  const onFatalErrorRef = useRef(onFatalError);
  const onMediaReadyRef = useRef(onMediaReady);
  const onEndedRef = useRef(onEnded);
  const fatalReportedRef = useRef(false);
  const startedRef = useRef(false);
  const readyRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioLang, setAudioLang] = useState(
    defaultAudioLang ?? audioVersions?.[0]?.lang ?? "",
  );
  const [hardSubLang, setHardSubLang] = useState(defaultHardSubLang ?? "off");
  const playbackQuality = useAppSettingsStore((state) => state.playbackQuality);
  const playbackEnglishSubtitles = useAppSettingsStore(
    (state) => state.playbackEnglishSubtitles,
  );
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const resumeTimeRef = useRef(resumeTime);
  resumeTimeRef.current = resumeTime;

  onFatalErrorRef.current = onFatalError;
  onMediaReadyRef.current = onMediaReady;
  onEndedRef.current = onEnded;

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

  const textTracks = useMemo(() => {
    const tracks = buildScrapeSubtitleTracks(activeSubtitles, referer);
    const preferredSubtitleLang = resolvePreferredSubtitleLang(
      trackPreferenceStorageKey(progressKey),
      {
        preferEnglishSubtitles: playbackEnglishSubtitles,
        preferredAudioLang,
      },
    );

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
  }, [
    activeSubtitles,
    playbackEnglishSubtitles,
    preferredAudioLang,
    progressKey,
    referer,
  ]);

  const playerMountKey = activePlaybackUrl;

  useMoviPlaybackTrackPreferences(player, progressKey, playerMountKey, {
    preferEnglishSubtitles: playbackEnglishSubtitles,
    preferredAudioLang,
  });

  const externalQualities = useMemo<ExternalQualityEntry[]>(
    () =>
      qualityOptions.map((option) => ({
        label: option.label,
        url: resolveAbsolutePlaybackUrl(option.playUrl),
      })),
    [qualityOptions],
  );

  const { segments: introDbSegments } = useIntroDbSegments(
    progressKey,
    duration,
    imdbId,
  );

  const chapterMarkers = useMemo(
    () => toIntroDbChapterMarkers(introDbSegments),
    [introDbSegments],
  );

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(() => onMediaReadyRef.current?.(), readyRef)();
  }, []);

  const reportFatal = useCallback(() => {
    if (fatalReportedRef.current) {
      return;
    }
    fatalReportedRef.current = true;
    onFatalErrorRef.current?.();
  }, []);

  const bumpQualityOrFail = useCallback(() => {
    if (
      qualityIndex < qualityOptions.length - 1 &&
      !isAbrOnlyQualityFailover(qualityOptions)
    ) {
      setQualityIndex((index) => index + 1);
      return;
    }
    reportFatal();
  }, [qualityIndex, qualityOptions, reportFatal]);

  const attemptPlaybackStart = useCallback(
    (player: MoviPlayerElement) => {
      if (autoPlay) {
        return;
      }

      const video = getMoviVideoElement(player);
      const isCurrentlyPlaying =
        video instanceof HTMLVideoElement
          ? video.paused === false
          : player.playing === true;
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
      const play = player.play;
      if (typeof play === "function") {
        void play.call(player).then(() => {
          if (!player.paused) {
            startedRef.current = true;
            markMediaReady();
          }
        });
      }
    },
    [autoPlay, markMediaReady],
  );

  useEffect(() => {
    startedRef.current = false;
    readyRef.current = false;
    fatalReportedRef.current = false;
    setDuration(0);
    setCurrentTime(0);
    lastProgressRef.current = Date.now();
  }, [activePlayUrl]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (readyRef.current) {
        return;
      }
      const el = playerRef.current;
      if (el && isMoviPlayerMakingProgress(el)) {
        lastProgressRef.current = Date.now();
        return;
      }
      if (Date.now() - lastProgressRef.current < MOVI_STALL_TIMEOUT_MS) {
        return;
      }
      bumpQualityOrFail();
    }, MOVI_STALL_POLL_MS);

    return () => window.clearInterval(interval);
  }, [activePlayUrl, bumpQualityOrFail]);

  useEffect(() => {
    if (!autoPlay || !activePlayUrl.includes("/transcode/")) {
      return undefined;
    }

    const failTimeout = window.setTimeout(() => {
      if (fatalReportedRef.current || duration > 0) {
        return;
      }
      reportFatal();
    }, PLAYBACK_START_TIMEOUT_MS);

    return () => window.clearTimeout(failTimeout);
  }, [activePlayUrl, autoPlay, duration]);

  useEffect(() => {
    const refresh = extractScrapePlaybackRefreshFromPlayUrl(activePlayUrl);
    if (!refresh) {
      return undefined;
    }

    const keepSessionWarm = () => {
      void fetch(activePlayUrl, {
        method: "GET",
        cache: "no-store",
      }).catch(() => undefined);
    };

    keepSessionWarm();
    const interval = window.setInterval(
      keepSessionWarm,
      VIDKING_KEEPALIVE_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [activePlayUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;
    let startTimer: number | undefined;
    const mountStartAt = hlsStartPosition(resumeTimeRef.current);

    void loadMoviCompat()
      .then(() => {
        if (cancelled || playerRef.current) {
          return;
        }

        const el = document.createElement("movi-player") as MoviPlayerElement;
        playerRef.current = el;
        setPlayer(el);
        el.setAttribute("presentation", "native");
        el.setAttribute("data-movi-harness", "scrape");
        el.className = "nyumat-movi-scrape-player h-full w-full";

        const headers = buildMoviScrapePlaybackHeaders(activePlaybackUrl);
        if (Object.keys(headers).length > 0) {
          el.headers = headers;
        }

        const subtitlePayload = textTracks.map((track) => ({
          id: track.id,
          src: track.src,
          lang: track.lang,
          label: track.label,
          format: track.type,
          default: track.default,
        }));

        clearMoviResumeKeys(title, undefined);
        el.setAttribute("startat", String(mountStartAt));
        el.setAttribute("noerrorscreen", "");
        el.controls = true;
        el.autoplay = true;
        el.muted = false;
        el.volume = 1;
        el.playsinline = true;
        el.theme = "dark";
        el.setAttribute("fastseek", "");
        el.setAttribute("buffersize", "256");
        const posterUrl = resolveMoviPosterUrl(poster);
        if (posterUrl) {
          el.poster = posterUrl;
        }
        if (title) {
          el.setAttribute("title", title);
        }

        if (subtitlePayload.length > 0 && typeof el.source === "function") {
          el.source({
            video: { src: activePlaybackUrl },
            subtitles: subtitlePayload,
          });
        } else {
          el.src = resolveMoviMediaUrl(activePlaybackUrl);
        }

        el.addEventListener("loadeddata", () => {
          const video = getMoviVideoElement(el);
          if (video && isMoviVideoPlaybackReady(video)) {
            markMediaReady();
          }
          const nextDuration = el.duration;
          if (Number.isFinite(nextDuration) && nextDuration > 0) {
            setDuration(nextDuration);
          }
          if (
            !autoPlay &&
            mountStartAt === 0 &&
            video instanceof HTMLVideoElement &&
            video.paused
          ) {
            ensurePlaybackAtStart(video);
          }
          attemptPlaybackStart(el);
        });

        el.addEventListener("playing", () => {
          lastProgressRef.current = Date.now();
          startedRef.current = true;
          if (startTimer !== undefined) {
            window.clearInterval(startTimer);
            startTimer = undefined;
          }
          markMediaReady();
        });

        el.addEventListener("timeupdate", () => {
          lastProgressRef.current = Date.now();
          const nextCurrentTime = el.currentTime;
          if (Number.isFinite(nextCurrentTime) && nextCurrentTime >= 0) {
            setCurrentTime(nextCurrentTime);
          }
          if (Number.isFinite(nextCurrentTime) && nextCurrentTime > 0) {
            markMediaReady();
            persist(nextCurrentTime, el.duration);
          }
        });

        el.addEventListener("statechange", (event: Event) => {
          const state = (event as CustomEvent<string>).detail;
          if (state === "error") {
            bumpQualityOrFail();
          }
        });

        el.addEventListener("playererror", (event: Event) => {
          const detail = (event as CustomEvent<{ severity?: string }>).detail;
          if (detail?.severity === "recoverable") {
            return;
          }
          bumpQualityOrFail();
        });

        el.addEventListener("ended", () => {
          persistImmediate(el.currentTime, el.duration);
          void onEndedRef.current?.();
        });

        container.appendChild(el);
        resetMoviProgressObservation(el);

        applyMoviExternalQualities(el, externalQualities);
        if (chapterMarkers.length > 0) {
          applyMoviChapterMarkers(el, chapterMarkers);
        }

        if (!autoPlay) {
          startTimer = window.setInterval(() => {
            attemptPlaybackStart(el);
          }, 1500);
        }
      })
      .catch(() => {
        reportFatal();
      });

    return () => {
      cancelled = true;
      if (startTimer !== undefined) {
        window.clearInterval(startTimer);
      }
      disposeMoviPlayer(playerRef.current);
      if (playerRef.current) {
        resetMoviProgressObservation(playerRef.current);
      }
      playerRef.current = null;
      setPlayer(null);
    };
  }, [playerMountKey]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el || textTracks.length === 0) {
      return;
    }

    applyMoviExternalSubtitles(
      el,
      textTracks.map((track) => ({
        id: track.id,
        src: track.src,
        lang: track.lang,
        label: track.label,
        format: track.type,
        default: track.default,
      })),
    );
  }, [textTracks]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) {
      return;
    }
    applyMoviExternalQualities(el, externalQualities);
    if (chapterMarkers.length > 0) {
      applyMoviChapterMarkers(el, chapterMarkers);
    }
  }, [chapterMarkers, externalQualities]);

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full", className)}
      data-stream-kind={streamKind ?? "hls"}
    >
      <IntroDbSegmentControl
        segments={introDbSegments}
        currentTime={currentTime}
        duration={duration}
        isTv={progressKey.mediaType === "tv"}
        onSeek={(time) => {
          const player = playerRef.current;
          if (!player) {
            return;
          }
          player.currentTime = time;
          setCurrentTime(time);
        }}
        onAdvanceToNextEpisode={onEnded}
      />
    </div>
  );
}
