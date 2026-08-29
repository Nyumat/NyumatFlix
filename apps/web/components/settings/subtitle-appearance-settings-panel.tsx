"use client";

import { useMemo } from "react";
import { RotateCcw, Type, Palette, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isDefaultSubtitleAppearance,
  resolveSubtitleFontFamily,
  resolveSubtitleTextShadow,
  SUBTITLE_FONT_FAMILY_OPTIONS,
  SUBTITLE_TEXT_SHADOW_OPTIONS,
  type SubtitleAppearance,
  type SubtitleFontFamily,
  type SubtitleTextShadow,
} from "@/lib/playback/subtitle-appearance";

type SubtitleAppearanceSettingsPanelProps = {
  appearance: SubtitleAppearance;
  onAppearanceChange: (patch: Partial<SubtitleAppearance>) => void;
  onAppearanceReset: () => void;
};

const PRESET_STYLES: Array<{
  name: string;
  patch: Partial<SubtitleAppearance>;
}> = [
  {
    name: "Classic Netflix",
    patch: {
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
    name: "Compact & Minimal",
    patch: {
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
    name: "Yellow Anime",
    patch: {
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
    name: "High Contrast Box",
    patch: {
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

export function SubtitleAppearanceSettingsPanel({
  appearance,
  onAppearanceChange,
  onAppearanceReset,
}: SubtitleAppearanceSettingsPanelProps) {
  const isDefault = isDefaultSubtitleAppearance(appearance);

  const previewStyle = useMemo(
    () =>
      ({
        fontFamily: resolveSubtitleFontFamily(appearance.fontFamily),
        fontSize: `${(appearance.fontSize / 100) * (appearance.baseFontScale / 4.5)}rem`,
        lineHeight: appearance.lineHeight / 100,
        color: appearance.textColor,
        opacity: appearance.textOpacity / 100,
        textShadow: resolveSubtitleTextShadow(appearance.textShadow),
        backgroundColor: `color-mix(in srgb, ${appearance.textBgColor} ${appearance.textBgOpacity}%, transparent)`,
        borderRadius: `${appearance.borderRadius}px`,
        backdropFilter:
          appearance.backdropBlur > 0
            ? `blur(${appearance.backdropBlur}px)`
            : undefined,
        padding: `${(appearance.paddingScale / 100) * 0.35}rem ${(appearance.paddingScale / 100) * 0.65}rem`,
        fontVariant:
          appearance.fontFamily === "capitals" ? "small-caps" : undefined,
      }) satisfies React.CSSProperties,
    [appearance],
  );

  return (
    <div className="space-y-6">
      {/* Live Preview Cinema Box */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/60 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 bg-radial-[at_center_bottom] from-white/5 to-transparent" />
        <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium tracking-wide uppercase text-zinc-300">
            Live Preview
          </span>
          <span>Scales dynamically with video resolution</span>
        </div>
        <div className="relative flex min-h-30 w-full items-end justify-center rounded-lg border border-white/5 bg-linear-to-t from-black/80 via-black/40 to-black/20 p-6">
          <span
            className="inline-block max-w-[85%] text-center font-medium select-none"
            style={previewStyle}
          >
            The quick brown fox jumps over the lazy dog.
          </span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Quick Presets
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESET_STYLES.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-white/10 bg-black/25 text-xs text-zinc-300 hover:border-white/25 hover:bg-white/5 hover:text-white"
              onClick={() => onAppearanceChange(preset.patch)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Multi-Column Configuration Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Column 1: Typography & Size */}
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 border-b border-white/8 pb-2 text-sm font-semibold text-zinc-200">
            <Type className="size-4 text-primary" />
            <span>Typography</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Font Family</label>
              <select
                className="w-full rounded-md border border-white/12 bg-black/40 px-3 py-1.5 text-xs font-medium text-zinc-200 outline-none focus:border-primary"
                value={appearance.fontFamily}
                onChange={(e) =>
                  onAppearanceChange({
                    fontFamily: e.target.value as SubtitleFontFamily,
                  })
                }
              >
                {SUBTITLE_FONT_FAMILY_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-zinc-900"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <SliderControl
              label="Font Size"
              value={appearance.fontSize}
              min={50}
              max={200}
              step={1}
              onChange={(fontSize) => onAppearanceChange({ fontSize })}
            />

            <SliderControl
              label="Line Height"
              value={appearance.lineHeight}
              min={100}
              max={200}
              step={1}
              onChange={(lineHeight) => onAppearanceChange({ lineHeight })}
            />

            <SliderControl
              label="Base Viewport Scale"
              value={appearance.baseFontScale}
              min={2.0}
              max={8.0}
              step={0.05}
              suffix="vh"
              onChange={(baseFontScale) =>
                onAppearanceChange({ baseFontScale })
              }
            />
          </div>
        </div>

        {/* Column 2: Color & Shadow */}
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 border-b border-white/8 pb-2 text-sm font-semibold text-zinc-200">
            <Palette className="size-4 text-primary" />
            <span>Color & Shadow</span>
          </div>

          <div className="space-y-3">
            <ColorControl
              label="Text Color"
              value={appearance.textColor}
              onChange={(textColor) => onAppearanceChange({ textColor })}
            />

            <SliderControl
              label="Text Opacity"
              value={appearance.textOpacity}
              min={10}
              max={100}
              step={1}
              onChange={(textOpacity) => onAppearanceChange({ textOpacity })}
            />

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Text Shadow</label>
              <select
                className="w-full rounded-md border border-white/12 bg-black/40 px-3 py-1.5 text-xs font-medium text-zinc-200 outline-none focus:border-primary"
                value={appearance.textShadow}
                onChange={(e) =>
                  onAppearanceChange({
                    textShadow: e.target.value as SubtitleTextShadow,
                  })
                }
              >
                {SUBTITLE_TEXT_SHADOW_OPTIONS.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-zinc-900"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <ColorControl
              label="Background Color"
              value={appearance.textBgColor}
              onChange={(textBgColor) => onAppearanceChange({ textBgColor })}
            />

            <SliderControl
              label="Background Opacity"
              value={appearance.textBgOpacity}
              min={0}
              max={100}
              step={1}
              onChange={(textBgOpacity) =>
                onAppearanceChange({ textBgOpacity })
              }
            />
          </div>
        </div>

        {/* Column 3: Layout & Spacing */}
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 border-b border-white/8 pb-2 text-sm font-semibold text-zinc-200">
            <LayoutGrid className="size-4 text-primary" />
            <span>Layout & Position</span>
          </div>

          <div className="space-y-3">
            <SliderControl
              label="Padding Scale"
              value={appearance.paddingScale}
              min={50}
              max={150}
              step={1}
              onChange={(paddingScale) => onAppearanceChange({ paddingScale })}
            />

            <SliderControl
              label="Corner Radius"
              value={appearance.borderRadius}
              min={0}
              max={16}
              step={0.5}
              suffix="px"
              onChange={(borderRadius) => onAppearanceChange({ borderRadius })}
            />

            <SliderControl
              label="Backdrop Blur"
              value={appearance.backdropBlur}
              min={0}
              max={24}
              step={0.5}
              suffix="px"
              onChange={(backdropBlur) => onAppearanceChange({ backdropBlur })}
            />

            <SliderControl
              label="Bottom Inset"
              value={appearance.bottomOffset}
              min={0}
              max={12}
              step={0.1}
              suffix="%"
              onChange={(bottomOffset) => onAppearanceChange({ bottomOffset })}
            />
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-zinc-400">
          Changes save automatically and apply immediately across all player
          instances.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDefault}
          className="border-white/12 bg-black/25 text-xs text-zinc-300 hover:border-white/25 hover:bg-white/5 hover:text-white"
          onClick={onAppearanceReset}
        >
          <RotateCcw className="mr-2 size-3.5" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (val: number) => void;
}) {
  const displayValue = step < 1 ? Number(value.toFixed(2)) : Math.round(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">
          {displayValue}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-700 accent-primary"
      />
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase text-zinc-400">
          {value}
        </span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 cursor-pointer rounded border border-white/15 bg-transparent p-0"
        />
      </div>
    </div>
  );
}
