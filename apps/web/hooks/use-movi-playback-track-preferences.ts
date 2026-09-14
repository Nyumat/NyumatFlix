"use client";

import { useEffect, useMemo, useRef } from "react";

import {
  applyMoviSubtitlePreference,
  readActiveMoviSubtitlePreference,
  resolvePreferredSubtitleLang,
} from "@/lib/playback/movi-subtitle-preference";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  getTrackPreferences,
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
  // Destructure options so the effect below depends on stable primitives —
  // the engine passes a fresh object literal every render, which used to
  // resubscribe listeners + reschedule the 0/250/1000/2500ms apply timers
  // on every parent render (timeupdate → setCurrentTime → rerender).
  const { preferEnglishSubtitles, preferredAudioLang } = options ?? {};
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

      const stored = getTrackPreferences(scopeKey)?.subtitleLang;
      if (stored === "off") {
        appliedForSourceRef.current = sourceKey;
        return;
      }

      const preferred = resolvePreferredSubtitleLang(scopeKey, {
        preferEnglishSubtitles,
        preferredAudioLang,
      });
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
      if (disposed) {
        return;
      }

      const subtitleLang = readActiveMoviSubtitlePreference(player);
      updateTrackPreferences(scopeKey, { subtitleLang });

      if (subtitleLang === "off") {
        clearTimers();
        appliedForSourceRef.current = sourceKey;
      }
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
  }, [preferEnglishSubtitles, preferredAudioLang, player, scopeKey, sourceKey]);
}
