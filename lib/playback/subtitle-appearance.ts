export type SubtitleFontFamily =
  | "pro-sans"
  | "pro-serif"
  | "mono-sans"
  | "mono-serif"
  | "casual"
  | "cursive"
  | "capitals";

export type SubtitleTextShadow =
  | "none"
  | "drop-shadow"
  | "raised"
  | "depressed"
  | "outline";

export type SubtitleAppearance = {
  fontFamily: SubtitleFontFamily;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  textOpacity: number;
  textShadow: SubtitleTextShadow;
  textBgColor: string;
  textBgOpacity: number;
  displayBgColor: string;
  displayBgOpacity: number;
  backdropBlur: number;
  borderRadius: number;
  paddingScale: number;
  baseFontScale: number;
  bottomOffset: number;
};

export const SUBTITLE_FONT_FAMILY_OPTIONS: ReadonlyArray<{
  value: SubtitleFontFamily;
  label: string;
}> = [
  { value: "pro-sans", label: "Sans Serif" },
  { value: "pro-serif", label: "Serif" },
  { value: "mono-sans", label: "Monospace Sans" },
  { value: "mono-serif", label: "Monospace Serif" },
  { value: "casual", label: "Casual" },
  { value: "cursive", label: "Cursive" },
  { value: "capitals", label: "Small Caps" },
];

export const SUBTITLE_TEXT_SHADOW_OPTIONS: ReadonlyArray<{
  value: SubtitleTextShadow;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "drop-shadow", label: "Drop Shadow" },
  { value: "raised", label: "Raised" },
  { value: "depressed", label: "Depressed" },
  { value: "outline", label: "Outline" },
];

export const DEFAULT_SUBTITLE_APPEARANCE: SubtitleAppearance = {
  fontFamily: "pro-sans",
  fontSize: 100,
  lineHeight: 120,
  textColor: "#ffffff",
  textOpacity: 100,
  textShadow: "none",
  textBgColor: "#000000",
  textBgOpacity: 70,
  displayBgColor: "#000000",
  displayBgOpacity: 0,
  backdropBlur: 8,
  borderRadius: 2,
  paddingScale: 100,
  baseFontScale: 4.5,
  bottomOffset: 1,
};

export const SUBTITLE_COLOR_SWATCHES: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "#ffffff", label: "White" },
  { value: "#ffd700", label: "Yellow" },
  { value: "#00ff00", label: "Green" },
  { value: "#00ffff", label: "Cyan" },
  { value: "#0000ff", label: "Blue" },
  { value: "#ff00ff", label: "Magenta" },
  { value: "#ff0000", label: "Red" },
  { value: "#000000", label: "Black" },
];

export type SubtitleAppearancePreset = {
  id: string;
  name: string;
  appearance: SubtitleAppearance;
};

export const SUBTITLE_APPEARANCE_PRESETS: ReadonlyArray<SubtitleAppearancePreset> =
  [
    {
      id: "classic-netflix",
      name: "Classic Netflix",
      appearance: {
        ...DEFAULT_SUBTITLE_APPEARANCE,
        fontFamily: "pro-sans",
        fontSize: 100,
        textColor: "#ffffff",
        textOpacity: 100,
        textShadow: "drop-shadow",
        textBgColor: "#000000",
        textBgOpacity: 0,
        displayBgOpacity: 0,
        backdropBlur: 0,
        borderRadius: 2,
        paddingScale: 100,
        baseFontScale: 4.5,
        bottomOffset: 1,
      },
    },
    {
      id: "compact-minimal",
      name: "Compact & Minimal",
      appearance: {
        ...DEFAULT_SUBTITLE_APPEARANCE,
        fontFamily: "pro-sans",
        fontSize: 80,
        textColor: "#ffffff",
        textOpacity: 100,
        textShadow: "outline",
        textBgColor: "#000000",
        textBgOpacity: 60,
        displayBgOpacity: 0,
        backdropBlur: 6,
        borderRadius: 4,
        paddingScale: 75,
        baseFontScale: 3.8,
        bottomOffset: 2,
      },
    },
    {
      id: "yellow-anime",
      name: "Yellow Anime",
      appearance: {
        ...DEFAULT_SUBTITLE_APPEARANCE,
        fontFamily: "pro-sans",
        fontSize: 95,
        textColor: "#ffd700",
        textOpacity: 100,
        textShadow: "outline",
        textBgColor: "#000000",
        textBgOpacity: 0,
        displayBgOpacity: 0,
        backdropBlur: 0,
        borderRadius: 2,
        paddingScale: 90,
        baseFontScale: 4.2,
        bottomOffset: 1,
      },
    },
    {
      id: "high-contrast-box",
      name: "High Contrast Box",
      appearance: {
        ...DEFAULT_SUBTITLE_APPEARANCE,
        fontFamily: "mono-sans",
        fontSize: 90,
        textColor: "#ffffff",
        textOpacity: 100,
        textShadow: "none",
        textBgColor: "#000000",
        textBgOpacity: 90,
        displayBgOpacity: 0,
        backdropBlur: 0,
        borderRadius: 4,
        paddingScale: 100,
        baseFontScale: 4.0,
        bottomOffset: 2,
      },
    },
  ];

