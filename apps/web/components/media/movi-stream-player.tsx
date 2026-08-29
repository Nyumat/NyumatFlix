"use client";

import { useCallback, useEffect, useRef } from "react";

import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { loadMoviPlayer } from "@/lib/player/load-player";
import {
  applyMoviSource,
  disposeMoviPlayer,
  isMoviWasmError,
  type MoviPlayerElement,
} from "@/lib/player/player-element";
import {
  getMoviVideoElement,
  isMoviPlayerMakingProgress,
  isMoviVideoPlaybackReady,
  resetMoviProgressObservation,
} from "@/lib/player/player-playback-ready";
import { pickMoviTrackPrefs } from "@nyumatflix/playback";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  registerPlaybackProgressFlush,
  unregisterPlaybackProgressFlush,
} from "@/lib/playback/progress-flush";

type MoviStreamPlayerProps = {
  src: string;
  poster?: string | null;
  title?: string;
  preferredAudioLang?: string;
  streamLabel?: string;
  progressKey: PlaybackProgressKey;
  onError: (detail?: { kind?: "error" | "timeout" }) => void;
  onMediaReady?: () => void;
  onBufferingChange?: (buffering: boolean) => void;
  onEnded?: () => Promise<boolean>;
  className?: string;
};

const MOVI_STALL_TIMEOUT_MS = 180_000;
const MOVI_STALL_POLL_MS = 5_000;
const MOVI_TRACK_PREF_DELAY_MS = 1_500;

const applyPreferredMoviTracks = (
  player: MoviPlayerElement,
  preferredAudioLang?: string,
): boolean => {
  const prefs = pickMoviTrackPrefs(
    player.getAudioLangs?.() ?? [],
    player.getSubtitleLangs?.() ?? [],
    preferredAudioLang,
  );
  let applied = false;
  if (prefs.audioLang) {
    applied = player.selectAudioLang?.(prefs.audioLang) ?? false;
  }
  if (prefs.subtitleLang) {
    void player.selectSubtitleLang?.(prefs.subtitleLang);
    applied = true;
  }
  return applied;
};

