"use client";

import { CheckboxGroup } from "@/components/ffs/settings";
import { Input } from "@/components/ui/input";
import { PROVIDER_FLAG_DEFINITIONS } from "@/lib/flags/flag-catalog";
import type { AdminFlagState } from "@/lib/flags/flag-catalog";
import { useMemo, useState } from "react";

type ProviderMatrixPanelProps = {
  flags: AdminFlagState;
  onChange: (key: string, value: boolean) => void;
  onBulkChange: (keys: string[], value: boolean) => void;
};

type Section = {
  title: string;
  kind: "embed" | "scrape.tmdb" | "scrape.anime";
};

const SECTIONS: Section[] = [
  { title: "Embed servers", kind: "embed" },
  { title: "TMDB scrape", kind: "scrape.tmdb" },
  { title: "Anime scrape", kind: "scrape.anime" },
];

export function ProviderMatrixPanel({
  flags,
  onChange,
  onBulkChange,
}: ProviderMatrixPanelProps) {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS.map((section) => {
      const defs = PROVIDER_FLAG_DEFINITIONS.filter(
        (d) => d.providerKind === section.kind,
      ).filter(
        (d) =>
          !q ||
          d.label.toLowerCase().includes(q) ||
          d.providerId?.toLowerCase().includes(q),
      );
      return { ...section, defs };
    });
  }, [query]);

  return (
    <div className="space-y-8">
      <Input
        placeholder="Search providers…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 max-w-md border-border bg-transparent text-sm shadow-none"
      />
      {filteredSections.map((section) => (
        <div key={section.kind} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-foreground">
              {section.title}
              <span className="ml-2 font-normal text-muted-foreground">
                ({section.defs.length})
              </span>
            </h3>
          </div>
          <CheckboxGroup
            items={section.defs.map((def) => ({
              id: def.key,
              label: def.label,
              hint: def.providerId,
              checked: flags[def.key] ?? def.defaultValue,
              onCheckedChange: (value) => onChange(def.key, value),
            }))}
            onEnableAll={() =>
              onBulkChange(
                section.defs.map((d) => d.key),
                true,
              )
            }
            onDisableAll={() =>
              onBulkChange(
                section.defs.map((d) => d.key),
                false,
              )
            }
          />
        </div>
      ))}
    </div>
  );
}
