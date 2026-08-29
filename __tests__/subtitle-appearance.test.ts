import { describe, expect, test } from "vitest";

import {
  applySubtitleAppearanceToElement,
  clampSubtitleAppearance,
  DEFAULT_SUBTITLE_APPEARANCE,
  isDefaultSubtitleAppearance,
  mergeSubtitleAppearance,
  resolveSubtitleAppearancePreset,
  resolveSubtitleColorLabel,
  resolveSubtitleColorRadioValue,
  resolveSubtitleFontFamily,
  resolveSubtitleTextShadow,
  SUBTITLE_APPEARANCE_PRESETS,
} from "@/lib/playback/subtitle-appearance";
import {
  getSubtitleAppearance,
  resetSubtitleAppearance,
  setSubtitleAppearance,
} from "@/lib/playback/subtitle-appearance-storage";

describe("subtitle appearance", () => {
  test("clamps out-of-range values", () => {
    const clamped = clampSubtitleAppearance({
      ...DEFAULT_SUBTITLE_APPEARANCE,
      fontSize: 10,
      lineHeight: 500,
      bottomOffset: 99,
    });

    expect(clamped.fontSize).toBe(50);
    expect(clamped.lineHeight).toBe(200);
    expect(clamped.bottomOffset).toBe(12);
  });

  test("merges partial updates", () => {
    const merged = mergeSubtitleAppearance(DEFAULT_SUBTITLE_APPEARANCE, {
      fontSize: 125,
      textShadow: "outline",
    });

    expect(merged.fontSize).toBe(125);
    expect(merged.textShadow).toBe("outline");
    expect(merged.textColor).toBe(DEFAULT_SUBTITLE_APPEARANCE.textColor);
  });

  test("applies css variables to a player element", () => {
    const element = document.createElement("div");

    applySubtitleAppearanceToElement(element, {
      ...DEFAULT_SUBTITLE_APPEARANCE,
      fontSize: 80,
      textColor: "#ff0000",
      textShadow: "raised",
      fontFamily: "mono-sans",
      backdropBlur: 0,
    });

    expect(element.style.getPropertyValue("--media-user-font-size")).toBe(
      "0.8",
    );
    expect(element.style.getPropertyValue("--media-user-text-shadow")).toBe(
      resolveSubtitleTextShadow("raised"),
    );
    expect(element.style.getPropertyValue("--media-user-font-family")).toBe(
      resolveSubtitleFontFamily("mono-sans"),
    );
    expect(element.style.getPropertyValue("--media-cue-backdrop")).toBe("none");
  });

  test("detects default appearance", () => {
    expect(isDefaultSubtitleAppearance(DEFAULT_SUBTITLE_APPEARANCE)).toBe(true);
    expect(
      isDefaultSubtitleAppearance({
        ...DEFAULT_SUBTITLE_APPEARANCE,
        fontSize: 90,
      }),
    ).toBe(false);
  });

  test("matches named presets and falls back to custom", () => {
    const yellowAnime = SUBTITLE_APPEARANCE_PRESETS.find(
      (preset) => preset.id === "yellow-anime",
    );
    expect(yellowAnime).toBeDefined();
    expect(resolveSubtitleAppearancePreset(yellowAnime!.appearance)?.id).toBe(
      "yellow-anime",
    );
    expect(resolveSubtitleAppearancePreset(DEFAULT_SUBTITLE_APPEARANCE)).toBe(
      null,
    );
  });

  test("labels known swatches and custom colors", () => {
    expect(resolveSubtitleColorLabel("#FFD700")).toBe("Yellow");
    expect(resolveSubtitleColorRadioValue("#ffd700")).toBe("#ffd700");
    expect(resolveSubtitleColorLabel("#abc123")).toBe("Custom");
    expect(resolveSubtitleColorRadioValue("#abc123")).toBe("custom");
  });

  test("applying a preset replaces a dirty appearance", () => {
    const dirty = {
      ...DEFAULT_SUBTITLE_APPEARANCE,
      fontSize: 150,
      textColor: "#ff0000",
    };
    const preset = SUBTITLE_APPEARANCE_PRESETS[0];
    expect(preset).toBeDefined();
    const applied = mergeSubtitleAppearance(dirty, preset!.appearance);
    expect(resolveSubtitleAppearancePreset(applied)?.id).toBe(preset!.id);
  });
});

describe("subtitle appearance storage", () => {
  test("persists and resets appearance", () => {
    window.localStorage.clear();

    const saved = setSubtitleAppearance({
      ...DEFAULT_SUBTITLE_APPEARANCE,
      fontSize: 140,
      textBgOpacity: 40,
    });

    expect(saved.fontSize).toBe(140);
    expect(getSubtitleAppearance().fontSize).toBe(140);
    expect(getSubtitleAppearance().textBgOpacity).toBe(40);

    const reset = resetSubtitleAppearance();
    expect(reset).toEqual(DEFAULT_SUBTITLE_APPEARANCE);
    expect(getSubtitleAppearance()).toEqual(DEFAULT_SUBTITLE_APPEARANCE);
  });
});
