"use client";

import { SettingsCheckboxRow } from "@/components/ffs/settings";
import { GLOBAL_FLAG_DEFINITIONS } from "@/lib/flags/flag-catalog";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";

type SurfacesTogglesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const SURFACE_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter(
  (d) => d.section === "surfaces",
);

export function SurfacesTogglesPanel({
  flags,
  onChange,
}: SurfacesTogglesPanelProps) {
  return (
    <>
      {SURFACE_FLAGS.map((def) => (
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
