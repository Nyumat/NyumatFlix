"use client";

import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type RefObject,
} from "react";
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
  subscribeSubtitleAppearance,
} from "@/lib/playback/subtitle-appearance-storage";

export function useSubtitleAppearance(
  playerRef?: RefObject<MediaPlayerInstance | null>,
): {
  appearance: SubtitleAppearance;
  setAppearance: (patch: Partial<SubtitleAppearance>) => void;
  resetAppearance: () => void;
} {
  const appearance = useSyncExternalStore(
    subscribeSubtitleAppearance,
    getSubtitleAppearance,
    () => DEFAULT_SUBTITLE_APPEARANCE,
  );

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
      const frame = requestAnimationFrame(() => applyToPlayer(appearance));
      return () => cancelAnimationFrame(frame);
    }
  }, [appearance, applyToPlayer, playerRef]);

  const setAppearance = useCallback((patch: Partial<SubtitleAppearance>) => {
    const current = getSubtitleAppearance();
    setSubtitleAppearance(mergeSubtitleAppearance(current, patch));
  }, []);

  const resetAppearance = useCallback(() => {
    const next = resetSubtitleAppearance();
    const player = playerRef?.current;
    if (player?.el) {
      clearSubtitleAppearanceFromElement(player.el);
      applySubtitleAppearanceToElement(player.el, next);
    }
  }, [playerRef]);

  return {
    appearance,
    setAppearance,
    resetAppearance,
  };
}
