"use client";

import {
  claimCardHoverPreview,
  releaseCardHoverPreview,
  subscribeCardHoverPreview,
} from "@/lib/card-hover-preview-coordinator";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import { useHasUserInteracted } from "@/lib/media/autoplay-unlock";
import { useVideasyTrailerStream } from "@/hooks/use-videasy-trailer-stream";
import useMedia from "@/hooks/useMedia";
import type { CardPreviewSource } from "@/lib/catalog-card-presentation";
import { useCallback, useEffect, useRef, useState } from "react";

const HOVER_DWELL_MS = 500;
const CARD_STREAM_DELAY_MS = 0;

export type UseCardHoverPreviewArgs = {
  previewId: string;
  previewSource: CardPreviewSource | undefined;
  catalogCardStyle: "poster" | "backdrop";
};

export type UseCardHoverPreviewResult = {
  isPreviewActive: boolean;
  isPreviewEligible: boolean;
  isPreviewPlaying: boolean;
  /** True once a playable trailer is known for this card. */
  isTrailerAvailable: boolean;
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
  previewSource,
  catalogCardStyle,
}: UseCardHoverPreviewArgs): UseCardHoverPreviewResult => {
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const flags = useFeatureFlagsOptional();
  const staticHeroBackdrops = flags?.staticHeroBackdrops ?? false;
  const cardHoverPreviewsEnabled = flags?.cardHoverPreviews ?? true;
  const isMobile = useMedia("(max-width: 768px)", false);
  const userInteracted = useHasUserInteracted();
  const userInteractedRef = useRef(userInteracted);
  userInteractedRef.current = userInteracted;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hoverArmed, setHoverArmed] = useState(false);
  const [isUnmuted, setIsUnmuted] = useState(false);
  const manualMuteRef = useRef(false);
  const dwellTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const previewEligible =
    cardHoverPreviewsEnabled &&
    catalogCardStyle === "backdrop" &&
    !isMobile &&
    !prefersReducedMotion &&
    !disableHeroTrailers &&
    !staticHeroBackdrops &&
    Boolean(previewSource);

  const streamEnabled = previewEligible && hoverArmed;
  const streamSource =
    previewSource?.kind === "stream" ? previewSource : undefined;

  const { mp4Url, hlsUrl, status, handleStreamError } = useVideasyTrailerStream(
    streamSource,
    streamEnabled && Boolean(streamSource),
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
    manualMuteRef.current = false;
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
      // With sound only when the browser will allow it (post-gesture) and the
      // user hasn't explicitly muted a previous preview.
      if (userInteractedRef.current && !manualMuteRef.current) {
        setIsUnmuted(true);
      }
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
        manualMuteRef.current = false;
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
    setIsUnmuted((prev) => {
      const next = !prev;
      manualMuteRef.current = !next;
      return next;
    });
  }, []);

  // If the user interacts while a preview is already playing muted, upgrade it
  // to sound (the gesture unlocks unmuted playback).
  useEffect(() => {
    if (userInteracted && hoverArmed && !manualMuteRef.current) {
      setIsUnmuted(true);
    }
  }, [userInteracted, hoverArmed]);

  const isPreviewPlaying =
    Boolean(streamSource) &&
    streamEnabled &&
    status === "ready" &&
    Boolean(mp4Url || hlsUrl);

  const isTrailerAvailable =
    previewSource?.kind === "youtube"
      ? Boolean(previewSource.youtubeKey)
      : status === "ready" && Boolean(mp4Url || hlsUrl);

  return {
    isPreviewActive: streamEnabled,
    isPreviewEligible: previewEligible,
    isPreviewPlaying,
    isTrailerAvailable,
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
