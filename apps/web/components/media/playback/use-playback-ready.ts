"use client";

import { useCallback, useRef } from "react";

import { createMediaReadyHandler } from "@/lib/playback/media-ready";

export const usePlaybackReady = (onMediaReady?: (ready: boolean) => void) => {
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const onMediaReadyRef = useRef(onMediaReady);
  onMediaReadyRef.current = onMediaReady;

  const markMediaReady = useCallback(() => {
    if (readyRef.current) {
      return;
    }
    readyRef.current = true;
    onMediaReadyRef.current?.(true);
  }, []);

  const createReadyHandler = useCallback(() => {
    return createMediaReadyHandler(
      () => onMediaReadyRef.current?.(true),
      readyRef,
    );
  }, []);

  const resetPlaybackReady = useCallback(() => {
    readyRef.current = false;
    startedRef.current = false;
    onMediaReadyRef.current?.(false);
  }, []);

  return {
    readyRef,
    startedRef,
    markMediaReady,
    createReadyHandler,
    resetPlaybackReady,
  };
};
