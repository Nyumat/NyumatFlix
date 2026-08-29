"use client";

import { useEffect, type RefObject } from "react";
import type { MediaPlayerInstance, TextTrack } from "@vidstack/react";

import { vidstackCaptionMenuValue } from "@/lib/playback/vidstack-caption-menu";

const SUBTITLE_KINDS = new Set(["subtitles", "captions"]);

const toTrackArray = (
  tracks: MediaPlayerInstance["textTracks"],
): TextTrack[] => {
  if (typeof tracks.toArray === "function") {
    return tracks.toArray();
  }

  return [];
};

const dedupeSubtitleTracks = (player: MediaPlayerInstance) => {
  const tracks = toTrackArray(player.textTracks).filter((track) =>
    SUBTITLE_KINDS.has(track.kind),
  );
  const seenMenuValues = new Set<string>();
  const seenIds = new Set<string>();

  for (const track of tracks) {
    const menuValue = vidstackCaptionMenuValue({
      id: track.id,
      kind: track.kind,
      label: track.label,
    });
    const duplicate =
      seenMenuValues.has(menuValue) ||
      (track.id.length > 0 && seenIds.has(track.id));

    if (duplicate) {
      player.textTracks.remove(track);
      continue;
    }

    seenMenuValues.add(menuValue);
    if (track.id.length > 0) {
      seenIds.add(track.id);
    }
  }
};

/**
 * Safari native HLS mirrors `<track>` elements into Vidstack's text track list
 * while our `<Track>` components register the same captions again — duplicate
 * menu keys in DefaultCaptionMenu. Drop extras after each add.
 */
export function useDedupeVidstackTextTracks(
  playerRef: RefObject<MediaPlayerInstance | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const bind = () => {
      if (disposed) {
        return;
      }

      const player = playerRef.current;
      if (!player) {
        return;
      }

      const onTracksChanged = () => {
        dedupeSubtitleTracks(player);
      };

      dedupeSubtitleTracks(player);
      const { textTracks } = player;
      textTracks.addEventListener("add", onTracksChanged);

      cleanup = () => {
        textTracks.removeEventListener("add", onTracksChanged);
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
  }, [enabled, playerRef]);
}
