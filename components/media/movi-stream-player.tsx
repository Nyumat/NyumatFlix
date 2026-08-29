"use client";

import { useCallback, useEffect, useRef } from "react";

import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { loadMoviPlayer } from "@/lib/movi/load-movi-player";
import {
  applyMoviSource,
  disposeMoviPlayer,
  isMoviWasmError,
  type MoviPlayerElement,
} from "@/lib/movi/movi-player-element";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

type MoviStreamPlayerProps = {
  src: string;
  poster?: string | null;
  title?: string;
  progressKey: PlaybackProgressKey;
  onError: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
  className?: string;
};

const ENGLISH_LANG_PATTERN = /\b(en|eng|english)\b/i;

const pickEnglishLang = (
  tracks: Array<{ lang: string; label: string }>,
): string | null => {
  const scored = tracks
    .map((track) => {
      const hay = `${track.lang} ${track.label}`.trim();
      let score = 0;
      if (/\bdub\b/i.test(hay)) {
        score = 3;
      } else if (ENGLISH_LANG_PATTERN.test(hay)) {
        score = 2;
      }
      return { lang: track.lang, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.lang ?? null;
};

const preferEnglishTracks = (player: MoviPlayerElement): boolean => {
  const audioLangs = player.getAudioLangs?.() ?? [];
  const englishAudio = pickEnglishLang(audioLangs);
  if (englishAudio) {
    return player.selectAudioLang?.(englishAudio) ?? false;
  }

  const subtitleLangs = player.getSubtitleLangs?.() ?? [];
  const englishSubtitle = pickEnglishLang(subtitleLangs);
  if (englishSubtitle) {
    void player.selectSubtitleLang?.(englishSubtitle);
    return true;
  }

  return false;
};

function MoviStreamPlayerInstance({
  src,
  poster,
  title,
  progressKey,
  onError,
  onMediaReady,
  onEnded,
  className,
}: MoviStreamPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const onErrorRef = useRef(onError);
  const onMediaReadyRef = useRef(onMediaReady);
  const onEndedRef = useRef(onEnded);
  const errorReportedRef = useRef(false);
  const resumedRef = useRef(false);
  const readyRef = useRef(false);
  const tracksPreferredRef = useRef(false);
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
  onEndedRef.current = onEnded;

  const markMediaReady = useCallback(() => {
    const handler = createMediaReadyHandler(
      () => onMediaReadyRef.current?.(),
      readyRef,
    );
    handler();
  }, []);

  const maybePreferEnglishTracks = useCallback((player: MoviPlayerElement) => {
    if (tracksPreferredRef.current) {
      return;
    }
    if (preferEnglishTracks(player)) {
      tracksPreferredRef.current = true;
    }
  }, []);

  useEffect(() => {
    errorReportedRef.current = false;
    resumedRef.current = false;
    readyRef.current = false;
    tracksPreferredRef.current = false;
  }, [src, progressKey]);

  useEffect(() => {
    const reportError = () => {
      if (errorReportedRef.current) {
        return;
      }
      errorReportedRef.current = true;
      onErrorRef.current();
    };

    const timeout = window.setTimeout(() => {
      const el = playerRef.current;
      if (!el) {
        reportError();
        return;
      }
      const shadowVideo = el.shadowRoot?.querySelector("video");
      const isPlaying =
        shadowVideo instanceof HTMLVideoElement &&
        shadowVideo.readyState >= 2 &&
        !shadowVideo.paused &&
        shadowVideo.currentTime > 0;
      if (!isPlaying) {
        reportError();
      }
    }, 90_000);

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
      window.clearTimeout(timeout);
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

    const reportError = () => {
      if (errorReportedRef.current || cancelled) {
        return;
      }
      errorReportedRef.current = true;
      onErrorRef.current();
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
          maybePreferEnglishTracks(el);
          markMediaReady();
        });
        el.addEventListener("timeupdate", (event: Event) => {
          const detail = (event as CustomEvent<number>).detail;
          const currentTime =
            typeof detail === "number" && Number.isFinite(detail)
              ? detail
              : el.currentTime;
          if (!Number.isFinite(currentTime)) {
            return;
          }
          if (currentTime > 0) {
            maybePreferEnglishTracks(el);
            markMediaReady();
          }
          persistRef.current(currentTime, el.duration);
        });
        el.addEventListener("loadeddata", () => {
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
          if (state === "error") {
            reportError();
          }
        });
        el.addEventListener("ended", () => {
          persistImmediateRef.current(el.currentTime, el.duration);
          void onEndedRef.current?.();
        });

        container.appendChild(el);
        applyMoviSource(el, src, poster, title);
      })
      .catch(reportError);

    return () => {
      cancelled = true;
      disposeMoviPlayer(playerRef.current);
      playerRef.current = null;
    };
  }, [src, poster, title, markMediaReady, maybePreferEnglishTracks]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

export function MoviStreamPlayer(props: MoviStreamPlayerProps) {
  return <MoviStreamPlayerInstance key={props.src} {...props} />;
}

export function prefetchMoviPlayer(): void {
  void loadMoviPlayer();
  void import("@/components/media/movi-stream-player");
}
