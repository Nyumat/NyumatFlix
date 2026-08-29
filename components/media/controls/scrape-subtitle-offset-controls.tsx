"use client";

import { Slider } from "@vidstack/react";
import {
  DefaultMenuSection,
  DefaultMenuSliderItem,
  DefaultSliderParts,
  DefaultSliderSteps,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { useEffect } from "react";

import {
  formatSubtitleOffsetLabel,
  nudgeSubtitleOffset,
  SUBTITLE_OFFSET_MAX_SECONDS,
  SUBTITLE_OFFSET_MIN_SECONDS,
  SUBTITLE_OFFSET_STEP_SECONDS,
} from "@/lib/playback/subtitle-offset";

export type SubtitleOffsetControlProps = {
  offsetSeconds: number;
  onOffsetChange: (seconds: number) => void;
  visible: boolean;
};

export function useSubtitleOffsetKeyboardShortcuts({
  offsetSeconds,
  onOffsetChange,
  visible,
}: SubtitleOffsetControlProps): void {
  useEffect(() => {
    if (!visible) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (event.key === "[") {
        event.preventDefault();
        onOffsetChange(nudgeSubtitleOffset(offsetSeconds, -1, event.shiftKey));
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        onOffsetChange(nudgeSubtitleOffset(offsetSeconds, 1, event.shiftKey));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [offsetSeconds, onOffsetChange, visible]);
}

export function ScrapeSubtitleOffsetSlider({
  offsetSeconds,
  onOffsetChange,
  visible,
}: SubtitleOffsetControlProps) {
  if (!visible) {
    return null;
  }

  const label = "Subtitle Delay";
  const value = formatSubtitleOffsetLabel(offsetSeconds);
  const Icons = defaultLayoutIcons;

  return (
    <DefaultMenuSliderItem
      label={label}
      value={value}
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
        aria-label={label}
        onValueChange={onOffsetChange}
        onDragValueChange={onOffsetChange}
      >
        <DefaultSliderParts />
        <DefaultSliderSteps />
      </Slider.Root>
    </DefaultMenuSliderItem>
  );
}

export function ScrapeSubtitleOffsetCaptionsMenuItem({
  offsetSeconds,
  onOffsetChange,
  visible,
}: SubtitleOffsetControlProps) {
  if (!visible) {
    return null;
  }

  const label = "Subtitle Delay";
  const value = formatSubtitleOffsetLabel(offsetSeconds);

  return (
    <DefaultMenuSection label={label} value={value}>
      <ScrapeSubtitleOffsetSlider
        offsetSeconds={offsetSeconds}
        onOffsetChange={onOffsetChange}
        visible={visible}
      />
    </DefaultMenuSection>
  );
}
