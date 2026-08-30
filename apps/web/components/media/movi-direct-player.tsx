"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";

import { MoviStreamPlayer } from "@/components/media/movi-stream-player";
import { useDirectPlaybackOrchestrator } from "@/hooks/use-direct-playback-orchestrator";
import { useMoviPlaybackTrackPreferences } from "@/hooks/use-movi-playback-track-preferences";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import type { EngineErrorKind } from "@/lib/direct/playbackFailure";
import { loadMoviCompat, loadMoviFull } from "@/lib/player/load-player";
import {
  readMoviCanCast,
  readMoviPresentationMode,
} from "@/lib/player/movi-host-api";
import { buildMoviScrapePlaybackHeaders } from "@/lib/player/movi-scrape-headers";
import {
  applyMoviSource,
  disposeMoviPlayer,
  type MoviPlayerElement,
} from "@/lib/player/player-element";
import {
  getMoviVideoElement,
  isMoviPlayerMakingProgress,
  isMoviVideoPlaybackReady,
  resetMoviProgressObservation,
} from "@/lib/player/player-playback-ready";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  registerPlaybackProgressFlush,
  unregisterPlaybackProgressFlush,
} from "@/lib/playback/progress-flush";
import {
  decidePlaybackAutoStart,
  hlsStartPosition,
} from "@/lib/playback/playbackStart";
import { preferredAudioLangForTranslation } from "@/lib/scrape/anime/audio-preference";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useServerStore } from "@/lib/stores/server-store";
import {
  engineSourceUrl,
  type DirectPlaybackEngine,
  type DirectStream,
} from "@nyumatflix/playback";
import { cn } from "@/lib/utils";

