"use client";

import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
  type MediaProviderAdapter,
  type PlayerSrc,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

import { MoviStreamPlayer } from "@/components/media/movi-stream-player";
import { useDirectPlaybackOrchestrator } from "@/hooks/use-direct-playback-orchestrator";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import type { EngineErrorKind } from "@/lib/direct/playbackFailure";
import {
  engineSourceUrl,
  isDirectProgressiveTranscodePath,
  type DirectPlaybackEngine,
} from "@/lib/direct/playback";
import { prefetchMoviMediaBytes } from "@/lib/movi/prefetch-movi-media";
import { mergeTranscodeHlsAuthConfig } from "@/lib/direct/transcode-hls-auth";
import { configureScrapeHlsInstance } from "@/lib/scrape/hls-quality";
import type { DirectStream } from "@/lib/direct/types";
import { preferredAudioLangForTranslation } from "@/lib/scrape/anime/audio-preference";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useServerStore } from "@/lib/stores/server-store";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  bindHlsStartPosition,
  decidePlaybackAutoStart,
  ensurePlaybackAtStart,
  HLS_START_AT_ZERO_CONFIG,
  hlsStartPosition,
  isStartPositionDrifted,
  shouldEnforceVidstackStartAtZero,
} from "@/lib/playback/playbackStart";
import {
  registerPlaybackProgressFlush,
  unregisterPlaybackProgressFlush,
} from "@/lib/playback/progress-flush";
import { cn } from "@/lib/utils";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

type CalluspiratesStreamPlayerProps = {
  stream: DirectStream;
  candidates?: DirectStream[];
  title?: string;
  poster?: string | null;
  className?: string;
  progressKey: PlaybackProgressKey;
  onStreamFailed: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
};

const VIDSTACK_START_TIMEOUT_DEFAULT_MS = 30_000;
const VIDSTACK_HLS_TRANSCODE_START_TIMEOUT_MS = 180_000;
const VIDSTACK_PROGRESSIVE_START_TIMEOUT_MS = 300_000;

type EngineErrorDetail = {
  kind: EngineErrorKind;
};

function isTranscodeHlsPath(sourceUrl: string): boolean {
  return sourceUrl.includes("/transcode/");
}

function vidstackStartTimeoutMs(
  engine: Extract<DirectPlaybackEngine, "vidstack-hls" | "vidstack-direct">,
  sourceUrl: string,
): number {
  if (engine === "vidstack-hls" && isTranscodeHlsPath(sourceUrl)) {
    return VIDSTACK_HLS_TRANSCODE_START_TIMEOUT_MS;
  }
  if (
    engine === "vidstack-direct" &&
    isDirectProgressiveTranscodePath(sourceUrl)
  ) {
    return VIDSTACK_PROGRESSIVE_START_TIMEOUT_MS;
  }
  return VIDSTACK_START_TIMEOUT_DEFAULT_MS;
}

