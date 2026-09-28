"use client";

import { SettingsCheckboxRow } from "@/components/ffs/settings";
import { GLOBAL_FLAG_DEFINITIONS } from "@/lib/flags/flag-catalog";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";

type AuthTogglesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const AUTH_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter((d) => d.section === "auth");

export function AuthTogglesPanel({ flags, onChange }: AuthTogglesPanelProps) {
  return (
    <>
      {AUTH_FLAGS.map((def) => (
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
