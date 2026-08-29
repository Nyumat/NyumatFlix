"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";

import {
  applySubtitleAppearanceToElement,
  clearSubtitleAppearanceFromElement,
  DEFAULT_SUBTITLE_APPEARANCE,
  mergeSubtitleAppearance,
  type SubtitleAppearance,
} from "@/lib/playback/subtitle-appearance";
import {
  getSubtitleAppearance,
  resetSubtitleAppearance,
  setSubtitleAppearance,
  SUBTITLE_APPEARANCE_CHANGE_EVENT,
} from "@/lib/playback/subtitle-appearance-storage";

export function useSubtitleAppearance(
  playerRef?: RefObject<MediaPlayerInstance | null>,
): {
  appearance: SubtitleAppearance;
  setAppearance: (patch: Partial<SubtitleAppearance>) => void;
  resetAppearance: () => void;
} {
  const [appearance, setAppearanceState] = useState<SubtitleAppearance>(
    DEFAULT_SUBTITLE_APPEARANCE,
  );

  useEffect(() => {
    setAppearanceState(getSubtitleAppearance());

    const handleExternalChange = () => {
      setAppearanceState(getSubtitleAppearance());
    };

    window.addEventListener(
      SUBTITLE_APPEARANCE_CHANGE_EVENT,
      handleExternalChange,
    );
    window.addEventListener("storage", handleExternalChange);

    return () => {
      window.removeEventListener(
        SUBTITLE_APPEARANCE_CHANGE_EVENT,
        handleExternalChange,
      );
      window.removeEventListener("storage", handleExternalChange);
    };
  }, []);

  const applyToPlayer = useCallback(
    (next: SubtitleAppearance) => {
      const player = playerRef?.current;
      if (!player?.el) {
        return;
      }

      applySubtitleAppearanceToElement(player.el, next);
    },
    [playerRef],
  );

  useEffect(() => {
    if (playerRef) {
      applyToPlayer(appearance);
    }
  }, [appearance, applyToPlayer, playerRef]);

  useEffect(() => {
    if (!playerRef) {
      return;
    }

    const player = playerRef.current;
    if (!player) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      applyToPlayer(appearance);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [appearance, applyToPlayer, playerRef]);

  const setAppearance = useCallback((patch: Partial<SubtitleAppearance>) => {
    setAppearanceState((current) => {
      const next = mergeSubtitleAppearance(current, patch);
      setSubtitleAppearance(next);
      return next;
    });
  }, []);

  const resetAppearance = useCallback(() => {
    const next = resetSubtitleAppearance();
    const player = playerRef?.current;
    if (player?.el) {
      clearSubtitleAppearanceFromElement(player.el);
      applySubtitleAppearanceToElement(player.el, next);
    }
    setAppearanceState(next);
  }, [playerRef]);

  return {
    appearance,
    setAppearance,
    resetAppearance,
  };
}
