"use client";

import type { MediaPlayerInstance } from "@vidstack/react";
import { useEffect, useMemo, useRef, type RefObject } from "react";

import {
  pickTrackIndexByLanguage,
  trackMatchesLanguage,
  type TrackLanguageFields,
} from "@/lib/playback/track-matching";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import {
  getTrackPreferences,
  trackPreferenceStorageKey,
  updateTrackPreferences,
  type SubtitleTrackPreference,
} from "@/lib/playback/track-preferences-storage";

type PlayerTextTrack = TrackLanguageFields & {
  kind?: string;
  mode?: string;
};

type PlayerAudioTrack = TrackLanguageFields & {
  selected?: boolean;
};

const NON_PRIMARY_AUDIO_PATTERN =
  /commentary|description|descriptive|audio description|director|cast|isolated score/i;

export const pickPrimaryAudioTrack = (
  tracks: PlayerAudioTrack[],
  preferredLang?: string | null,
): PlayerAudioTrack | undefined => {
  const primaryTracks = tracks.filter((track) => {
    const description = [track.label, track.language, track.lang]
      .filter(Boolean)
      .join(" ");
    return !NON_PRIMARY_AUDIO_PATTERN.test(description);
  });

  if (preferredLang) {
    const preferred = primaryTracks.find((track) =>
      trackMatchesLanguage(track, preferredLang),
    );
    if (preferred) {
      return preferred;
    }
  }

  return (
    primaryTracks.find((track) => trackMatchesLanguage(track, "english")) ??
    primaryTracks[0]
  );
};

const normalizeAudioTrackLabel = (track: PlayerAudioTrack) => {
  const lang = (track.lang ?? track.language ?? "").trim().toLowerCase();
  const label = (track.label ?? "").trim();
  const labelNorm = label.toLowerCase();

  if (!lang || !label) {
    return;
  }

  const isJapanese =
    lang === "ja" || lang.startsWith("ja-") || lang === "jpn" || lang === "jp";
  const isEnglish = lang === "en" || lang.startsWith("en-") || lang === "eng";

  if (isJapanese && labelNorm.includes("english")) {
    track.label = "Japanese";
    if (track.language && track.language.toLowerCase().includes("english")) {
      track.language = "Japanese";
    }
    return;
  }

  if (isEnglish && labelNorm.includes("japanese")) {
    track.label = "English";
    if (track.language && track.language.toLowerCase().includes("japanese")) {
      track.language = "English";
    }
  }
};

const toTrackArray = <T>(
  tracks: Iterable<T> | { toArray?: () => T[] },
): T[] => {
  if (tracks && typeof tracks === "object" && "toArray" in tracks) {
    return tracks.toArray?.() ?? [];
  }

  return Array.from(tracks as Iterable<T>);
};

const readActiveSubtitlePreference = (
  player: MediaPlayerInstance,
): SubtitleTrackPreference => {
  const tracks = toTrackArray<PlayerTextTrack>(player.textTracks).filter(
    (track) => track.kind === "subtitles" || track.kind === "captions",
  );
  const active = tracks.find((track) => track.mode === "showing");

  if (!active) {
    return "off";
  }

  return active.language ?? active.label ?? active.lang ?? "unknown";
};

const readActiveAudioPreference = (
  player: MediaPlayerInstance,
): string | null => {
  const selected =
    (player as MediaPlayerInstance & { audioTrack?: PlayerAudioTrack | null })
      .audioTrack ??
    toTrackArray<PlayerAudioTrack>(
      (
        player as MediaPlayerInstance & {
          audioTracks?: Iterable<PlayerAudioTrack>;
        }
      ).audioTracks ?? [],
    ).find((track) => track.selected);

  if (!selected) {
    return null;
  }

  return selected.language ?? selected.label ?? selected.lang ?? null;
};

const applySubtitlePreference = (
  player: MediaPlayerInstance,
  preferred: SubtitleTrackPreference | null | undefined,
) => {
  const tracks = toTrackArray<PlayerTextTrack & { mode?: string }>(
    player.textTracks,
  ).filter((track) => track.kind === "subtitles" || track.kind === "captions");

  if (!tracks.length) {
    return;
  }

  if (!preferred || preferred === "off") {
    for (const track of tracks) {
      track.mode = "disabled";
    }
    return;
  }

  const index = pickTrackIndexByLanguage(tracks, preferred);
  if (index == null) {
    return;
  }

  for (const [trackIndex, track] of tracks.entries()) {
    track.mode = trackIndex === index ? "showing" : "disabled";
  }
};

