"use client";

import { useEffect, useRef } from "react";

import { loadMoviPlayer } from "@/lib/movi/load-movi-player";
import {
  applyMoviSource,
  disposeMoviPlayer,
  isMoviWasmError,
  type MoviPlayerElement,
} from "@/lib/movi/movi-player-element";

interface CalluspiratesMoviPlayerProps {
  src: string;
  poster?: string | null;
  title?: string;
  onError: () => void;
  className?: string;
}

/**
 * One movi-player instance per stream. Parent should pass key={src} so React
 * remounts on stream change instead of chaining Effects to re-apply src.
 */
function CalluspiratesMoviPlayerInstance({
  src,
  poster,
  title,
  onError,
  className,
}: CalluspiratesMoviPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const reportError = () => {
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
        shadowVideo.currentTime > 1;
      const duration = el.duration;
      if (!isPlaying && (!Number.isFinite(duration) || duration <= 0)) {
        reportError();
      }
    }, 25_000);

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
  }, [src]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;

    const reportError = () => {
      if (!cancelled) {
        onErrorRef.current();
      }
    };

    void loadMoviPlayer()
      .then(() => {
        if (cancelled) {
          return;
        }

        const el = document.createElement("movi-player") as MoviPlayerElement;
        playerRef.current = el;

        el.addEventListener("error", reportError);
        container.appendChild(el);
        applyMoviSource(el, src, poster, title);
      })
      .catch(reportError);

    return () => {
      cancelled = true;
      disposeMoviPlayer(playerRef.current);
      playerRef.current = null;
    };
  }, [src, poster, title]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

/** 1:1 with calluspirates/web/src/components/MoviStreamPlayer.tsx */
export function CalluspiratesMoviPlayer(props: CalluspiratesMoviPlayerProps) {
  return <CalluspiratesMoviPlayerInstance key={props.src} {...props} />;
}