function MoviStreamPlayerInstance({
  src,
  poster,
  title,
  preferredAudioLang,
  streamLabel,
  progressKey,
  onError,
  onMediaReady,
  onBufferingChange,
  onEnded,
  className,
}: MoviStreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const onErrorRef = useRef(onError);
  const onMediaReadyRef = useRef(onMediaReady);
  const onBufferingChangeRef = useRef(onBufferingChange);
  const onEndedRef = useRef(onEnded);
  const errorReportedRef = useRef(false);
  const resumedRef = useRef(false);
  const readyRef = useRef(false);
  const tracksPreferredRef = useRef(false);
  const lastProgressRef = useRef(Date.now());
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const resumeTimeRef = useRef(resumeTime);
  const persistRef = useRef(persist);
  const persistImmediateRef = useRef(persistImmediate);

  resumeTimeRef.current = resumeTime;
  persistRef.current = persist;
  persistImmediateRef.current = persistImmediate;
  onErrorRef.current = onError;
  onMediaReadyRef.current = onMediaReady;
  onBufferingChangeRef.current = onBufferingChange;
  onEndedRef.current = onEnded;

  const markMediaReady = useCallback(() => {
    const handler = createMediaReadyHandler(() => {
      onBufferingChangeRef.current?.(false);
      onMediaReadyRef.current?.();
    }, readyRef);
    handler();
  }, []);

  const maybePreferEnglishTracks = useCallback(
    (player: MoviPlayerElement) => {
      if (tracksPreferredRef.current) {
        return;
      }
      if (applyPreferredMoviTracks(player, preferredAudioLang)) {
        tracksPreferredRef.current = true;
      }
    },
    [preferredAudioLang],
  );

  useEffect(() => {
    errorReportedRef.current = false;
    resumedRef.current = false;
    readyRef.current = false;
    tracksPreferredRef.current = false;
    lastProgressRef.current = Date.now();
    onBufferingChangeRef.current?.(true);
  }, [src, progressKey]);

  useEffect(() => {
    const reportError = (kind: "error" | "timeout" = "error") => {
      if (errorReportedRef.current) {
        return;
      }
      errorReportedRef.current = true;
      onErrorRef.current({ kind });
    };

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
      reportError("timeout");
    }, MOVI_STALL_POLL_MS);

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message ?? "";
      if (!isMoviWasmError(message)) {
        return;
      }
      reportError();
      event.preventDefault();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      if (!isMoviWasmError(message)) {
        return;
      }
      reportError();
      event.preventDefault();
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [src, progressKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let trackTimer: number | undefined;

    const reportError = () => {
      if (errorReportedRef.current || cancelled) {
        return;
      }
      errorReportedRef.current = true;
      onErrorRef.current({ kind: "error" });
    };

    void loadMoviPlayer()
      .then(() => {
        if (cancelled || playerRef.current) {
          return;
        }

        const el = document.createElement("movi-player") as MoviPlayerElement;
        playerRef.current = el;

        el.addEventListener("error", reportError);
        el.addEventListener("playing", () => {
          lastProgressRef.current = Date.now();
          markMediaReady();
        });
        el.addEventListener("timeupdate", (event: Event) => {
          lastProgressRef.current = Date.now();
          const detail = (event as CustomEvent<number>).detail;
          const currentTime =
            typeof detail === "number" && Number.isFinite(detail)
              ? detail
              : el.currentTime;
          if (!Number.isFinite(currentTime)) {
            return;
          }
          if (currentTime > 0) {
            markMediaReady();
          }
          persistRef.current(currentTime, el.duration);
        });
        el.addEventListener("loadeddata", () => {
          const video = getMoviVideoElement(el);
          if (video && isMoviVideoPlaybackReady(video)) {
            markMediaReady();
          }
          const resumeAt = resumeTimeRef.current;
          if (resumedRef.current || resumeAt <= 0) {
            return;
          }
          const duration = el.duration;
          if (!Number.isFinite(duration) || duration <= 0) {
            return;
          }
          resumedRef.current = true;
          el.currentTime = Math.min(resumeAt, duration);
        });
        el.addEventListener("statechange", (event: Event) => {
          const state = (event as CustomEvent<string>).detail;
          if (state === "buffering") {
            onBufferingChangeRef.current?.(true);
          } else if (state === "playing") {
            onBufferingChangeRef.current?.(false);
          } else if (state === "error") {
            reportError();
          }
        });
        el.addEventListener("ended", () => {
          persistImmediateRef.current(el.currentTime, el.duration);
          void onEndedRef.current?.();
        });

        container.appendChild(el);
        resetMoviProgressObservation(el);
        applyMoviSource(el, src, poster, title, streamLabel);

        trackTimer = window.setTimeout(() => {
          maybePreferEnglishTracks(el);
        }, MOVI_TRACK_PREF_DELAY_MS);
      })
      .catch(reportError);

    return () => {
      cancelled = true;
      if (trackTimer !== undefined) {
        window.clearTimeout(trackTimer);
      }
      disposeMoviPlayer(playerRef.current);
      if (playerRef.current) {
        resetMoviProgressObservation(playerRef.current);
      }
      playerRef.current = null;
    };
  }, [
    src,
    poster,
    title,
    streamLabel,
    markMediaReady,
    maybePreferEnglishTracks,
  ]);

  useEffect(() => {
    const flush = () => {
      const el = playerRef.current;
      if (!el) {
        return;
      }
      persistImmediateRef.current(el.currentTime, el.duration);
    };
    registerPlaybackProgressFlush(flush);
    return () => unregisterPlaybackProgressFlush(flush);
  }, [src, progressKey]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

export function MoviStreamPlayer(props: MoviStreamPlayerProps) {
  return <MoviStreamPlayerInstance key={props.src} {...props} />;
}

export function prefetchMoviPlayer(): void {
  void loadMoviPlayer();
}
