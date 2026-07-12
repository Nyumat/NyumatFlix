"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FfsToggleRow } from "@/components/ffs/ffs-toggle-row";
import { GLOBAL_FLAG_DEFINITIONS } from "@/lib/flags/flag-catalog";
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
    if (key === "global.proxy_mode_only" && value) {
      onChange("global.iframe_mode_only", false);
    }
    if (key === "global.iframe_mode_only" && value) {
      onChange("global.proxy_mode_only", false);
    }
    onChange(key, value);
  };

  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Global playback & UX</CardTitle>
        <CardDescription>
          Site-wide playback mode, hero, and Live TV defaults.
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
