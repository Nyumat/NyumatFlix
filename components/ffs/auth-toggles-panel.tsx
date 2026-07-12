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

type AuthTogglesPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
};

const AUTH_FLAGS = GLOBAL_FLAG_DEFINITIONS.filter((d) => d.section === "auth");

export function AuthTogglesPanel({ flags, onChange }: AuthTogglesPanelProps) {
  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Auth</CardTitle>
        <CardDescription>
          Sign-in and signup controls for nyumatflix.com.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {AUTH_FLAGS.map((def) => (
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
