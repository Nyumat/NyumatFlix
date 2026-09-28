"use client";

import { SettingsCheckboxRow } from "@/components/ffs/settings";
import {
  applyPlaybackMutualExclusion,
  GLOBAL_FLAG_DEFINITIONS,
} from "@/lib/flags/flag-catalog";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";

type GlobalTogglesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const PLAYBACK_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter(
  (d) => d.section === "playback",
);

export function GlobalTogglesPanel({
  flags,
  onChange,
}: GlobalTogglesPanelProps) {
  const handleChange = (key: string, value: boolean) => {
    const merged = applyPlaybackMutualExclusion(
      { ...flags, [key]: value },
      key,
    );

    for (const def of PLAYBACK_FLAGS) {
      const flagKey = def.key;
      const previous = flags[flagKey] ?? def.defaultValue;
      const next = merged[flagKey] ?? def.defaultValue;
      if (previous !== next) {
        onChange(flagKey, next);
      }
    }
  };

  return (
    <>
      {PLAYBACK_FLAGS.map((def) => (
        <SettingsCheckboxRow
          key={def.key}
          id={def.key}
          label={def.label}
          description={def.description}
          checked={flags[def.key] ?? def.defaultValue}
          onCheckedChange={(value) => handleChange(def.key, value)}
        />
      ))}
    </>
  );
}
