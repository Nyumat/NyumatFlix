import {
  clampSubtitleAppearance,
  DEFAULT_SUBTITLE_APPEARANCE,
  type SubtitleAppearance,
  type SubtitleFontFamily,
  type SubtitleTextShadow,
} from "@/lib/playback/subtitle-appearance";

export const SUBTITLE_APPEARANCE_STORAGE_KEY =
  "nyumatflix.playback.subtitle-appearance";

export const SUBTITLE_APPEARANCE_CHANGE_EVENT =
  "nyumatflix:subtitle-appearance-change";

const FONT_FAMILIES = new Set<SubtitleFontFamily>([
  "pro-sans",
  "pro-serif",
  "mono-sans",
  "mono-serif",
  "casual",
  "cursive",
  "capitals",
]);

const TEXT_SHADOWS = new Set<SubtitleTextShadow>([
  "none",
  "drop-shadow",
  "raised",
  "depressed",
  "outline",
]);

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

const parseAppearance = (raw: unknown): SubtitleAppearance | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const input = raw as Partial<SubtitleAppearance>;
  const fontFamily = input.fontFamily;
  const textShadow = input.textShadow;

  return clampSubtitleAppearance({
    fontFamily:
      fontFamily && FONT_FAMILIES.has(fontFamily)
        ? fontFamily
        : DEFAULT_SUBTITLE_APPEARANCE.fontFamily,
    fontSize: readNumber(input.fontSize, DEFAULT_SUBTITLE_APPEARANCE.fontSize),
    lineHeight: readNumber(
      input.lineHeight,
      DEFAULT_SUBTITLE_APPEARANCE.lineHeight,
    ),
    textColor: readString(
      input.textColor,
      DEFAULT_SUBTITLE_APPEARANCE.textColor,
    ),
    textOpacity: readNumber(
      input.textOpacity,
      DEFAULT_SUBTITLE_APPEARANCE.textOpacity,
    ),
    textShadow:
      textShadow && TEXT_SHADOWS.has(textShadow)
        ? textShadow
        : DEFAULT_SUBTITLE_APPEARANCE.textShadow,
    textBgColor: readString(
      input.textBgColor,
      DEFAULT_SUBTITLE_APPEARANCE.textBgColor,
    ),
    textBgOpacity: readNumber(
      input.textBgOpacity,
      DEFAULT_SUBTITLE_APPEARANCE.textBgOpacity,
    ),
    displayBgColor: readString(
      input.displayBgColor,
      DEFAULT_SUBTITLE_APPEARANCE.displayBgColor,
    ),
    displayBgOpacity: readNumber(
      input.displayBgOpacity,
      DEFAULT_SUBTITLE_APPEARANCE.displayBgOpacity,
    ),
    backdropBlur: readNumber(
      input.backdropBlur,
      DEFAULT_SUBTITLE_APPEARANCE.backdropBlur,
    ),
    borderRadius: readNumber(
      input.borderRadius,
      DEFAULT_SUBTITLE_APPEARANCE.borderRadius,
    ),
    paddingScale: readNumber(
      input.paddingScale,
      DEFAULT_SUBTITLE_APPEARANCE.paddingScale,
    ),
    baseFontScale: readNumber(
      input.baseFontScale,
      DEFAULT_SUBTITLE_APPEARANCE.baseFontScale,
    ),
    bottomOffset: readNumber(
      input.bottomOffset,
      DEFAULT_SUBTITLE_APPEARANCE.bottomOffset,
    ),
  });
};

export const getSubtitleAppearance = (): SubtitleAppearance => {
  if (typeof window === "undefined") {
    return DEFAULT_SUBTITLE_APPEARANCE;
  }

  try {
    const raw = window.localStorage.getItem(SUBTITLE_APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SUBTITLE_APPEARANCE;
    }

    const parsed = parseAppearance(JSON.parse(raw));
    return parsed ?? DEFAULT_SUBTITLE_APPEARANCE;
  } catch {
    return DEFAULT_SUBTITLE_APPEARANCE;
  }
};

export const setSubtitleAppearance = (
  appearance: SubtitleAppearance,
): SubtitleAppearance => {
  const clamped = clampSubtitleAppearance(appearance);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        SUBTITLE_APPEARANCE_STORAGE_KEY,
        JSON.stringify(clamped),
      );
      window.dispatchEvent(
        new CustomEvent(SUBTITLE_APPEARANCE_CHANGE_EVENT, { detail: clamped }),
      );
    } catch {
      void 0;
    }
  }

  return clamped;
};

export const resetSubtitleAppearance = (): SubtitleAppearance => {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(SUBTITLE_APPEARANCE_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent(SUBTITLE_APPEARANCE_CHANGE_EVENT, {
          detail: DEFAULT_SUBTITLE_APPEARANCE,
        }),
      );
    } catch {
      void 0;
    }
  }

  return DEFAULT_SUBTITLE_APPEARANCE;
};

export const subscribeSubtitleAppearance = (
  listener: () => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(SUBTITLE_APPEARANCE_CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
};
