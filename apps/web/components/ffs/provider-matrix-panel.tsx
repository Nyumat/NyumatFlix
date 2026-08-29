"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FfsToggleRow } from "@/components/ffs/ffs-toggle-row";
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
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Provider matrix</CardTitle>
        <CardDescription>
          Show or hide providers in the server selector and scrape dispatch.
        </CardDescription>
        <Input
          placeholder="Search providers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2 max-w-md border-white/15 bg-black/30"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {filteredSections.map((section) => (
          <div key={section.kind} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white/90">
                {section.title}
                <span className="ml-2 font-normal text-white/45">
                  ({section.defs.length})
                </span>
              </h3>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/15 bg-transparent text-xs"
                  onClick={() =>
                    onBulkChange(
                      section.defs.map((d) => d.key),
                      true,
                    )
                  }
                >
                  Enable all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/15 bg-transparent text-xs"
                  onClick={() =>
                    onBulkChange(
                      section.defs.map((d) => d.key),
                      false,
                    )
                  }
                >
                  Disable all
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {section.defs.map((def) => (
                <FfsToggleRow
                  key={def.key}
                  label={`${def.label} (${def.providerId})`}
                  enabled={flags[def.key] ?? def.defaultValue}
                  onToggle={(v) => onChange(def.key, v)}
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
