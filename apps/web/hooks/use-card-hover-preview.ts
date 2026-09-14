"use client";

import {
  claimCardHoverPreview,
  releaseCardHoverPreview,
  subscribeCardHoverPreview,
} from "@/lib/card-hover-preview-coordinator";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useVideasyTrailerStream } from "@/hooks/use-videasy-trailer-stream";
import useMedia from "@/hooks/useMedia";
import { useCallback, useEffect, useRef, useState } from "react";

const HOVER_DWELL_MS = 500;
const CARD_STREAM_DELAY_MS = 0;

export type UseCardHoverPreviewArgs = {
  previewId: string;
  imdbId: string | undefined;
  catalogCardStyle: "poster" | "backdrop";
};

export type UseCardHoverPreviewResult = {
  isPreviewActive: boolean;
  isPreviewPlaying: boolean;
  isUnmuted: boolean;
  toggleUnmute: () => void;
  mp4Url: string | null;
  hlsUrl: string | null;
  streamStatus: ReturnType<typeof useVideasyTrailerStream>["status"];
  handleStreamError: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

export const useCardHoverPreview = ({
  previewId,
  imdbId,
  catalogCardStyle,
}: UseCardHoverPreviewArgs): UseCardHoverPreviewResult => {
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const isMobile = useMedia("(max-width: 768px)", false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hoverArmed, setHoverArmed] = useState(false);
  const [isUnmuted, setIsUnmuted] = useState(false);
  const dwellTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const previewEligible =
    catalogCardStyle === "backdrop" &&
    !isMobile &&
    !prefersReducedMotion &&
    !disableHeroTrailers &&
    Boolean(imdbId?.startsWith("tt"));

  const streamEnabled = previewEligible && hoverArmed;

  const { mp4Url, hlsUrl, status, handleStreamError } = useVideasyTrailerStream(
    imdbId,
    streamEnabled,
    { initialStreamDelayMs: CARD_STREAM_DELAY_MS },
  );

  const clearDwellTimer = useCallback(() => {
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    clearDwellTimer();
    setHoverArmed(false);
    setIsUnmuted(false);
    releaseCardHoverPreview(previewId);
  }, [clearDwellTimer, previewId]);

  const onPointerEnter = useCallback(() => {
    if (!previewEligible) {
      return;
    }
    clearDwellTimer();
    dwellTimerRef.current = window.setTimeout(() => {
      claimCardHoverPreview(previewId);
      setHoverArmed(true);
    }, HOVER_DWELL_MS);
  }, [clearDwellTimer, previewEligible, previewId]);

  const onPointerLeave = useCallback(() => {
    stopPreview();
  }, [stopPreview]);

  useEffect(() => {
    return subscribeCardHoverPreview((activeId) => {
      if (activeId !== previewId) {
        clearDwellTimer();
        setHoverArmed(false);
        setIsUnmuted(false);
      }
    });
  }, [clearDwellTimer, previewId]);

  useEffect(() => {
    return () => {
      clearDwellTimer();
      releaseCardHoverPreview(previewId);
    };
  }, [clearDwellTimer, previewId]);

  const toggleUnmute = useCallback(() => {
    setIsUnmuted((prev) => !prev);
  }, []);

  const isPreviewPlaying =
    streamEnabled && status === "ready" && Boolean(mp4Url || hlsUrl);

  return {
    isPreviewActive: streamEnabled,
    isPreviewPlaying,
    isUnmuted,
    toggleUnmute,
    mp4Url,
    hlsUrl,
    streamStatus: status,
    handleStreamError,
    onPointerEnter,
    onPointerLeave,
  };
};
