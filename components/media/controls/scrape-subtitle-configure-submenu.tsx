"use client";

import { Menu, Slider } from "@vidstack/react";
import {
  DefaultMenuButton,
  DefaultMenuSection,
  DefaultMenuSliderItem,
  DefaultSliderParts,
  DefaultSliderSteps,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";

import {
  isDefaultSubtitleAppearance,
  SUBTITLE_FONT_FAMILY_OPTIONS,
  SUBTITLE_TEXT_SHADOW_OPTIONS,
  type SubtitleAppearance,
  type SubtitleFontFamily,
  type SubtitleTextShadow,
} from "@/lib/playback/subtitle-appearance";
import {
  formatSubtitleOffsetLabel,
  SUBTITLE_OFFSET_MAX_SECONDS,
  SUBTITLE_OFFSET_MIN_SECONDS,
  SUBTITLE_OFFSET_STEP_SECONDS,
} from "@/lib/playback/subtitle-offset";

export type ScrapeSubtitleConfigureSubmenuProps = {
  appearance: SubtitleAppearance;
  onAppearanceChange: (patch: Partial<SubtitleAppearance>) => void;
  onAppearanceReset: () => void;
  offsetSeconds?: number;
  onOffsetChange?: (seconds: number) => void;
  hasOffsetTracks?: boolean;
};

export function ScrapeSubtitleConfigureSubmenu({
  appearance,
  onAppearanceChange,
  onAppearanceReset,
  offsetSeconds = 0,
  onOffsetChange,
  hasOffsetTracks = false,
}: ScrapeSubtitleConfigureSubmenuProps) {
  const isDefault = isDefaultSubtitleAppearance(appearance);
  const Icons = defaultLayoutIcons;

  const previewStyle = useMemo(() => {
    return {
      fontFamily:
        appearance.fontFamily === "mono-serif"
          ? '"Courier New", Courier, monospace'
          : appearance.fontFamily === "mono-sans"
            ? '"DejaVu Sans Mono", monospace'
            : appearance.fontFamily === "pro-serif"
              ? '"Times New Roman", Times, serif'
              : appearance.fontFamily === "casual"
                ? '"Comic Sans MS", cursive'
                : appearance.fontFamily === "cursive"
                  ? '"Dancing Script", cursive'
                  : 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: `${Math.max(12, Math.min(24, Math.round((appearance.fontSize / 100) * 15)))}px`,
      lineHeight: `${appearance.lineHeight}%`,
      color: appearance.textColor,
      opacity: appearance.textOpacity / 100,
      textShadow:
        appearance.textShadow === "drop-shadow"
          ? "rgb(0 0 0 / 0.9) 1px 1px 2px, rgb(0 0 0 / 0.8) 0px 0px 4px"
          : appearance.textShadow === "outline"
            ? "rgb(0 0 0) 1px 1px 0px, rgb(0 0 0) -1px -1px 0px, rgb(0 0 0) 1px -1px 0px, rgb(0 0 0) -1px 1px 0px"
            : appearance.textShadow === "raised"
              ? "rgb(0 0 0 / 0.9) 1px 1px 0px, rgb(0 0 0 / 0.7) 2px 2px 0px"
              : appearance.textShadow === "depressed"
                ? "rgb(255 255 255 / 0.3) 1px 1px 0px, rgb(0 0 0 / 0.9) -1px -1px 0px"
                : "none",
      backgroundColor:
        appearance.textBgOpacity > 0
          ? `color-mix(in srgb, ${appearance.textBgColor} ${appearance.textBgOpacity}%, transparent)`
          : "transparent",
      padding: `${Math.max(2, Math.round((appearance.paddingScale / 100) * 4))}px ${Math.max(4, Math.round((appearance.paddingScale / 100) * 8))}px`,
      borderRadius: `${appearance.borderRadius}px`,
      backdropFilter:
        appearance.backdropBlur > 0
          ? `blur(${appearance.backdropBlur}px)`
          : undefined,
    };
  }, [appearance]);

  return (
    <Menu.Root className="vds-subtitle-config-menu vds-menu">
      <DefaultMenuButton
        label="Configure Subtitles"
        hint={`${appearance.fontSize}%`}
        Icon={SlidersHorizontal}
      />
      <Menu.Items className="vds-subtitle-config-items vds-menu-items">
        {/* Live Mini Preview Cinema Box */}
        <div className="mx-2 my-2 overflow-hidden rounded-md border border-white/10 bg-black/70 p-3 shadow-inner">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium tracking-wide uppercase text-zinc-400">
            <span>Preview</span>
            <span>Live Style</span>
          </div>
          <div className="flex min-h-12 w-full items-center justify-center rounded bg-black/40 p-2 text-center">
            <span
              className="inline-block max-w-[95%] text-center font-medium select-none"
              style={previewStyle}
            >
              The quick brown fox jumps over the lazy dog.
            </span>
          </div>
        </div>

        {/* Timing Section (Subtitle Delay) */}
        {hasOffsetTracks && onOffsetChange ? (
          <DefaultMenuSection
            label="Timing & Delay"
            value={formatSubtitleOffsetLabel(offsetSeconds)}
          >
            <DefaultMenuSliderItem
              label="Subtitle Delay"
              value={formatSubtitleOffsetLabel(offsetSeconds)}
              UpIcon={Icons.Menu.FontSizeUp}
              DownIcon={Icons.Menu.FontSizeDown}
              isMin={offsetSeconds <= SUBTITLE_OFFSET_MIN_SECONDS}
              isMax={offsetSeconds >= SUBTITLE_OFFSET_MAX_SECONDS}
            >
              <Slider.Root
                className="vds-slider"
                min={SUBTITLE_OFFSET_MIN_SECONDS}
                max={SUBTITLE_OFFSET_MAX_SECONDS}
                step={SUBTITLE_OFFSET_STEP_SECONDS}
                keyStep={SUBTITLE_OFFSET_STEP_SECONDS}
                value={offsetSeconds}
                aria-label="Subtitle Delay"
                onValueChange={onOffsetChange}
                onDragValueChange={onOffsetChange}
              >
                <DefaultSliderParts />
                <DefaultSliderSteps />
              </Slider.Root>
            </DefaultMenuSliderItem>
          </DefaultMenuSection>
        ) : null}

        {/* Typography Section */}
        <DefaultMenuSection label="Typography">
          {/* Font Family Selection Menu */}
          <Menu.Root className="vds-menu">
            <DefaultMenuButton
              label="Font Family"
              hint={
                SUBTITLE_FONT_FAMILY_OPTIONS.find(
                  (opt) => opt.value === appearance.fontFamily,
                )?.label ?? "Sans Serif"
              }
            />
            <Menu.Items className="vds-menu-items">
              <Menu.RadioGroup
                className="vds-radio-group"
                value={appearance.fontFamily}
                onChange={(val) =>
                  onAppearanceChange({ fontFamily: val as SubtitleFontFamily })
                }
              >
                {SUBTITLE_FONT_FAMILY_OPTIONS.map((opt) => (
                  <Menu.Radio
                    key={opt.value}
                    className="vds-radio"
                    value={opt.value}
                  >
                    <Icons.Menu.RadioCheck className="vds-icon" />
                    <span className="vds-radio-label">{opt.label}</span>
                  </Menu.Radio>
                ))}
              </Menu.RadioGroup>
            </Menu.Items>
          </Menu.Root>

          {/* Continuous Font Size Slider */}
          <DefaultMenuSliderItem
            label="Font Size"
            value={`${Math.round(appearance.fontSize)}%`}
            UpIcon={Icons.Menu.FontSizeUp}
            DownIcon={Icons.Menu.FontSizeDown}
            isMin={appearance.fontSize <= 50}
            isMax={appearance.fontSize >= 200}
          >
            <Slider.Root
              className="vds-slider"
              min={50}
              max={200}
              step={1}
              keyStep={5}
              value={appearance.fontSize}
              aria-label="Font Size"
              onValueChange={(fontSize) => onAppearanceChange({ fontSize })}
              onDragValueChange={(fontSize) => onAppearanceChange({ fontSize })}
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>

          {/* Line Height Slider */}
          <DefaultMenuSliderItem
            label="Line Height"
            value={`${Math.round(appearance.lineHeight)}%`}
            UpIcon={Icons.Menu.FontSizeUp}
            DownIcon={Icons.Menu.FontSizeDown}
            isMin={appearance.lineHeight <= 100}
            isMax={appearance.lineHeight >= 200}
          >
            <Slider.Root
              className="vds-slider"
              min={100}
              max={200}
              step={1}
              keyStep={5}
              value={appearance.lineHeight}
              aria-label="Line Height"
              onValueChange={(lineHeight) => onAppearanceChange({ lineHeight })}
              onDragValueChange={(lineHeight) =>
                onAppearanceChange({ lineHeight })
              }
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>
        </DefaultMenuSection>

        {/* Text & Colors Section */}
        <DefaultMenuSection label="Color & Shadow">
          {/* Text Color Picker */}
          <div className="vds-menu-item flex items-center justify-between px-3 py-2">
            <span className="vds-menu-item-label text-xs">Text Color</span>
            <input
              type="color"
              aria-label="Text Color"
              value={appearance.textColor}
              onChange={(e) =>
                onAppearanceChange({ textColor: e.target.value })
              }
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            />
          </div>

          {/* Text Opacity Slider */}
          <DefaultMenuSliderItem
            label="Text Opacity"
            value={`${Math.round(appearance.textOpacity)}%`}
            UpIcon={Icons.Menu.OpacityUp}
            DownIcon={Icons.Menu.OpacityDown}
            isMin={appearance.textOpacity <= 10}
            isMax={appearance.textOpacity >= 100}
          >
            <Slider.Root
              className="vds-slider"
              min={10}
              max={100}
              step={1}
              keyStep={5}
              value={appearance.textOpacity}
              aria-label="Text Opacity"
              onValueChange={(textOpacity) =>
                onAppearanceChange({ textOpacity })
              }
              onDragValueChange={(textOpacity) =>
                onAppearanceChange({ textOpacity })
              }
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>

          {/* Text Shadow Submenu */}
          <Menu.Root className="vds-menu">
            <DefaultMenuButton
              label="Text Shadow"
              hint={
                SUBTITLE_TEXT_SHADOW_OPTIONS.find(
                  (opt) => opt.value === appearance.textShadow,
                )?.label ?? "None"
              }
            />
            <Menu.Items className="vds-menu-items">
              <Menu.RadioGroup
                className="vds-radio-group"
                value={appearance.textShadow}
                onChange={(val) =>
                  onAppearanceChange({ textShadow: val as SubtitleTextShadow })
                }
              >
                {SUBTITLE_TEXT_SHADOW_OPTIONS.map((opt) => (
                  <Menu.Radio
                    key={opt.value}
                    className="vds-radio"
                    value={opt.value}
                  >
                    <Icons.Menu.RadioCheck className="vds-icon" />
                    <span className="vds-radio-label">{opt.label}</span>
                  </Menu.Radio>
                ))}
              </Menu.RadioGroup>
            </Menu.Items>
          </Menu.Root>

          {/* Background Color Picker */}
          <div className="vds-menu-item flex items-center justify-between px-3 py-2">
            <span className="vds-menu-item-label text-xs">
              Background Color
            </span>
            <input
              type="color"
              aria-label="Background Color"
              value={appearance.textBgColor}
              onChange={(e) =>
                onAppearanceChange({ textBgColor: e.target.value })
              }
              className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
            />
          </div>

          {/* Background Opacity Slider */}
          <DefaultMenuSliderItem
            label="Background Opacity"
            value={`${Math.round(appearance.textBgOpacity)}%`}
            UpIcon={Icons.Menu.OpacityUp}
            DownIcon={Icons.Menu.OpacityDown}
            isMin={appearance.textBgOpacity <= 0}
            isMax={appearance.textBgOpacity >= 100}
          >
            <Slider.Root
              className="vds-slider"
              min={0}
              max={100}
              step={1}
              keyStep={5}
              value={appearance.textBgOpacity}
              aria-label="Background Opacity"
              onValueChange={(textBgOpacity) =>
                onAppearanceChange({ textBgOpacity })
              }
              onDragValueChange={(textBgOpacity) =>
                onAppearanceChange({ textBgOpacity })
              }
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>
        </DefaultMenuSection>

        {/* Layout & Position Section */}
        <DefaultMenuSection label="Layout & Position">
          {/* Bottom Inset Slider */}
          <DefaultMenuSliderItem
            label="Bottom Inset"
            value={`${appearance.bottomOffset.toFixed(1)}%`}
            UpIcon={Icons.Menu.FontSizeUp}
            DownIcon={Icons.Menu.FontSizeDown}
            isMin={appearance.bottomOffset <= 0}
            isMax={appearance.bottomOffset >= 12}
          >
            <Slider.Root
              className="vds-slider"
              min={0}
              max={12}
              step={0.1}
              keyStep={0.5}
              value={appearance.bottomOffset}
              aria-label="Bottom Inset"
              onValueChange={(bottomOffset) =>
                onAppearanceChange({ bottomOffset })
              }
              onDragValueChange={(bottomOffset) =>
                onAppearanceChange({ bottomOffset })
              }
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>

          {/* Backdrop Blur Slider */}
          <DefaultMenuSliderItem
            label="Backdrop Blur"
            value={`${appearance.backdropBlur.toFixed(1)}px`}
            UpIcon={Icons.Menu.FontSizeUp}
            DownIcon={Icons.Menu.FontSizeDown}
            isMin={appearance.backdropBlur <= 0}
            isMax={appearance.backdropBlur >= 24}
          >
            <Slider.Root
              className="vds-slider"
              min={0}
              max={24}
              step={0.5}
              keyStep={1}
              value={appearance.backdropBlur}
              aria-label="Backdrop Blur"
              onValueChange={(backdropBlur) =>
                onAppearanceChange({ backdropBlur })
              }
              onDragValueChange={(backdropBlur) =>
                onAppearanceChange({ backdropBlur })
              }
            >
              <DefaultSliderParts />
              <DefaultSliderSteps />
            </Slider.Root>
          </DefaultMenuSliderItem>
        </DefaultMenuSection>

        {/* Reset Action */}
        <DefaultMenuSection>
          <button
            type="button"
            className="vds-menu-item flex w-full items-center gap-2 text-left disabled:opacity-40"
            role="menuitem"
            disabled={isDefault}
            onClick={onAppearanceReset}
          >
            <RotateCcw className="size-3.5" />
            <span className="vds-menu-item-label">Reset Subtitle Styles</span>
          </button>
        </DefaultMenuSection>
      </Menu.Items>
    </Menu.Root>
  );
}
