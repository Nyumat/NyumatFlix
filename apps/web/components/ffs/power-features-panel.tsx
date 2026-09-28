"use client";

import { SettingsCheckboxRow } from "@/components/ffs/settings";
import { GLOBAL_FLAG_DEFINITIONS } from "@/lib/flags/flag-catalog";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";

type PowerFeaturesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const POWER_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter(
  (d) => d.section === "power" && !d.metadataOnly,
);

export function PowerFeaturesPanel({
  flags,
  onChange,
}: PowerFeaturesPanelProps) {
  return (
    <>
      {POWER_FLAGS.map((def) => (
        <SettingsCheckboxRow
          key={def.key}
          id={def.key}
          label={def.label}
          description={def.description}
          checked={flags[def.key] ?? def.defaultValue}
          onCheckedChange={(value) => onChange(def.key, value)}
        />
      ))}
    </>
  );
}