export const normalizeSubtitleColor = (hex: string): string =>
  hex.trim().toLowerCase();

export const resolveSubtitleColorLabel = (hex: string): string => {
  const normalized = normalizeSubtitleColor(hex);
  return (
    SUBTITLE_COLOR_SWATCHES.find((swatch) => swatch.value === normalized)
      ?.label ?? "Custom"
  );
};

export const resolveSubtitleColorRadioValue = (hex: string): string => {
  const normalized = normalizeSubtitleColor(hex);
  return SUBTITLE_COLOR_SWATCHES.some((swatch) => swatch.value === normalized)
    ? normalized
    : "custom";
};

export const subtitleAppearancesEqual = (
  left: SubtitleAppearance,
  right: SubtitleAppearance,
): boolean =>
  (
    Object.keys(DEFAULT_SUBTITLE_APPEARANCE) as Array<keyof SubtitleAppearance>
  ).every((key) => left[key] === right[key]);

export const resolveSubtitleAppearancePreset = (
  appearance: SubtitleAppearance,
): SubtitleAppearancePreset | null =>
  SUBTITLE_APPEARANCE_PRESETS.find((preset) =>
    subtitleAppearancesEqual(appearance, preset.appearance),
  ) ?? null;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampSubtitleAppearance = (
  appearance: SubtitleAppearance,
): SubtitleAppearance => ({
  fontFamily: appearance.fontFamily,
  fontSize: clamp(appearance.fontSize, 50, 200),
  lineHeight: clamp(appearance.lineHeight, 100, 200),
  textColor: appearance.textColor,
  textOpacity: clamp(appearance.textOpacity, 0, 100),
  textShadow: appearance.textShadow,
  textBgColor: appearance.textBgColor,
  textBgOpacity: clamp(appearance.textBgOpacity, 0, 100),
  displayBgColor: appearance.displayBgColor,
  displayBgOpacity: clamp(appearance.displayBgOpacity, 0, 100),
  backdropBlur: clamp(appearance.backdropBlur, 0, 24),
  borderRadius: clamp(appearance.borderRadius, 0, 16),
  paddingScale: clamp(appearance.paddingScale, 50, 150),
  baseFontScale: clamp(appearance.baseFontScale, 2, 8),
  bottomOffset: clamp(appearance.bottomOffset, 0, 12),
});

const hexToRgb = (hex: string): string => {
  const { style } = new Option();
  style.color = hex;
  const match = style.color.match(/\((.*?)\)/);
  return match?.[1]?.replace(/,/g, " ") ?? "255 255 255";
};

export const resolveSubtitleFontFamily = (
  family: SubtitleFontFamily,
): string => {
  switch (family) {
    case "mono-serif":
      return '"Courier New", Courier, "Nimbus Mono L", "Cutive Mono", monospace';
    case "mono-sans":
      return '"Deja Vu Sans Mono", "Lucida Console", Monaco, Consolas, "PT Mono", monospace';
    case "pro-sans":
      return 'Roboto, "Arial Unicode Ms", Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif';
    case "casual":
      return '"Comic Sans MS", Impact, Handlee, fantasy';
    case "cursive":
      return '"Monotype Corsiva", "URW Chancery L", "Apple Chancery", "Dancing Script", cursive';
    case "capitals":
      return '"Arial Unicode Ms", Arial, Helvetica, Verdana, "Marcellus SC", sans-serif';
    default:
      return '"Times New Roman", Times, Georgia, Cambria, "PT Serif Caption", serif';
  }
};

