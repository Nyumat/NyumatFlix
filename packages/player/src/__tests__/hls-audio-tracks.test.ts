import { describe, expect, it } from "vitest";
import {
  mapHlsAudioRenditions,
  mapNativeAudioTracks,
} from "../render/HLSPlayerWrapper";

describe("mapHlsAudioRenditions", () => {
  it("hides the audio menu when the master only has one rendition", () => {
    expect(
      mapHlsAudioRenditions([{ id: 0, name: "Japanese", lang: "jpn" }]),
    ).toEqual([]);
  });

  it("exposes labeled tracks when the master has multiple AUDIO renditions", () => {
    expect(
      mapHlsAudioRenditions([
        { id: 0, name: "Japanese", lang: "jpn" },
        { id: 1, name: "English", lang: "eng" },
      ]),
    ).toEqual([
      {
        id: 0,
        type: "audio",
        codec: "",
        language: "jpn",
        label: "Japanese",
        channels: 0,
        sampleRate: 0,
      },
      {
        id: 1,
        type: "audio",
        codec: "",
        language: "eng",
        label: "English",
        channels: 0,
        sampleRate: 0,
      },
    ]);
  });
});

describe("mapNativeAudioTracks", () => {
  it("exposes Safari audioTracks when more than one language exists", () => {
    const list = {
      length: 2,
      0: { id: "ja", language: "ja", label: "Japanese", enabled: true },
      1: { id: "en", language: "en", label: "English", enabled: false },
    };

    expect(mapNativeAudioTracks(list)).toHaveLength(2);
    expect(mapNativeAudioTracks(list)[1]?.label).toBe("English");
  });
});
