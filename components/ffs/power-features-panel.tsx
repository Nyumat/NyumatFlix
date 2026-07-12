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

type PowerFeaturesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const POWER_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter(
  (d) => d.section === "power",
);

export function PowerFeaturesPanel({
  flags,
  onChange,
}: PowerFeaturesPanelProps) {
  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Power / infra</CardTitle>
        <CardDescription>
          VPN egress, user settings lock, maintenance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {POWER_FLAGS.map((def) => (
          <FfsToggleRow
            key={def.key}
            label={def.label}
            description={def.description}
            enabled={flags[def.key] ?? def.defaultValue}
            onToggle={(v) => onChange(def.key, v)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