export const resolveSubtitleTextShadow = (
  shadow: SubtitleTextShadow,
): string => {
  switch (shadow) {
    case "drop-shadow":
      return "rgb(34, 34, 34) 1.86389px 1.86389px 2.79583px, rgb(34, 34, 34) 1.86389px 1.86389px 3.72778px, rgb(34, 34, 34) 1.86389px 1.86389px 4.65972px";
    case "raised":
      return "rgb(34, 34, 34) 1px 1px, rgb(34, 34, 34) 2px 2px";
    case "depressed":
      return "rgb(204, 204, 204) 1px 1px, rgb(34, 34, 34) -1px -1px";
    case "outline":
      return "rgb(34, 34, 34) 0px 0px 1.86389px, rgb(34, 34, 34) 0px 0px 1.86389px, rgb(34, 34, 34) 0px 0px 1.86389px, rgb(34, 34, 34) 0px 0px 1.86389px, rgb(34, 34, 34) 0px 0px 1.86389px";
    default:
      return "";
  }
};

const percentToRatio = (percent: number): string => (percent / 100).toString();

export const applySubtitleAppearanceToElement = (
  element: HTMLElement,
  appearance: SubtitleAppearance,
): void => {
  const config = clampSubtitleAppearance(appearance);
  const style = element.style;

  style.setProperty(
    "--media-cue-font-size",
    `calc(var(--overlay-height) / 100 * ${config.baseFontScale})`,
  );
  style.setProperty("--media-user-font-size", percentToRatio(config.fontSize));
  style.setProperty(
    "--media-user-font-family",
    resolveSubtitleFontFamily(config.fontFamily),
  );
  style.setProperty(
    "--media-user-font-variant",
    config.fontFamily === "capitals" ? "small-caps" : "",
  );
  style.setProperty(
    "--media-cue-line-height",
    percentToRatio(config.lineHeight),
  );
  style.setProperty(
    "--media-user-text-color",
    `rgb(${hexToRgb(config.textColor)} / var(--media-user-text-opacity, 1))`,
  );
  style.setProperty(
    "--media-user-text-opacity",
    percentToRatio(config.textOpacity),
  );
  style.setProperty(
    "--media-user-text-shadow",
    resolveSubtitleTextShadow(config.textShadow),
  );
  style.setProperty(
    "--media-user-text-bg",
    `rgb(${hexToRgb(config.textBgColor)} / var(--media-user-text-bg-opacity, 1))`,
  );
  style.setProperty(
    "--media-user-text-bg-opacity",
    percentToRatio(config.textBgOpacity),
  );
  style.setProperty(
    "--media-user-display-bg",
    `rgb(${hexToRgb(config.displayBgColor)} / var(--media-user-display-bg-opacity, 1))`,
  );
  style.setProperty(
    "--media-user-display-bg-opacity",
    percentToRatio(config.displayBgOpacity),
  );
  style.setProperty(
    "--media-cue-backdrop",
    config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : "none",
  );
  style.setProperty("--media-cue-border-radius", `${config.borderRadius}px`);
  style.setProperty(
    "--media-cue-padding-x",
    `calc(var(--cue-font-size, 1em) * ${percentToRatio(config.paddingScale)} * 0.6)`,
  );
  style.setProperty(
    "--media-cue-padding-y",
    `calc(var(--cue-font-size, 1em) * ${percentToRatio(config.paddingScale)} * 0.4)`,
  );
  style.setProperty("--media-captions-padding", `${config.bottomOffset}%`);
};

export const clearSubtitleAppearanceFromElement = (
  element: HTMLElement,
): void => {
  const properties = [
    "--media-cue-font-size",
    "--media-user-font-size",
    "--media-user-font-family",
    "--media-user-font-variant",
    "--media-cue-line-height",
    "--media-user-text-color",
    "--media-user-text-opacity",
    "--media-user-text-shadow",
    "--media-user-text-bg",
    "--media-user-text-bg-opacity",
    "--media-user-display-bg",
    "--media-user-display-bg-opacity",
    "--media-cue-backdrop",
    "--media-cue-border-radius",
    "--media-cue-padding-x",
    "--media-cue-padding-y",
    "--media-captions-padding",
  ];

  for (const property of properties) {
    element.style.removeProperty(property);
  }
};

export const mergeSubtitleAppearance = (
  current: SubtitleAppearance,
  patch: Partial<SubtitleAppearance>,
): SubtitleAppearance => clampSubtitleAppearance({ ...current, ...patch });

export const isDefaultSubtitleAppearance = (
  appearance: SubtitleAppearance,
): boolean =>
  (
    Object.keys(DEFAULT_SUBTITLE_APPEARANCE) as Array<keyof SubtitleAppearance>
  ).every((key) => appearance[key] === DEFAULT_SUBTITLE_APPEARANCE[key]);
