import { useCallback, useEffect, useRef, useState } from "react";

import {
  readMoviCanCast,
  readMoviPresentationMode,
} from "@/lib/player/movi-host-api";
import type { MoviPlayerElement } from "@/lib/player/player-element";

type UseMoviCastFallbackOptions = {
  fallbackUrl?: string | null;
  enabled?: boolean;
};

export const useMoviCastFallback = ({
  fallbackUrl,
  enabled = true,
}: UseMoviCastFallbackOptions) => {
  const [castFallbackUrl, setCastFallbackUrl] = useState<string | null>(null);
  const [showCastFallback, setShowCastFallback] = useState(false);
  const fallbackUrlRef = useRef(fallbackUrl);
  fallbackUrlRef.current = fallbackUrl;

  useEffect(() => {
    setCastFallbackUrl(null);
    setShowCastFallback(false);
  }, [fallbackUrl]);

  const handleCastFallback = useCallback(() => {
    if (!fallbackUrlRef.current) {
      return;
    }
    setCastFallbackUrl(fallbackUrlRef.current);
    setShowCastFallback(false);
  }, []);

  const handleCanvasCastBlocked = useCallback(
    (player: MoviPlayerElement) => {
      if (!enabled || !fallbackUrlRef.current || castFallbackUrl) {
        return;
      }
      const mode = readMoviPresentationMode(player);
      const canCast = readMoviCanCast(player);
      if (mode === "canvas" && !canCast) {
        setShowCastFallback(true);
      }
    },
    [castFallbackUrl, enabled],
  );

  const bindCastFallbackPlayer = useCallback(
    (container: HTMLElement | null) => {
      if (!container || !enabled) {
        return undefined;
      }

      const inspectPlayer = () => {
        const player = container.querySelector("movi-player");
        if (player instanceof HTMLElement) {
          handleCanvasCastBlocked(player as MoviPlayerElement);
        }
      };

      const onCastFallback = (event: Event) => {
        const detail = (event as CustomEvent<{ src?: string }>).detail;
        if (detail?.src && fallbackUrlRef.current) {
          setShowCastFallback(true);
        }
      };

      const observer = new MutationObserver(inspectPlayer);
      observer.observe(container, { childList: true, subtree: true });
      inspectPlayer();

      container.addEventListener(
        "castfallback",
        onCastFallback as EventListener,
      );

      const player = container.querySelector("movi-player");
      const onCanCastChange = () => {
        if (player instanceof HTMLElement) {
          handleCanvasCastBlocked(player as MoviPlayerElement);
        }
      };
      player?.addEventListener("cancastchange", onCanCastChange);

      return () => {
        observer.disconnect();
        container.removeEventListener(
          "castfallback",
          onCastFallback as EventListener,
        );
        player?.removeEventListener("cancastchange", onCanCastChange);
      };
    },
    [enabled, handleCanvasCastBlocked],
  );

  return {
    castFallbackUrl,
    showCastFallback,
    handleCastFallback,
    handleCanvasCastBlocked,
    bindCastFallbackPlayer,
    dismissCastFallback: () => setShowCastFallback(false),
  };
};
