"use client";

import { HERO_YOUTUBE_CHROMELESS_BASE } from "@/components/hero/youtube-types";
import {
  getYouTubeHoverPreview,
  setYouTubeHoverPreviewPlaying,
  subscribeYouTubeHoverPreview,
  type YouTubeHoverPreviewState,
} from "@/lib/youtube/hover-preview-store";
import {
  loadYouTubeIframeApi,
  type YouTubePlayerInstance,
} from "@/lib/youtube/iframe-api";
import { useEffect, useRef, useState } from "react";

/**
 * Single reused YouTube player that renders the hovered card's trailer. The
 * iframe lives here permanently and is only repositioned/resized to match the
 * active card, so no iframe is ever reparented (which would reload it).
 *
 * Mounted once at the app root (via `CardHoverPreviewProvider`); z-index sits
 * below the card's own controls. The layer stays transparent until the player
 * reports `PLAYING`, so the card's backdrop remains visible while the trailer
 * loads instead of flashing an empty card.
 */
export function YouTubeHoverPreviewLayer() {
  const [active, setActive] = useState<YouTubeHoverPreviewState | null>(() =>
    getYouTubeHoverPreview(),
  );
  const [playerVersion, setPlayerVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => subscribeYouTubeHoverPreview(setActive), []);

  const hasActive = active !== null;

  // Create the shared player on first activation.
  useEffect(() => {
    if (!hasActive || playerRef.current) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const api = await loadYouTubeIframeApi();
      if (cancelled || !api || playerRef.current) {
        return;
      }
      const host = hostRef.current;
      if (!host || !getYouTubeHoverPreview()) {
        return;
      }

      playerRef.current = new api.Player(host, {
        width: "100%",
        height: "100%",
        playerVars: {
          ...HERO_YOUTUBE_CHROMELESS_BASE,
          autoplay: 1,
          mute: 1,
          loop: 1,
        },
        events: {
          onReady: (event) => {
            event.target.mute?.();
            setPlayerVersion((version) => version + 1);
          },
          onStateChange: (event) => {
            const current = getYouTubeHoverPreview();
            if (!current) {
              return;
            }
            // 1 === YT.PlayerState.PLAYING
            setYouTubeHoverPreviewPlaying(current.id, event.data === 1);
          },
          onError: () => {
            /* Leave the backdrop visible when a trailer can't be embedded. */
          },
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasActive]);

  // Drive playback/mute/key changes without reloading the iframe. Depend on
  // the scalar fields so rect updates from scrolling don't restart playback.
  const activeKey = active?.youtubeKey ?? null;
  const activeMuted = active?.muted ?? true;

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !activeKey) {
      return;
    }

    if (loadedKeyRef.current !== activeKey) {
      loadedKeyRef.current = activeKey;
      player.loadVideoById?.(activeKey);
    }

    if (activeMuted) {
      player.mute?.();
    } else {
      player.unMute?.();
    }
    player.playVideo?.();
  }, [activeKey, activeMuted, playerVersion]);

  // Position the layer over the active card's media box.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    if (!active) {
      el.style.opacity = "0";
      el.style.width = "0px";
      el.style.height = "0px";
      playerRef.current?.pauseVideo?.();
      return;
    }

    el.style.transform = `translate3d(${active.rect.left}px, ${active.rect.top}px, 0)`;
    el.style.width = `${active.rect.width}px`;
    el.style.height = `${active.rect.height}px`;
    el.style.opacity = active.playing ? "1" : "0";
  }, [active]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-20 h-0 w-0 overflow-hidden rounded-lg bg-black opacity-0 transition-opacity duration-500 ease-out"
      style={{ willChange: "transform" }}
    >
      <div ref={hostRef} className="size-full" />
    </div>
  );
}
