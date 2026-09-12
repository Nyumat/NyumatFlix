import { describe, expect, it } from "vitest";

import {
  applyNativeExternalTextTrackSelection,
  applyNativeManifestTextTrackSelection,
  forceNativeTextTracksHidden,
  NATIVE_SUBTITLE_TRACK_MODE,
  readNativeSubtitleCue,
  stripVttMarkup,
} from "../render/native-manifest-subtitles";
import type { SubtitleTrack } from "../types";

const makeTextTrackList = (
  tracks: Array<{
    kind: TextTrackKind;
    label: string;
    mode?: TextTrackMode;
    cues?: Array<{ startTime: number; endTime: number; text: string }>;
    activeCues?: Array<{ startTime: number; endTime: number; text: string }>;
  }>,
): TextTrackList => {
  const list = tracks.map((track, index) => ({
    kind: track.kind,
    label: track.label,
    mode: track.mode ?? "disabled",
    cues: track.cues ?? null,
    activeCues: track.activeCues ?? null,
    language: "",
    id: String(index),
    oncuechange: null,
    addCue: () => {},
    removeCue: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as TextTrack[];

  return {
    length: list.length,
    ...Object.fromEntries(list.map((track, index) => [index, track])),
    [Symbol.iterator]: function* () {
      for (const track of list) yield track;
    },
  } as TextTrackList;
};

describe("native manifest subtitle helpers", () => {
  it("keeps manifest tracks hidden instead of showing", () => {
    const textTracks = makeTextTrackList([
      { kind: "subtitles", label: "English" },
      { kind: "subtitles", label: "French" },
    ]);

    const selected: SubtitleTrack = {
      id: 1,
      type: "subtitle",
      codec: "webvtt",
      language: "fre",
      label: "French",
      subtitleType: "text",
    };

    applyNativeManifestTextTrackSelection(textTracks, selected);

    expect(textTracks[0]?.mode).toBe("hidden");
    expect(textTracks[1]?.mode).toBe(NATIVE_SUBTITLE_TRACK_MODE);
  });

  it("keeps external tracks hidden instead of showing", () => {
    const textTracks = makeTextTrackList([
      { kind: "subtitles", label: "English" },
      { kind: "subtitles", label: "French" },
    ]);

    applyNativeExternalTextTrackSelection(textTracks, "English");

    expect(textTracks[0]?.mode).toBe(NATIVE_SUBTITLE_TRACK_MODE);
    expect(textTracks[1]?.mode).toBe("hidden");
  });

  it("forces every renderable track hidden for overlay rendering", () => {
    const textTracks = makeTextTrackList([
      { kind: "subtitles", label: "English", mode: "showing" },
      { kind: "metadata", label: "meta", mode: "hidden" },
    ]);

    forceNativeTextTracksHidden(textTracks);

    expect(textTracks[0]?.mode).toBe("hidden");
    expect(textTracks[1]?.mode).toBe("hidden");
  });

  it("reads active cues without native rendering", () => {
    const textTracks = makeTextTrackList([
      {
        kind: "subtitles",
        label: "English",
        mode: "hidden",
        cues: [{ startTime: 1, endTime: 2, text: "<i>Hello</i>" }],
      },
    ]);

    const cue = readNativeSubtitleCue(textTracks[0] ?? null, 1.5, 0);

    expect(stripVttMarkup("<i>Hello</i>")).toBe("Hello");
    expect(cue.text).toBe("Hello");
    expect(cue.key).toBe("1.000|Hello");
  });

  it("applies subtitle delay when scanning cue windows", () => {
    const textTracks = makeTextTrackList([
      {
        kind: "subtitles",
        label: "English",
        mode: "hidden",
        cues: [{ startTime: 5, endTime: 7, text: "Delayed" }],
      },
    ]);

    const cue = readNativeSubtitleCue(textTracks[0] ?? null, 6.5, 1);

    expect(cue.text).toBe("Delayed");
    expect(cue.key).toBe("5.000|Delayed");
  });
});
