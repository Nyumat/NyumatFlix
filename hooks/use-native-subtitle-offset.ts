"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  applySubtitleCueOffset,
  clampSubtitleOffset,
} from "@/lib/playback/subtitle-offset";
import {
  getSubtitleOffset,
  hasSubtitleOffset,
  setSubtitleOffset,
  subtitleOffsetScopeKey,
} from "@/lib/playback/subtitle-offset-storage";

const trackKeyFor = (track: TextTrack | null): string => {
  if (!track) {
    return "default";
  }

  return track.label.trim() || track.language.trim() || "default";
};

const showingSubtitleTrack = (video: HTMLVideoElement): TextTrack | null =>
  Array.from(video.textTracks).find(
    (track) =>
      (track.kind === "subtitles" || track.kind === "captions") &&
      track.mode === "showing",
  ) ?? null;

const offsetForTrack = (scopeKey: string, trackKey: string): number => {
  if (hasSubtitleOffset(scopeKey, trackKey)) {
    return getSubtitleOffset(scopeKey, trackKey);
  }

  if (trackKey !== "default" && hasSubtitleOffset(scopeKey, "default")) {
    return getSubtitleOffset(scopeKey, "default");
  }

  return 0;
};

export function useNativeSubtitleOffset(
  videoRef: RefObject<HTMLVideoElement | null>,
  progressKey: PlaybackProgressKey,
  hasSubtitleFiles: boolean,
): {
  offsetSeconds: number;
  setOffsetSeconds: (next: number) => void;
  hasTracks: boolean;
} {
  const scopeKey = useMemo(
    () => subtitleOffsetScopeKey(progressKey),
    [
      progressKey.contentId,
      progressKey.episodeNumber,
      progressKey.mediaType,
      progressKey.seasonNumber,
    ],
  );
  const [offsetSeconds, setOffsetSecondsState] = useState(0);
  const activeTrackKeyRef = useRef("default");
  const applyingRef = useRef(false);

  const persistAndApply = useCallback(
    (next: number) => {
      const clamped = clampSubtitleOffset(next);
      setOffsetSecondsState(clamped);
      setSubtitleOffset(scopeKey, activeTrackKeyRef.current, clamped);

      const video = videoRef.current;
      if (!video) {
        return;
      }

      applyingRef.current = true;
      try {
        applySubtitleCueOffset(showingSubtitleTrack(video)?.cues, clamped);
      } finally {
        applyingRef.current = false;
      }
    },
    [scopeKey, videoRef],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasSubtitleFiles) {
      return;
    }

    const syncFromPlayer = () => {
      if (applyingRef.current) {
        return;
      }

      const showing = showingSubtitleTrack(video);
      const nextKey = trackKeyFor(showing);
      activeTrackKeyRef.current = nextKey;
      const stored = offsetForTrack(scopeKey, nextKey);
      setOffsetSecondsState(stored);
      applyingRef.current = true;
      try {
        applySubtitleCueOffset(showing?.cues, stored);
      } finally {
        applyingRef.current = false;
      }
    };

    video.textTracks.addEventListener("addtrack", syncFromPlayer);
    video.textTracks.addEventListener("change", syncFromPlayer);
    syncFromPlayer();

    return () => {
      video.textTracks.removeEventListener("addtrack", syncFromPlayer);
      video.textTracks.removeEventListener("change", syncFromPlayer);
    };
  }, [hasSubtitleFiles, scopeKey, videoRef]);

  return {
    offsetSeconds,
    setOffsetSeconds: persistAndApply,
    hasTracks: hasSubtitleFiles,
  };
}