type MoviDirectPlayerProps = {
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

type EngineErrorDetail = {
  kind: EngineErrorKind;
};

const MOVI_STALL_TIMEOUT_MS = 180_000;
const MOVI_STALL_POLL_MS = 5_000;

function MoviNativeHlsPlayer({
  stream,
  sourceUrl,
  title,
  poster,
  progressKey,
  onError,
  onMediaReady,
  onEnded,
  className,
  preferredAudioLang,
  preferEnglishSubtitles,
}: {
  stream: DirectStream;
  sourceUrl: string;
  title?: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  onError: (detail: EngineErrorDetail) => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
  className?: string;
  preferredAudioLang?: string;
  preferEnglishSubtitles?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const [player, setPlayer] = useState<MoviPlayerElement | null>(null);
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const resumedRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const startAt = hlsStartPosition(resumeTime);

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(onMediaReady, readyRef)();
  }, [onMediaReady]);

  useMoviPlaybackTrackPreferences(player, progressKey, sourceUrl, {
    preferredAudioLang,
    preferEnglishSubtitles,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;
    let stallTimer: number | undefined;

    void loadMoviCompat()
      .then(() => {
        if (cancelled || playerRef.current) {
          return;
        }

        const el = document.createElement("movi-player") as MoviPlayerElement;
        playerRef.current = el;
        setPlayer(el);
        el.setAttribute("presentation", "native");
        el.setAttribute("data-movi-harness", "direct-hls");
        el.className = "nyumat-movi-direct-hls h-full w-full";

        const headers = buildMoviScrapePlaybackHeaders(sourceUrl);
        if (Object.keys(headers).length > 0) {
          el.headers = headers;
        }

        applyMoviSource(el, sourceUrl, poster, title ?? stream.name);

        const attemptStart = () => {
          const video = getMoviVideoElement(el);
          const isCurrentlyPlaying =
            video instanceof HTMLVideoElement
              ? video.paused === false
              : el.playing === true;
          const decision = decidePlaybackAutoStart({
            autoPlay: true,
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
          void el.play?.().then(() => {
            if (!el.paused) {
              startedRef.current = true;
              markMediaReady();
            }
          });
        };

        el.addEventListener("loadeddata", () => {
          const video = getMoviVideoElement(el);
          if (video && isMoviVideoPlaybackReady(video)) {
            markMediaReady();
          }
          if (!resumedRef.current && startAt > 0) {
            const duration = el.duration;
            if (Number.isFinite(duration) && duration > 0) {
              resumedRef.current = true;
              el.currentTime = Math.min(startAt, duration);
            }
          }
          attemptStart();
        });

        el.addEventListener("playing", () => {
          lastProgressRef.current = Date.now();
          startedRef.current = true;
          markMediaReady();
        });

        el.addEventListener("timeupdate", () => {
          lastProgressRef.current = Date.now();
          if (Number.isFinite(el.currentTime) && el.currentTime > 0) {
            markMediaReady();
            persist(el.currentTime, el.duration);
          }
        });

        el.addEventListener("statechange", (event: Event) => {
          const state = (event as CustomEvent<string>).detail;
          if (state === "error") {
            onError({ kind: "error" });
          }
        });

        el.addEventListener("ended", () => {
          persistImmediate(el.currentTime, el.duration);
          void onEnded?.();
        });

        container.appendChild(el);
        resetMoviProgressObservation(el);

        stallTimer = window.setInterval(() => {
          if (readyRef.current) {
            return;
          }
          if (isMoviPlayerMakingProgress(el)) {
            lastProgressRef.current = Date.now();
            return;
          }
          if (Date.now() - lastProgressRef.current >= MOVI_STALL_TIMEOUT_MS) {
            onError({ kind: "timeout" });
          }
        }, MOVI_STALL_POLL_MS);
      })
      .catch(() => {
        onError({ kind: "error" });
      });

    return () => {
      cancelled = true;
      if (stallTimer !== undefined) {
        window.clearInterval(stallTimer);
      }
      disposeMoviPlayer(playerRef.current);
      if (playerRef.current) {
        resetMoviProgressObservation(playerRef.current);
      }
      playerRef.current = null;
      setPlayer(null);
    };
  }, [
    markMediaReady,
    onEnded,
    onError,
    persist,
    persistImmediate,
    poster,
    sourceUrl,
    startAt,
    stream.name,
    title,
  ]);

  useEffect(() => {
    const flush = () => {
      const el = playerRef.current;
      if (!el) {
        return;
      }
      persistImmediate(el.currentTime, el.duration);
    };
    registerPlaybackProgressFlush(flush);
    return () => unregisterPlaybackProgressFlush(flush);
  }, [persistImmediate, sourceUrl]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

function MoviDirectPlayerInstance({
  stream,
  candidates,
  title,
  poster,
  className,
  progressKey,
  onStreamFailed,
  onMediaReady,
  onEnded,
}: MoviDirectPlayerProps) {
  const isAnimeEpisode = useEpisodeStore((state) => state.isAnimeEpisode);
  const animePreference = useServerStore((state) => state.animePreference);
  const preferredAudioLang = isAnimeEpisode
    ? preferredAudioLangForTranslation(animePreference)
    : undefined;
  const playbackEnglishSubtitles = useAppSettingsStore(
    (state) => state.playbackEnglishSubtitles,
  );
  const onStreamFailedRef = useRef(onStreamFailed);
  onStreamFailedRef.current = onStreamFailed;

  const [castFallbackUrl, setCastFallbackUrl] = useState<string | null>(null);
  const [showCastFallback, setShowCastFallback] = useState(false);

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
  const effectiveSourceUrl = castFallbackUrl ?? sourceUrl;
  const effectiveEngine: DirectPlaybackEngine | null = castFallbackUrl
    ? "vidstack-hls"
    : engine;

  useEffect(() => {
    setCastFallbackUrl(null);
    setShowCastFallback(false);
  }, [activeStream.hash, sourceUrl, playbackAttempt]);

  const handleCastFallback = useCallback(() => {
    if (!activeStream.fallbackUrl) {
      return;
    }
    setCastFallbackUrl(activeStream.fallbackUrl);
    setShowCastFallback(false);
  }, [activeStream.fallbackUrl]);

  const handleCanvasCastBlocked = useCallback(
    (player: MoviPlayerElement) => {
      const mode = readMoviPresentationMode(player);
      const canCast = readMoviCanCast(player);
      if (
        mode === "canvas" &&
        !canCast &&
        activeStream.fallbackUrl &&
        !castFallbackUrl
      ) {
        setShowCastFallback(true);
      }
    },
    [activeStream.fallbackUrl, castFallbackUrl],
  );

  const showStartingOverlay =
    effectiveEngine === "movi" ? moviBuffering : buffering;

  if (failed || !effectiveEngine) {
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

      {showCastFallback ? (
        <div className="absolute right-3 top-3 z-20">
          <button
            type="button"
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-white/20"
            onClick={handleCastFallback}
          >
            Cast via transcode
          </button>
        </div>
      ) : null}

      {effectiveEngine === "movi" ? (
        <MoviStreamPlayerWithCastPolicy
          key={`movi:${effectiveSourceUrl}:${playbackAttempt}`}
          src={effectiveSourceUrl}
          poster={poster}
          title={title ?? activeStream.name}
          preferredAudioLang={preferredAudioLang}
          streamLabel={activeStream.name}
          progressKey={progressKey}
          fallbackUrl={activeStream.fallbackUrl}
          onCanvasCastBlocked={handleCanvasCastBlocked}
          onError={handleEngineError}
          onMediaReady={handleEngineReady}
          onBufferingChange={setMoviBuffering}
          onEnded={onEnded}
          className="h-full w-full"
        />
      ) : (
        <MoviNativeHlsPlayer
          key={`movi-native:${effectiveSourceUrl}:${playbackAttempt}`}
          stream={activeStream}
          sourceUrl={effectiveSourceUrl}
          title={title}
          poster={poster}
          progressKey={progressKey}
          preferredAudioLang={preferredAudioLang}
          preferEnglishSubtitles={playbackEnglishSubtitles}
          onError={handleEngineError}
          onMediaReady={handleEngineReady}
          onEnded={onEnded}
          className="h-full w-full"
        />
      )}
    </div>
  );
}

function MoviStreamPlayerWithCastPolicy({
  fallbackUrl,
  onCanvasCastBlocked,
  ...props
}: ComponentProps<typeof MoviStreamPlayer> & {
  fallbackUrl?: string;
  onCanvasCastBlocked?: (player: MoviPlayerElement) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadMoviFull();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const observer = new MutationObserver(() => {
      const player = container.querySelector("movi-player");
      if (player instanceof HTMLElement) {
        onCanvasCastBlocked?.(player as MoviPlayerElement);
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    const player = container.querySelector("movi-player");
    if (player instanceof HTMLElement) {
      const onCanCastChange = () => {
        onCanvasCastBlocked?.(player as MoviPlayerElement);
      };
      player.addEventListener("cancastchange", onCanCastChange);
      onCanvasCastBlocked?.(player as MoviPlayerElement);
      return () => {
        observer.disconnect();
        player.removeEventListener("cancastchange", onCanCastChange);
      };
    }

    return () => observer.disconnect();
  }, [fallbackUrl, onCanvasCastBlocked, props.src]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <MoviStreamPlayer {...props} />
    </div>
  );
}

export function MoviDirectPlayer(props: MoviDirectPlayerProps) {
  return (
    <MoviDirectPlayerInstance
      key={`${props.stream.hash}:${props.stream.url}`}
      {...props}
    />
  );
}
