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

import {
  isDefaultSubtitleAppearance,
  resolveSubtitleAppearancePreset,
  resolveSubtitleColorLabel,
  resolveSubtitleColorRadioValue,
  SUBTITLE_APPEARANCE_PRESETS,
  SUBTITLE_COLOR_SWATCHES,
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

const formatPercent = (value: number): string => `${Math.round(value)}%`;

const formatPx = (value: number): string => `${value.toFixed(1)}px`;

const SettingsRadioSubmenu = ({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => {
  const Icons = defaultLayoutIcons;

  return (
    <Menu.Root className="vds-menu">
      <DefaultMenuButton label={label} hint={hint} />
      <Menu.Items className="vds-menu-items">
        <Menu.RadioGroup
          className="vds-radio-group"
          value={value}
          onChange={onChange}
        >
          {options.map((option) => (
            <Menu.Radio
              key={option.value}
              className="vds-radio"
              value={option.value}
            >
              <Icons.Menu.RadioCheck className="vds-icon" />
              <span className="vds-radio-label">{option.label}</span>
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
      </Menu.Items>
    </Menu.Root>
  );
};

const SettingsColorSubmenu = ({
  label,
  color,
  onColorChange,
}: {
  label: string;
  color: string;
  onColorChange: (color: string) => void;
}) => {
  const Icons = defaultLayoutIcons;
  const radioValue = resolveSubtitleColorRadioValue(color);
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";

  return (
    <Menu.Root className="vds-menu">
      <DefaultMenuButton
        label={label}
        hint={resolveSubtitleColorLabel(color)}
      />
      <Menu.Items className="vds-menu-items">
        <Menu.RadioGroup
          className="vds-radio-group"
          value={radioValue === "custom" ? "" : radioValue}
          onChange={onColorChange}
        >
          {SUBTITLE_COLOR_SWATCHES.map((swatch) => (
            <Menu.Radio
              key={swatch.value}
              className="vds-radio"
              value={swatch.value}
            >
              <Icons.Menu.RadioCheck className="vds-icon" />
              <span className="vds-radio-label">{swatch.label}</span>
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>
        <div className="vds-menu-item flex items-center justify-between px-3 py-2">
          <span className="vds-radio-label">Custom</span>
          <input
            type="color"
            aria-label={`${label} custom`}
            value={pickerValue}
            onChange={(event) => onColorChange(event.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-white/20 bg-transparent p-0"
          />
        </div>
      </Menu.Items>
    </Menu.Root>
  );
};

const SettingsSliderSubmenu = ({
  label,
  hint,
  value,
  min,
  max,
  step,
  keyStep,
  ariaLabel,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  keyStep: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}) => {
  const Icons = defaultLayoutIcons;

  return (
    <Menu.Root className="vds-menu">
      <DefaultMenuButton label={label} hint={hint} />
      <Menu.Items className="vds-menu-items">
        <DefaultMenuSliderItem
          label={label}
          value={hint}
          UpIcon={Icons.Menu.FontSizeUp}
          DownIcon={Icons.Menu.FontSizeDown}
          isMin={value <= min}
          isMax={value >= max}
        >
          <Slider.Root
            className="vds-slider"
            min={min}
            max={max}
            step={step}
            keyStep={keyStep}
            value={value}
            aria-label={ariaLabel}
            onValueChange={onChange}
            onDragValueChange={onChange}
          >
            <DefaultSliderParts />
            <DefaultSliderSteps />
          </Slider.Root>
        </DefaultMenuSliderItem>
      </Menu.Items>
    </Menu.Root>
  );
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
  const matchedPreset = resolveSubtitleAppearancePreset(appearance);
  const fontFamilyHint =
    SUBTITLE_FONT_FAMILY_OPTIONS.find(
      (option) => option.value === appearance.fontFamily,
    )?.label ?? "Sans Serif";
  const edgeHint =
    SUBTITLE_TEXT_SHADOW_OPTIONS.find(
      (option) => option.value === appearance.textShadow,
    )?.label ?? "None";

  const handlePresetChange = (presetId: string) => {
    const preset = SUBTITLE_APPEARANCE_PRESETS.find(
      (entry) => entry.id === presetId,
    );
    if (!preset) {
      return;
    }
    onAppearanceChange(preset.appearance);
  };

  return (
    <Menu.Root className="vds-subtitle-config-menu vds-menu">
      <DefaultMenuButton label="Subtitle Settings" Icon={SlidersHorizontal} />
      <Menu.Items className="vds-subtitle-config-items vds-menu-items">
        <SettingsRadioSubmenu
          label="Preset"
          hint={matchedPreset?.name ?? "Custom"}
          value={matchedPreset?.id ?? ""}
          options={SUBTITLE_APPEARANCE_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.name,
          }))}
          onChange={handlePresetChange}
        />
        <SettingsColorSubmenu
          label="Font Color"
          color={appearance.textColor}
          onColorChange={(textColor) => onAppearanceChange({ textColor })}
        />
        <SettingsSliderSubmenu
          label="Font Opacity"
          hint={formatPercent(appearance.textOpacity)}
          value={appearance.textOpacity}
          min={10}
          max={100}
          step={1}
          keyStep={5}
          ariaLabel="Font Opacity"
          onChange={(textOpacity) => onAppearanceChange({ textOpacity })}
        />
        <SettingsSliderSubmenu
          label="Font Size"
          hint={formatPercent(appearance.fontSize)}
          value={appearance.fontSize}
          min={50}
          max={200}
          step={1}
          keyStep={5}
          ariaLabel="Font Size"
          onChange={(fontSize) => onAppearanceChange({ fontSize })}
        />
        <SettingsRadioSubmenu
          label="Font Family"
          hint={fontFamilyHint}
          value={appearance.fontFamily}
          options={SUBTITLE_FONT_FAMILY_OPTIONS}
          onChange={(fontFamily) =>
            onAppearanceChange({
              fontFamily: fontFamily as SubtitleFontFamily,
            })
          }
        />
        <SettingsRadioSubmenu
          label="Character Edge"
          hint={edgeHint}
          value={appearance.textShadow}
          options={SUBTITLE_TEXT_SHADOW_OPTIONS}
          onChange={(textShadow) =>
            onAppearanceChange({
              textShadow: textShadow as SubtitleTextShadow,
            })
          }
        />
        <SettingsColorSubmenu
          label="Background Color"
          color={appearance.textBgColor}
          onColorChange={(textBgColor) => onAppearanceChange({ textBgColor })}
        />
        <SettingsSliderSubmenu
          label="Background Opacity"
          hint={formatPercent(appearance.textBgOpacity)}
          value={appearance.textBgOpacity}
          min={0}
          max={100}
          step={1}
          keyStep={5}
          ariaLabel="Background Opacity"
          onChange={(textBgOpacity) => onAppearanceChange({ textBgOpacity })}
        />
        {hasOffsetTracks && onOffsetChange ? (
          <SettingsSliderSubmenu
            label="Subtitle Delay"
            hint={formatSubtitleOffsetLabel(offsetSeconds)}
            value={offsetSeconds}
            min={SUBTITLE_OFFSET_MIN_SECONDS}
            max={SUBTITLE_OFFSET_MAX_SECONDS}
            step={SUBTITLE_OFFSET_STEP_SECONDS}
            keyStep={SUBTITLE_OFFSET_STEP_SECONDS}
            ariaLabel="Subtitle Delay"
            onChange={onOffsetChange}
          />
        ) : null}

        <Menu.Root className="vds-menu">
          <DefaultMenuButton label="Layout" />
          <Menu.Items className="vds-menu-items">
            <SettingsSliderSubmenu
              label="Line Height"
              hint={formatPercent(appearance.lineHeight)}
              value={appearance.lineHeight}
              min={100}
              max={200}
              step={1}
              keyStep={5}
              ariaLabel="Line Height"
              onChange={(lineHeight) => onAppearanceChange({ lineHeight })}
            />
            <SettingsSliderSubmenu
              label="Padding"
              hint={formatPercent(appearance.paddingScale)}
              value={appearance.paddingScale}
              min={50}
              max={150}
              step={1}
              keyStep={5}
              ariaLabel="Padding"
              onChange={(paddingScale) => onAppearanceChange({ paddingScale })}
            />
            <SettingsSliderSubmenu
              label="Corner Radius"
              hint={formatPx(appearance.borderRadius)}
              value={appearance.borderRadius}
              min={0}
              max={16}
              step={0.5}
              keyStep={0.5}
              ariaLabel="Corner Radius"
              onChange={(borderRadius) => onAppearanceChange({ borderRadius })}
            />
            <SettingsSliderSubmenu
              label="Backdrop Blur"
              hint={formatPx(appearance.backdropBlur)}
              value={appearance.backdropBlur}
              min={0}
              max={24}
              step={0.5}
              keyStep={1}
              ariaLabel="Backdrop Blur"
              onChange={(backdropBlur) => onAppearanceChange({ backdropBlur })}
            />
            <SettingsSliderSubmenu
              label="Bottom Inset"
              hint={`${appearance.bottomOffset.toFixed(1)}%`}
              value={appearance.bottomOffset}
              min={0}
              max={12}
              step={0.1}
              keyStep={0.5}
              ariaLabel="Bottom Inset"
              onChange={(bottomOffset) => onAppearanceChange({ bottomOffset })}
            />
            <SettingsSliderSubmenu
              label="Viewport Scale"
              hint={`${appearance.baseFontScale.toFixed(2)}vh`}
              value={appearance.baseFontScale}
              min={2}
              max={8}
              step={0.05}
              keyStep={0.25}
              ariaLabel="Viewport Scale"
              onChange={(baseFontScale) =>
                onAppearanceChange({ baseFontScale })
              }
            />
          </Menu.Items>
        </Menu.Root>

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