const applyAudioPreference = (
  player: MediaPlayerInstance,
  preferred: string | null | undefined,
) => {
  if (!preferred) {
    return;
  }

  const audioTracks = (
    player as MediaPlayerInstance & {
      audioTracks?: Iterable<PlayerAudioTrack>;
    }
  ).audioTracks;

  if (!audioTracks) {
    return;
  }

  const tracks = toTrackArray<PlayerAudioTrack>(audioTracks);
  const match = tracks.find((track) => trackMatchesLanguage(track, preferred));
  if (!match) {
    return;
  }

  match.selected = true;
};

export function usePlaybackTrackPreferences(
  playerRef: RefObject<MediaPlayerInstance | null>,
  progressKey: PlaybackProgressKey,
  sourceKey: string,
  preferredAudioLang?: string | null,
) {
  const scopeKey = useMemo(
    () => trackPreferenceStorageKey(progressKey),
    [progressKey.contentId, progressKey.mediaType],
  );
  const applyingRef = useRef(false);

  useEffect(() => {
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

      const applySaved = () => {
        const preferences = getTrackPreferences(scopeKey);

        applyingRef.current = true;
        try {
          if (preferences) {
            applySubtitlePreference(player, preferences.subtitleLang);
          }

          const tracks = toTrackArray<PlayerAudioTrack>(
            (
              player as MediaPlayerInstance & {
                audioTracks?: Iterable<PlayerAudioTrack>;
              }
            ).audioTracks ?? [],
          );
          const savedTrack = preferences?.audioLang
            ? tracks.find((track) =>
                trackMatchesLanguage(track, preferences.audioLang!),
              )
            : undefined;
          const savedTrackDescription = savedTrack
            ? [savedTrack.label, savedTrack.language, savedTrack.lang]
                .filter(Boolean)
                .join(" ")
            : "";

          if (
            savedTrack &&
            !NON_PRIMARY_AUDIO_PATTERN.test(savedTrackDescription)
          ) {
            applyAudioPreference(player, preferences?.audioLang);
          } else {
            const primaryTrack = pickPrimaryAudioTrack(
              tracks,
              preferredAudioLang,
            );
            if (primaryTrack) {
              primaryTrack.selected = true;
            }
          }
        } finally {
          applyingRef.current = false;
        }
      };

      const persistSubtitlePreference = () => {
        if (applyingRef.current) {
          return;
        }

        updateTrackPreferences(scopeKey, {
          subtitleLang: readActiveSubtitlePreference(player),
        });
      };

      const persistAudioPreference = () => {
        if (applyingRef.current) {
          return;
        }

        updateTrackPreferences(scopeKey, {
          audioLang: readActiveAudioPreference(player),
        });
      };

      const { textTracks } = player;
      const audioTracks = (
        player as MediaPlayerInstance & {
          audioTracks?: {
            addEventListener: (type: string, listener: () => void) => void;
            removeEventListener: (type: string, listener: () => void) => void;
          };
        }
      ).audioTracks;

      const normalizeAudioTracks = () => {
        const list = toTrackArray<PlayerAudioTrack>(
          (
            player as MediaPlayerInstance & {
              audioTracks?: Iterable<PlayerAudioTrack>;
            }
          ).audioTracks ?? [],
        );
        for (const track of list) {
          normalizeAudioTrackLabel(track);
        }
      };

      textTracks.addEventListener("add", applySaved);
      textTracks.addEventListener("mode-change", persistSubtitlePreference);
      audioTracks?.addEventListener("add", () => {
        normalizeAudioTracks();
        applySaved();
      });
      audioTracks?.addEventListener("change", persistAudioPreference);

      normalizeAudioTracks();
      applySaved();

      cleanup = () => {
        textTracks.removeEventListener("add", applySaved);
        textTracks.removeEventListener(
          "mode-change",
          persistSubtitlePreference,
        );
        audioTracks?.removeEventListener("add", applySaved);
        audioTracks?.removeEventListener("change", persistAudioPreference);
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
  }, [playerRef, preferredAudioLang, scopeKey, sourceKey]);
}
