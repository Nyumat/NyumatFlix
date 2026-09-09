"use client";

import { useCallback, useEffect, useRef } from "react";

import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  registerPlaybackProgressFlush,
  unregisterPlaybackProgressFlush,
} from "@/lib/playback/progress-flush";

export const usePlaybackSession = (progressKey: PlaybackProgressKey) => {
  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);
  const persistRef = useRef(persist);
  const persistImmediateRef = useRef(persistImmediate);
  persistRef.current = persist;
  persistImmediateRef.current = persistImmediate;

  const registerProgressFlush = useCallback((flush: () => void) => {
    registerPlaybackProgressFlush(flush);
    return () => unregisterPlaybackProgressFlush(flush);
  }, []);

  const bindPagehideFlush = useCallback(
    (readProgress: () => { currentTime: number; duration: number } | null) => {
      const persistNow = () => {
        const snapshot = readProgress();
        if (!snapshot) {
          return;
        }
        persistImmediateRef.current(snapshot.currentTime, snapshot.duration);
      };

      window.addEventListener("pagehide", persistNow);
      registerPlaybackProgressFlush(persistNow);
      return () => {
        window.removeEventListener("pagehide", persistNow);
        unregisterPlaybackProgressFlush(persistNow);
        persistNow();
      };
    },
    [],
  );

  return {
    resumeTime,
    persist,
    persistImmediate,
    persistRef,
    persistImmediateRef,
    registerProgressFlush,
    bindPagehideFlush,
  };
};

export const useFatalPlaybackReporter = (onFatalError?: () => void) => {
  const fatalReportedRef = useRef(false);
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  const resetFatalReport = useCallback(() => {
    fatalReportedRef.current = false;
  }, []);

  const reportFatal = useCallback(() => {
    if (fatalReportedRef.current) {
      return;
    }
    fatalReportedRef.current = true;
    onFatalErrorRef.current?.();
  }, []);

  return {
    fatalReportedRef,
    resetFatalReport,
    reportFatal,
  };
};

export const usePlaybackSessionReset = (
  sessionKey: string,
  reset: () => void,
) => {
  useEffect(() => {
    reset();
  }, [sessionKey, reset]);
};