function VidstackDirectPlayer({
  stream,
  engine,
  title,
  poster,
  progressKey,
  onError,
  onMediaReady,
  onEnded,
}: {
  stream: DirectStream;
  engine: Extract<DirectPlaybackEngine, "vidstack-hls" | "vidstack-direct">;
  title?: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  onError: (detail: EngineErrorDetail) => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
}) {
  const [layoutReady, setLayoutReady] = useState(false);
  const playerRef = useRef<MediaPlayerInstance>(null);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const readyRef = useRef(false);
  const resumedRef = useRef(false);
  const hlsCleanupRef = useRef<(() => void) | null>(null);
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const persistRef = useRef(persist);
  const persistImmediateRef = useRef(persistImmediate);
  persistRef.current = persist;
  persistImmediateRef.current = persistImmediate;
  const sourceUrl = engineSourceUrl(stream, engine);
  const startTimeoutMs = vidstackStartTimeoutMs(engine, sourceUrl);
  const startAt = hlsStartPosition(resumeTime);
  const enforceStartAtZero = shouldEnforceVidstackStartAtZero(
    engine,
    sourceUrl,
    resumeTime,
  );

  const getVideoElement = useCallback((): HTMLVideoElement | null => {
    const player = playerRef.current;
    const providerVideo =
      player?.provider && "video" in player.provider
        ? player.provider.video
        : null;
    if (providerVideo instanceof HTMLVideoElement) {
      return providerVideo;
    }
    const fallback = document.querySelector(
      ".nyumat-direct-stream-player video",
    );
    return fallback instanceof HTMLVideoElement ? fallback : null;
  }, []);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(onMediaReady, readyRef)();
  }, [onMediaReady]);

  const markPlaybackReady = useCallback(() => {
    if (settledRef.current) {
      return;
    }
    settledRef.current = true;
    markMediaReady();
  }, [markMediaReady]);

  const applyResumePosition = useCallback(() => {
    const player = playerRef.current;
    if (!player || resumedRef.current || startAt <= 0) {
      return;
    }
    const duration = player.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      return;
    }
    resumedRef.current = true;
    player.currentTime = Math.min(startAt, duration);
  }, [startAt]);

  const attemptPlaybackStart = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    applyResumePosition();
    const video = getVideoElement();
    const isCurrentlyPlaying =
      video instanceof HTMLVideoElement
        ? video.paused === false
        : player.paused === false;
    const decision = decidePlaybackAutoStart({
      autoPlay: true,
      hasStarted: startedRef.current,
      isCurrentlyPlaying,
    });

    if (decision === "already-playing") {
      if (enforceStartAtZero && !settledRef.current && video) {
        ensurePlaybackAtStart(video);
      }
      startedRef.current = true;
      markPlaybackReady();
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
      if (video.readyState >= 2) {
        void video
          .play()
          .then(() => {
            if (!video.paused) {
              startedRef.current = true;
              markPlaybackReady();
            }
          })
          .catch(() => undefined);
      }
      return;
    }

    void player
      .play()
      .then(() => {
        if (!player.paused) {
          startedRef.current = true;
          markPlaybackReady();
        }
      })
      .catch(() => undefined);
  }, [
    applyResumePosition,
    enforceStartAtZero,
    getVideoElement,
    markPlaybackReady,
  ]);

  const handleCanPlay = useCallback(() => {
    attemptPlaybackStart();
    const video = getVideoElement();
    if (video instanceof HTMLVideoElement && video.readyState >= 2) {
      markPlaybackReady();
    }
  }, [attemptPlaybackStart, getVideoElement, markPlaybackReady]);

  useEffect(() => {
    startedRef.current = false;
    settledRef.current = false;
    readyRef.current = false;
    hlsCleanupRef.current?.();
    hlsCleanupRef.current = null;
    resumedRef.current = false;
  }, [engine, sourceUrl]);

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;

      if (!isHLSProvider(provider)) return;

      const transcodeHls = isTranscodeHlsPath(sourceUrl);
      provider.config = mergeTranscodeHlsAuthConfig(sourceUrl, {
        ...HLS_START_AT_ZERO_CONFIG,
        startPosition: startAt,
        manifestLoadingMaxRetry: transcodeHls ? 3 : 1,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: transcodeHls ? 3 : 1,
        levelLoadingRetryDelay: 500,
        fragLoadingMaxRetry: transcodeHls ? 4 : 2,
        fragLoadingRetryDelay: transcodeHls ? 2000 : 500,
        fragLoadingTimeOut: transcodeHls ? 120_000 : 20_000,
      });

      provider.onInstance((hls) => {
        configureScrapeHlsInstance(hls);
        const startPositionCleanup = bindHlsStartPosition(
          hls,
          getVideoElement,
          startAt,
        );
        const onHlsError = (_event: string, data: { fatal?: boolean }) => {
          if (transcodeHls && data.fatal) {
            onError({ kind: "error" });
          }
        };
        if (transcodeHls) {
          hls.on(Hls.Events.ERROR, onHlsError);
        }
        hlsCleanupRef.current = () => {
          startPositionCleanup();
          if (transcodeHls) {
            hls.off(Hls.Events.ERROR, onHlsError);
          }
        };
      });
    },
    [getVideoElement, onError, sourceUrl, startAt],
  );

  useEffect(
    () => () => {
      hlsCleanupRef.current?.();
      hlsCleanupRef.current = null;
    },
    [engine, sourceUrl],
  );

  useEffect(() => {
    const tick = () => {
      attemptPlaybackStart();
    };

    tick();
    const interval = window.setInterval(tick, 800);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 180_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [engine, sourceUrl, attemptPlaybackStart]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!settledRef.current) {
        onError({ kind: "timeout" });
      }
    }, startTimeoutMs);

    return () => window.clearTimeout(timeout);
  }, [engine, sourceUrl, onError, startTimeoutMs]);

  useEffect(() => {
    const persistNow = () => {
      const player = playerRef.current;
      if (!player || !settledRef.current) {
        return;
      }
      persistImmediateRef.current(player.currentTime, player.duration);
    };
    window.addEventListener("pagehide", persistNow);
    registerPlaybackProgressFlush(persistNow);
    return () => {
      window.removeEventListener("pagehide", persistNow);
      unregisterPlaybackProgressFlush(persistNow);
      persistNow();
    };
  }, [engine, sourceUrl]);

  const src: PlayerSrc =
    engine === "vidstack-hls"
      ? { src: sourceUrl, type: "application/x-mpegurl" }
      : stream.mime
        ? ({ src: sourceUrl, type: stream.mime } as PlayerSrc)
        : sourceUrl;

  return (
    <MediaPlayer
      key={`${engine}:${sourceUrl}`}
      ref={playerRef}
      className="nyumat-direct-stream-player h-full w-full"
      title={title ?? stream.name}
      src={src}
      poster={poster ?? undefined}
      playsInline
      autoPlay
      muted={false}
      volume={1}
      streamType="on-demand"
      load="eager"
      logLevel="silent"
      crossOrigin="anonymous"
      onProviderChange={handleProviderChange}
      onCanPlay={handleCanPlay}
      onLoadedData={attemptPlaybackStart}
      onPlaying={() => {
        startedRef.current = true;
        markPlaybackReady();
      }}
      onPause={() => {
        const player = playerRef.current;
        if (!player || !settledRef.current) {
          return;
        }
        persistImmediateRef.current(player.currentTime, player.duration);
      }}
      onEnded={() => {
        const player = playerRef.current;
        if (player) {
          persistImmediateRef.current(player.currentTime, player.duration);
        }
        void onEnded?.();
      }}
      onTimeUpdate={(detail) => {
        if (
          enforceStartAtZero &&
          !settledRef.current &&
          isStartPositionDrifted(detail.currentTime)
        ) {
          const video = getVideoElement();
          if (video) ensurePlaybackAtStart(video);
          return;
        }
        const player = playerRef.current;
        if (player && settledRef.current) {
          persistRef.current(detail.currentTime, player.duration);
        }
      }}
      onError={() => {
        if (engine === "vidstack-hls" && isTranscodeHlsPath(sourceUrl)) {
          return;
        }
        onError({ kind: "error" });
      }}
    >
      <MediaProvider />
      {layoutReady ? <DefaultVideoLayout icons={defaultLayoutIcons} /> : null}
    </MediaPlayer>
  );
}

