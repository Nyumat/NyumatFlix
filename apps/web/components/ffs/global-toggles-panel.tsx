"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FfsToggleRow } from "@/components/ffs/ffs-toggle-row";
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
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Global playback & UX</CardTitle>
        <CardDescription>
          Hard locks apply to everyone. Default flags only affect new visitors
          (until they change server in Settings).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {PLAYBACK_FLAGS.map((def) => (
          <FfsToggleRow
            key={def.key}
            label={def.label}
            description={def.description}
            enabled={flags[def.key] ?? def.defaultValue}
            onToggle={(v) => handleChange(def.key, v)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
