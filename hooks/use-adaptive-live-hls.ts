"use client";

import type { ErrorData } from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildLiveHlsConfig,
  HOLE_ERROR_WINDOW_MS,
  MIN_TOGGLE_INTERVAL_MS,
  shouldDisableLowLatency,
  STABLE_PLAYBACK_MS,
} from "@/lib/live/adaptive-hls";

type AdaptiveLiveHlsState = {
  hlsConfig: ReturnType<typeof buildLiveHlsConfig>;
  playerKey: string;
  onHlsError: (detail: ErrorData) => void;
  onPlaying: () => void;
};

export const useAdaptiveLiveHls = (
  playUrl: string | null,
): AdaptiveLiveHlsState => {
  const [lowLatencyMode, setLowLatencyMode] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [lowLatencyBlocked, setLowLatencyBlocked] = useState(false);

  const degradingErrorsRef = useRef<number[]>([]);
  const lastToggleAtRef = useRef(0);
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedLowLatencyRef = useRef(false);
  const playUrlRef = useRef(playUrl);
  const lowLatencyModeRef = useRef(lowLatencyMode);
  const lowLatencyBlockedRef = useRef(lowLatencyBlocked);

  useEffect(() => {
    lowLatencyModeRef.current = lowLatencyMode;
  }, [lowLatencyMode]);

  useEffect(() => {
    lowLatencyBlockedRef.current = lowLatencyBlocked;
  }, [lowLatencyBlocked]);

  useEffect(() => {
    playUrlRef.current = playUrl;
    setLowLatencyMode(true);
    setLowLatencyBlocked(false);
    setReloadNonce(0);
    degradingErrorsRef.current = [];
    lastToggleAtRef.current = 0;
    retriedLowLatencyRef.current = false;

    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
  }, [playUrl]);

  const clearStableTimer = useCallback(() => {
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
  }, []);

  const remountPlayer = useCallback(
    (nextLowLatencyMode: boolean, options?: { retried?: boolean }) => {
      const now = Date.now();

      if (now - lastToggleAtRef.current < MIN_TOGGLE_INTERVAL_MS) {
        return false;
      }

      lastToggleAtRef.current = now;
      degradingErrorsRef.current = [];
      retriedLowLatencyRef.current = options?.retried ?? false;
      setLowLatencyMode(nextLowLatencyMode);
      setReloadNonce((value) => value + 1);
      return true;
    },
    [],
  );

  const scheduleStableRetry = useCallback(() => {
    clearStableTimer();

    stableTimerRef.current = setTimeout(() => {
      stableTimerRef.current = null;

      if (
        !playUrlRef.current ||
        lowLatencyModeRef.current ||
        lowLatencyBlockedRef.current
      ) {
        return;
      }

      remountPlayer(true, { retried: true });
    }, STABLE_PLAYBACK_MS);
  }, [clearStableTimer, remountPlayer]);

  useEffect(() => () => clearStableTimer(), [clearStableTimer]);

  const onHlsError = useCallback(
    (detail: ErrorData) => {
      if (!playUrlRef.current) {
        return;
      }

      clearStableTimer();

      if (!lowLatencyModeRef.current) {
        return;
      }

      const now = Date.now();
      degradingErrorsRef.current = degradingErrorsRef.current.filter(
        (timestamp) => now - timestamp < HOLE_ERROR_WINDOW_MS,
      );
      degradingErrorsRef.current.push(now);

      if (!shouldDisableLowLatency(detail, degradingErrorsRef.current.length)) {
        return;
      }

      if (retriedLowLatencyRef.current) {
        setLowLatencyBlocked(true);
      }

      remountPlayer(false);
    },
    [clearStableTimer, remountPlayer],
  );

  const onPlaying = useCallback(() => {
    if (
      !playUrlRef.current ||
      lowLatencyModeRef.current ||
      lowLatencyBlockedRef.current
    ) {
      return;
    }

    scheduleStableRetry();
  }, [scheduleStableRetry]);

  const hlsConfig = useMemo(
    () => buildLiveHlsConfig(lowLatencyMode),
    [lowLatencyMode],
  );

  const playerKey = playUrl
    ? `${playUrl}:${lowLatencyMode ? "ll" : "std"}:${reloadNonce}`
    : "idle";

  return {
    hlsConfig,
    playerKey,
    onHlsError,
    onPlaying,
  };
};