function CalluspiratesStreamPlayerInstance({
  stream,
  candidates,
  title,
  poster,
  className,
  progressKey,
  onStreamFailed,
  onMediaReady,
  onEnded,
}: CalluspiratesStreamPlayerProps) {
  const isAnimeEpisode = useEpisodeStore((state) => state.isAnimeEpisode);
  const animePreference = useServerStore((state) => state.animePreference);
  const preferredAudioLang = isAnimeEpisode
    ? preferredAudioLangForTranslation(animePreference)
    : undefined;
  const onStreamFailedRef = useRef(onStreamFailed);
  onStreamFailedRef.current = onStreamFailed;

  const {
    activeStream,
    engine,
    failed,
    buffering,
    statusNote,
    playbackAttempt,
    handleEngineReady,
    handleEngineError,
  } = useDirectPlaybackOrchestrator({
    stream,
    candidates,
    onReady: () => onMediaReady?.(),
    onExhausted: () => onStreamFailedRef.current(),
  });

  const [moviBuffering, setMoviBuffering] = useState(true);

  const sourceUrl = engine
    ? engineSourceUrl(activeStream, engine)
    : activeStream.url;

  useEffect(() => {
    setMoviBuffering(buffering);
  }, [buffering, engine, sourceUrl]);

  const showStartingOverlay = engine === "movi" ? moviBuffering : buffering;

  if (failed || !engine) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Trying next stream...
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full min-h-0", className)}>
      {showStartingOverlay || statusNote ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 px-6"
          role="status"
          aria-live="polite"
          aria-label={statusNote ?? "Loading stream"}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
          {statusNote ? (
            <p className="max-w-md text-center text-sm text-white/70">
              {statusNote}
            </p>
          ) : null}
        </div>
      ) : null}
      {engine === "movi" ? (
        <MoviStreamPlayer
          key={`movi:${sourceUrl}:${playbackAttempt}`}
          src={sourceUrl}
          poster={poster}
          title={title ?? activeStream.name}
          preferredAudioLang={preferredAudioLang}
          streamLabel={activeStream.name}
          progressKey={progressKey}
          onError={handleEngineError}
          onMediaReady={handleEngineReady}
          onBufferingChange={setMoviBuffering}
          onEnded={onEnded}
          className="h-full w-full"
        />
      ) : (
        <VidstackDirectPlayer
          key={`vidstack:${engine}:${sourceUrl}:${playbackAttempt}`}
          stream={activeStream}
          engine={engine}
          title={title}
          poster={poster}
          progressKey={progressKey}
          onError={handleEngineError}
          onMediaReady={handleEngineReady}
          onEnded={onEnded}
        />
      )}
    </div>
  );
}

export function CalluspiratesStreamPlayer(
  props: CalluspiratesStreamPlayerProps,
) {
  return (
    <CalluspiratesStreamPlayerInstance
      key={`${props.stream.hash}:${props.stream.url}`}
      {...props}
    />
  );
}
