"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  applyMoviSubtitlePreference,
  readActiveMoviSubtitlePreference,
  resolvePreferredSubtitleLang,
} from "@/lib/playback/movi-subtitle-preference";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  trackPreferenceStorageKey,
  updateTrackPreferences,
} from "@/lib/playback/track-preferences-storage";
import type { MoviPlayerElement } from "@/lib/player/player-element";

const MOVI_SUBTITLE_APPLY_DELAYS_MS = [0, 250, 1000, 2500] as const;

export function useMoviPlaybackTrackPreferences(
  player: MoviPlayerElement | null,
  progressKey: PlaybackProgressKey,
  sourceKey: string,
  options?: {
    preferEnglishSubtitles?: boolean;
    preferredAudioLang?: string | null;
  },
): void {
  const scopeKey = useMemo(
    () => trackPreferenceStorageKey(progressKey),
    [progressKey.contentId, progressKey.mediaType],
  );
  const applyingRef = useRef(false);
  const appliedForSourceRef = useRef<string | null>(null);

  useEffect(() => {
    appliedForSourceRef.current = null;
  }, [sourceKey]);

  useEffect(() => {
    if (!player) {
      return;
    }

    let disposed = false;
    const timers: number[] = [];

    const clearTimers = () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      timers.length = 0;
    };

    const scheduleApply = () => {
      clearTimers();
      for (const delay of MOVI_SUBTITLE_APPLY_DELAYS_MS) {
        const timer = window.setTimeout(() => {
          void tryApply();
        }, delay);
        timers.push(timer);
      }
    };

    const tryApply = async () => {
      if (disposed || applyingRef.current) {
        return;
      }

      const preferred = resolvePreferredSubtitleLang(scopeKey, options);
      if (!preferred || preferred === "off") {
        return;
      }

      const hasTracks =
        (player.getSubtitleLangs?.().length ?? 0) > 0 ||
        (player.getSubtitleTracks?.().length ?? 0) > 0;
      if (!hasTracks) {
        return;
      }

      applyingRef.current = true;
      try {
        const applied = await applyMoviSubtitlePreference(player, preferred);
        if (applied) {
          appliedForSourceRef.current = sourceKey;
        }
      } finally {
        applyingRef.current = false;
      }
    };

    const persistSubtitlePreference = () => {
      if (disposed || applyingRef.current) {
        return;
      }

      updateTrackPreferences(scopeKey, {
        subtitleLang: readActiveMoviSubtitlePreference(player),
      });
    };

    const handleTracksChange = () => {
      if (appliedForSourceRef.current === sourceKey) {
        return;
      }
      scheduleApply();
    };

    player.addEventListener("trackschange", handleTracksChange);
    player.addEventListener("loadeddata", handleTracksChange);
    player.addEventListener("subtitletrackchange", persistSubtitlePreference);

    scheduleApply();

    return () => {
      disposed = true;
      clearTimers();
      player.removeEventListener("trackschange", handleTracksChange);
      player.removeEventListener("loadeddata", handleTracksChange);
      player.removeEventListener(
        "subtitletrackchange",
        persistSubtitlePreference,
      );
    };
  }, [
    options?.preferEnglishSubtitles,
    options?.preferredAudioLang,
    player,
    scopeKey,
    sourceKey,
  ]);
}
