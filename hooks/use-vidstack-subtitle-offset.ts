"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { MediaPlayerInstance } from "@vidstack/react";

import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  applySubtitleCueOffset,
  clampSubtitleOffset,
  listOffsetableCues,
  type OffsetableCue,
} from "@/lib/playback/subtitle-offset";
import {
  getSubtitleOffset,
  hasSubtitleOffset,
  setSubtitleOffset,
  subtitleOffsetScopeKey,
} from "@/lib/playback/subtitle-offset-storage";

type CueTrack = {
  kind?: string;
  mode?: string;
  label?: string | null;
  language?: string | null;
  lang?: string | null;
  cues?: ArrayLike<OffsetableCue> | Iterable<OffsetableCue> | null;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

const toTrackArray = (
  tracks: MediaPlayerInstance["textTracks"],
): CueTrack[] => {
  if (typeof tracks.toArray === "function") {
    return tracks.toArray() as CueTrack[];
  }

  return [];
};

const isSubtitleTrack = (track: CueTrack): boolean =>
  track.kind === "subtitles" || track.kind === "captions";

const trackKeyFor = (track: CueTrack | null): string => {
  if (!track) {
    return "default";
  }

  return (
    track.label?.trim() ||
    track.language?.trim() ||
    track.lang?.trim() ||
    "default"
  );
};

const showingSubtitleTrack = (player: MediaPlayerInstance): CueTrack | null => {
  const tracks = toTrackArray(player.textTracks).filter(isSubtitleTrack);
  return tracks.find((track) => track.mode === "showing") ?? null;
};

const offsetForTrack = (scopeKey: string, trackKey: string): number => {
  if (hasSubtitleOffset(scopeKey, trackKey)) {
    return getSubtitleOffset(scopeKey, trackKey);
  }

  if (trackKey !== "default" && hasSubtitleOffset(scopeKey, "default")) {
    return getSubtitleOffset(scopeKey, "default");
  }

  return 0;
};

const applyOffsetToTrack = (track: CueTrack | null, offsetSeconds: number) => {
  if (!track) {
    return;
  }

  applySubtitleCueOffset(listOffsetableCues(track.cues), offsetSeconds);
};

export function useVidstackSubtitleOffset(
  playerRef: RefObject<MediaPlayerInstance | null>,
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

      const player = playerRef.current;
      if (!player) {
        return;
      }

      applyingRef.current = true;
      try {
        applyOffsetToTrack(showingSubtitleTrack(player), clamped);
      } finally {
        applyingRef.current = false;
      }
    },
    [playerRef, scopeKey],
  );

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const bind = () => {
      if (disposed) {
        return;
      }

      const player = playerRef.current;
      if (!player || !hasSubtitleFiles) {
        return;
      }

      const boundTracks = new Set<CueTrack>();

      const syncFromPlayer = () => {
        if (applyingRef.current) {
          return;
        }

        const showing = showingSubtitleTrack(player);
        const nextKey = trackKeyFor(showing);
        activeTrackKeyRef.current = nextKey;
        const stored = offsetForTrack(scopeKey, nextKey);
        setOffsetSecondsState(stored);
        applyingRef.current = true;
        try {
          applyOffsetToTrack(showing, stored);
        } finally {
          applyingRef.current = false;
        }
      };

      const bindTrack = (track: CueTrack) => {
        if (boundTracks.has(track)) {
          return;
        }
        boundTracks.add(track);
        track.addEventListener?.("load", syncFromPlayer);
        track.addEventListener?.("cue-change", syncFromPlayer);
      };

      const bindAllTracks = () => {
        for (const track of toTrackArray(player.textTracks).filter(
          isSubtitleTrack,
        )) {
          bindTrack(track);
        }
        syncFromPlayer();
      };

      const { textTracks } = player;
      textTracks.addEventListener("add", bindAllTracks);
      textTracks.addEventListener("mode-change", syncFromPlayer);
      bindAllTracks();

      cleanup = () => {
        textTracks.removeEventListener("add", bindAllTracks);
        textTracks.removeEventListener("mode-change", syncFromPlayer);
        for (const track of boundTracks) {
          track.removeEventListener?.("load", syncFromPlayer);
          track.removeEventListener?.("cue-change", syncFromPlayer);
        }
      };
    };

    bind();

    if (!cleanup) {
      const frame = requestAnimationFrame(bind);
      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        cleanup?.();
      };
    }

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [hasSubtitleFiles, playerRef, scopeKey]);

  return {
    offsetSeconds,
    setOffsetSeconds: persistAndApply,
    hasTracks: hasSubtitleFiles,
  };
}
