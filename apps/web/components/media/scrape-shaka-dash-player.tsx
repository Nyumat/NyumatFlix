"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import { useSubtitleOffsetKeyboardShortcuts } from "@/components/media/controls/scrape-subtitle-offset-controls";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import { useNativeSubtitleOffset } from "@/hooks/use-native-subtitle-offset";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { buildIntroDbChaptersVtt } from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import {
  decidePlaybackAutoStart,
  PLAYBACK_START_TIMEOUT_MS,
} from "@/lib/playback/playbackStart";
import { buildScrapeSubtitleTracks } from "@/lib/scrape/player-sources";
import type { ScrapeSubtitle } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

type ScrapeShakaDashPlayerProps = {
  playUrl: string;
  referer?: string;
  subtitles?: ScrapeSubtitle[];
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

const LOAD_TIMEOUT_MS = PLAYBACK_START_TIMEOUT_MS;

const absolutizeUrl = (url: string): string => {
  if (!url.startsWith("/")) {
    return url;
  }

  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return url;
  }
};

export function ScrapeShakaDashPlayer(props: ScrapeShakaDashPlayerProps) {
  return <ScrapeShakaDashPlayerInstance key={props.playUrl} {...props} />;
}

function ScrapeShakaDashPlayerInstance({
  playUrl,
  referer,
  subtitles,
  title,
  poster,
  progressKey,
  imdbId = null,
  className,
  autoPlay = true,
  onFatalError,
  onMediaReady,
  onEnded,
}: ScrapeShakaDashPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<import("shaka-player").default.Player | null>(null);
  const loadGenerationRef = useRef(0);
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const fatalReportedRef = useRef(false);
  const onMediaReadyRef = useRef(onMediaReady);
  onMediaReadyRef.current = onMediaReady;

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(() => onMediaReadyRef.current?.(), readyRef)();
  }, []);

  const reportFatal = useCallback(() => {
    if (fatalReportedRef.current) {
      return;
    }
    fatalReportedRef.current = true;
    onFatalError?.();
  }, [onFatalError]);

  const attemptPlaybackStart = useCallback(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) {
      return;
    }

    const decision = decidePlaybackAutoStart({
      autoPlay,
      hasStarted: startedRef.current,
      isCurrentlyPlaying: !video.paused && video.currentTime > 0,
    });

    if (decision === "already-playing") {
      startedRef.current = true;
      markMediaReady();
      return;
    }

    if (decision === "skip") {
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
  }, [autoPlay, markMediaReady]);

  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,
    duration: 0,
  });

  const playbackUrl = useMemo(() => absolutizeUrl(playUrl), [playUrl]);

  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);

  const textTracks = useMemo(
    () => buildScrapeSubtitleTracks(subtitles, referer),
    [referer, subtitles],
  );
  const subtitleOffset = useNativeSubtitleOffset(
    videoRef,
    progressKey,
    (subtitles?.length ?? 0) > 0,
  );
  useSubtitleOffsetKeyboardShortcuts({
    offsetSeconds: subtitleOffset.offsetSeconds,
    onOffsetChange: subtitleOffset.setOffsetSeconds,
    visible: subtitleOffset.hasTracks,
  });
  const { segments: introDbSegments } = useIntroDbSegments(
    progressKey,
    playbackState.duration,
    imdbId,
  );
  const introDbChapters = useMemo(
    () => buildIntroDbChaptersVtt(introDbSegments),
    [introDbSegments],
  );
  const introDbChaptersUrl = useMemo(
    () =>
      introDbChapters
        ? `data:text/vtt;charset=utf-8,${encodeURIComponent(introDbChapters)}`
        : null,
    [introDbChapters],
  );

  const destroyPlayer = useCallback(async () => {
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) {
      return;
    }

    try {
      await player.destroy();
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    readyRef.current = false;
    startedRef.current = false;
    fatalReportedRef.current = false;
    const loadGeneration = ++loadGenerationRef.current;
    let cancelled = false;

    const setup = async () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      await destroyPlayer();

      const shaka = (await import("shaka-player")).default;
      if (cancelled || loadGeneration !== loadGenerationRef.current) {
        return;
      }

      shaka.polyfill.installAll();

      if (!shaka.Player.isBrowserSupported()) {
        reportFatal();
        return;
      }

      const player = new shaka.Player(video);
      playerRef.current = player;

      player.addEventListener("error", () => {
        reportFatal();
      });

      try {
        const loadPromise = player.load(playbackUrl);
        let loadTimeoutId: ReturnType<typeof setTimeout> | undefined;
        const loadTimeout = new Promise<never>((_, reject) => {
          loadTimeoutId = setTimeout(
            () => reject(new Error("DASH load timed out")),
            LOAD_TIMEOUT_MS,
          );
        });

        try {
          await Promise.race([loadPromise, loadTimeout]);
        } finally {
          if (loadTimeoutId) {
            clearTimeout(loadTimeoutId);
          }
        }
      } catch {
        try {
          await player.unload();
        } catch {
          void 0;
        }
        if (
          cancelled ||
          loadGeneration !== loadGenerationRef.current ||
          playerRef.current !== player
        ) {
          return;
        }
        reportFatal();
        return;
      }

      if (cancelled || loadGeneration !== loadGenerationRef.current) {
        try {
          await player.unload();
        } catch {
          void 0;
        }
        return;
      }

      attemptPlaybackStart();
    };

    void setup();

    return () => {
      cancelled = true;
      loadGenerationRef.current += 1;
      void destroyPlayer();
    };
  }, [attemptPlaybackStart, destroyPlayer, playbackUrl, reportFatal]);

  useEffect(() => {
    if (!autoPlay) {
      return undefined;
    }

    const tick = () => {
      attemptPlaybackStart();
    };

    tick();
    const interval = window.setInterval(tick, 1500);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, PLAYBACK_START_TIMEOUT_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [attemptPlaybackStart, autoPlay, playbackUrl]);

  useEffect(() => {
    if (!autoPlay) {
      return undefined;
    }

    const failTimeout = window.setTimeout(() => {
      if (fatalReportedRef.current || readyRef.current) {
        return;
      }
      reportFatal();
    }, PLAYBACK_START_TIMEOUT_MS);

    return () => window.clearTimeout(failTimeout);
  }, [autoPlay, playbackUrl, reportFatal]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || resumeTime <= 0) {
      return;
    }

    const apply = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }
      video.currentTime = Math.min(resumeTime, video.duration);
    };

    video.addEventListener("loadedmetadata", apply);
    return () => video.removeEventListener("loadedmetadata", apply);
  }, [resumeTime]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <video
        ref={videoRef}
        className="h-full w-full rounded-lg bg-black"
        controls
        playsInline
        preload="auto"
        poster={poster ?? undefined}
        title={title}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setPlaybackState({
            currentTime: video.currentTime,
            duration: video.duration || 0,
          });
          attemptPlaybackStart();
        }}
        onCanPlay={() => {
          attemptPlaybackStart();
        }}
        onDurationChange={(event) => {
          const video = event.currentTarget;
          setPlaybackState((state) => ({
            ...state,
            duration: state.duration || video.duration || 0,
          }));
        }}
        onPlaying={() => {
          startedRef.current = true;
          markMediaReady();
        }}
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          if (video.currentTime > 0) {
            markMediaReady();
          }
          setPlaybackState((state) => ({
            currentTime: video.currentTime,
            duration: state.duration || video.duration || 0,
          }));
          persist(video.currentTime, video.duration || 0);
        }}
        onEnded={(e) => {
          const video = e.currentTarget;
          persistImmediate(video.currentTime, video.duration || 0);
          void onEnded?.();
        }}
      >
        {textTracks
          .filter((track) => track.type === "vtt")
          .map((track) => (
            <track
              key={track.id}
              src={track.src}
              kind="subtitles"
              label={track.label}
              srcLang={track.lang}
              default={track.default}
            />
          ))}
        {introDbChaptersUrl ? (
          <track
            src={introDbChaptersUrl}
            kind="chapters"
            label="TheIntroDB segments"
            default
          />
        ) : null}
      </video>
      <IntroDbSegmentControl
        segments={introDbSegments}
        currentTime={playbackState.currentTime}
        duration={playbackState.duration}
        isTv={progressKey.mediaType === "tv"}
        onSeek={(time) => {
          const video = videoRef.current;
          if (video) {
            video.currentTime = time;
          }
        }}
        onAdvanceToNextEpisode={onEnded}
      />
    </div>
  );
}
