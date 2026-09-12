import type { SubtitleTrack } from "../types";

/**
 * Native WebVTT rendering (`mode: "showing"`) flickers when Movi paints its
 * own chrome. Keep manifest / external TextTracks in `hidden` and render cues
 * into `.movi-subtitle-overlay` instead.
 */
export const NATIVE_SUBTITLE_TRACK_MODE: TextTrackMode = "hidden";

export function isRenderableTextTrack(track: TextTrack): boolean {
  return track.kind === "subtitles" || track.kind === "captions";
}

export function forceNativeTextTracksHidden(textTracks: TextTrackList): void {
  for (let i = 0; i < textTracks.length; i++) {
    const track = textTracks[i];
    if (!isRenderableTextTrack(track)) continue;
    track.mode = NATIVE_SUBTITLE_TRACK_MODE;
  }
}

export function applyNativeManifestTextTrackSelection(
  textTracks: TextTrackList,
  selected: SubtitleTrack | null,
): void {
  let subtitleIndex = 0;
  for (let i = 0; i < textTracks.length; i++) {
    const textTrack = textTracks[i];
    if (!isRenderableTextTrack(textTrack)) continue;
    const active = selected !== null && subtitleIndex === selected.id;
    textTrack.mode = active ? NATIVE_SUBTITLE_TRACK_MODE : "hidden";
    subtitleIndex++;
  }
}

export function applyNativeExternalTextTrackSelection(
  textTracks: TextTrackList,
  selectedLabel: string | null,
): boolean {
  let matched = false;
  for (let i = 0; i < textTracks.length; i++) {
    const textTrack = textTracks[i];
    if (!isRenderableTextTrack(textTrack)) continue;
    if (!selectedLabel) {
      textTrack.mode = "hidden";
      continue;
    }
    const isMatch = textTrack.label === selectedLabel;
    if (isMatch) {
      textTrack.mode = NATIVE_SUBTITLE_TRACK_MODE;
      matched = true;
    } else {
      textTrack.mode = "hidden";
    }
  }
  return selectedLabel === null || matched;
}

export function resolveNativeManifestTextTrack(
  textTracks: TextTrackList,
  active: SubtitleTrack,
): TextTrack | null {
  let subtitleIndex = 0;
  for (let i = 0; i < textTracks.length; i++) {
    const textTrack = textTracks[i];
    if (!isRenderableTextTrack(textTrack)) continue;
    if (subtitleIndex === active.id) return textTrack;
    subtitleIndex++;
  }
  return null;
}

export function resolveNativeExternalTextTrack(
  textTracks: TextTrackList,
  label: string,
): TextTrack | null {
  for (let i = 0; i < textTracks.length; i++) {
    const textTrack = textTracks[i];
    if (!isRenderableTextTrack(textTrack)) continue;
    if (textTrack.label === label) return textTrack;
  }
  return null;
}

export type NativeSubtitleCueSnapshot = {
  text: string;
  key: string;
};

export function stripVttMarkup(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

export function readNativeSubtitleCue(
  textTrack: TextTrack | null,
  currentTime: number,
  delaySeconds: number,
): NativeSubtitleCueSnapshot {
  if (!textTrack) return { text: "", key: "" };

  const adjustedTime = currentTime - delaySeconds;
  const cues = textTrack.cues;
  if (!cues) return { text: "", key: "" };

  for (let j = 0; j < cues.length; j++) {
    const cue = cues[j];
    if (
      cue &&
      adjustedTime >= cue.startTime &&
      adjustedTime <= cue.endTime
    ) {
      const text = stripVttMarkup((cue as VTTCue).text);
      return { text, key: `${cue.startTime.toFixed(3)}|${text}` };
    }
  }

  return { text: "", key: "" };
}
