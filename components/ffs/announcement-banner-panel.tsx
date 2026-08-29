"use client";

import { AnnouncementBannerSurface } from "@/components/layout/announcement-banner-surface";
import { FfsToggleRow } from "@/components/ffs/ffs-toggle-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ANNOUNCEMENT_ICON_NAMES,
  type AnnouncementBannerConfig,
  type AnnouncementIconName,
} from "@/lib/flags/announcement-banner";
import {
  announcementBannerConfigToJsx,
  parseAnnouncementBannerJsx,
} from "@/lib/flags/announcement-banner-jsx";
import { Check, Code2, Eye, Monitor, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  config: AnnouncementBannerConfig;
  onEnabledChange: (enabled: boolean) => void;
  onConfigChange: (config: AnnouncementBannerConfig) => void;
};

export function AnnouncementBannerPanel({
  enabled,
  config,
  onEnabledChange,
  onConfigChange,
}: Props) {
  const [source, setSource] = useState(() =>
    announcementBannerConfigToJsx(config),
  );
  const [sourceError, setSourceError] = useState<string | null>(null);
  const sourceHasFocus = useRef(false);

  useEffect(() => {
    if (!sourceHasFocus.current) {
      setSource(announcementBannerConfigToJsx(config));
      setSourceError(null);
    }
  }, [config]);

  const replaceConfig = (next: AnnouncementBannerConfig) => {
    onConfigChange(next);
    if (!sourceHasFocus.current) {
      setSource(announcementBannerConfigToJsx(next));
      setSourceError(null);
    }
  };

  const update = <K extends keyof AnnouncementBannerConfig>(
    key: K,
    value: AnnouncementBannerConfig[K],
  ) => replaceConfig({ ...config, [key]: value });

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    const result = parseAnnouncementBannerJsx(nextSource);
    setSourceError(result.error);
    if (result.config) onConfigChange(result.config);
  };

  const finishSourceEditing = () => {
    sourceHasFocus.current = false;
    const result = parseAnnouncementBannerJsx(source);
    if (result.config) {
      setSource(announcementBannerConfigToJsx(result.config));
      setSourceError(null);
    }
  };

  return (
    <Card className="overflow-hidden border-white/10 bg-black/40">
      <CardHeader className="border-b border-white/10 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-1.5">
            <CardTitle className="text-xl">Announcement editor</CardTitle>
            <CardDescription className="max-w-[68ch] leading-relaxed">
              Design the exact banner visitors will see. Fields and JSX stay in
              sync instantly; changes go live only after you save.
            </CardDescription>
          </div>
          <div
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70"
            aria-live="polite"
          >
            <span
              className={`size-2 rounded-full ${enabled ? "bg-emerald-400" : "bg-white/25"}`}
              aria-hidden
            />
            {enabled ? "Published after save" : "Hidden on site"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8 p-0">
        <section
          aria-labelledby="banner-preview-heading"
          className="space-y-3 p-6 pb-0"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-white/55" aria-hidden />
              <h4
                id="banner-preview-heading"
                className="text-sm font-semibold text-white"
              >
                Live site preview
              </h4>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
              <Monitor className="size-3.5" aria-hidden />
              Responsive canvas
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#070708] shadow-[0_18px_50px_rgba(0,0,0,0.26)]">
            <div
              className="flex h-9 items-center gap-1.5 border-b border-white/8 px-4"
              aria-hidden
            >
              <span className="size-2 rounded-full bg-white/15" />
              <span className="size-2 rounded-full bg-white/10" />
              <span className="size-2 rounded-full bg-white/10" />
              <span className="ml-3 text-[11px] font-medium text-white/30">
                nyumatflix.com
              </span>
            </div>
            <AnnouncementBannerSurface config={config} preview />
            <div
              className="flex h-16 items-center justify-between px-6 text-white/20"
              aria-hidden
            >
              <div className="h-2.5 w-24 rounded bg-current" />
              <div className="flex gap-2">
                <div className="size-8 rounded-lg border border-current" />
                <div className="size-8 rounded-lg border border-current" />
                <div className="size-8 rounded-lg border border-current" />
              </div>
            </div>
          </div>
        </section>

        <div className="grid border-t border-white/10 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)]">
          <section
            aria-labelledby="banner-fields-heading"
            className="space-y-6 p-6 lg:border-r lg:border-white/10"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4
                  id="banner-fields-heading"
                  className="text-sm font-semibold text-white"
                >
                  Properties
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Edit visually, with safe validation.
                </p>
              </div>
            </div>

            <FfsToggleRow
              label="Show banner"
              description="Publish this announcement site-wide"
              enabled={enabled}
              onToggle={onEnabledChange}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <BannerField
                id="announcement-banner-title"
                label="Title"
                className="sm:col-span-2"
              >
                <Input
                  id="announcement-banner-title"
                  value={config.title}
                  maxLength={100}
                  placeholder="A short headline"
                  onChange={(event) => update("title", event.target.value)}
                />
              </BannerField>
              <BannerField
                id="announcement-banner-message"
                label="Message"
                className="sm:col-span-2"
              >
                <Input
                  id="announcement-banner-message"
                  value={config.message}
                  maxLength={280}
                  placeholder="Add supporting context"
                  onChange={(event) => update("message", event.target.value)}
                />
              </BannerField>
              <BannerField id="announcement-banner-icon" label="Lucide icon">
                <select
                  id="announcement-banner-icon"
                  value={config.icon}
                  onChange={(event) =>
                    update("icon", event.target.value as AnnouncementIconName)
                  }
                  className="flex h-10 w-full rounded-md border border-white/25 bg-black/30 px-3 py-2 text-sm text-white shadow-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {ANNOUNCEMENT_ICON_NAMES.map((icon) => (
                    <option key={icon} value={icon} className="bg-zinc-950">
                      {icon}
                    </option>
                  ))}
                </select>
              </BannerField>
              <BannerField id="announcement-banner-id" label="Release ID">
                <Input
                  id="announcement-banner-id"
                  value={config.id}
                  maxLength={64}
                  onChange={(event) => update("id", event.target.value)}
                />
              </BannerField>
              <BannerField
                id="announcement-banner-link-label"
                label="Action label"
              >
                <Input
                  id="announcement-banner-link-label"
                  value={config.linkLabel}
                  maxLength={40}
                  placeholder="Optional"
                  onChange={(event) => update("linkLabel", event.target.value)}
                />
              </BannerField>
              <BannerField id="announcement-banner-link-url" label="Action URL">
                <Input
                  id="announcement-banner-link-url"
                  value={config.linkUrl}
                  maxLength={500}
                  placeholder="/updates or https://…"
                  onChange={(event) => update("linkUrl", event.target.value)}
                />
              </BannerField>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
                Color
              </p>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <ColorField
                  label="Background"
                  value={config.backgroundColor}
                  onChange={(value) => update("backgroundColor", value)}
                />
                <ColorField
                  label="Text"
                  value={config.textColor}
                  onChange={(value) => update("textColor", value)}
                />
                <ColorField
                  label="Accent"
                  value={config.accentColor}
                  onChange={(value) => update("accentColor", value)}
                />
              </div>
            </div>

            <FfsToggleRow
              label="Dismissible"
              description="Allow visitors to close this release"
              enabled={config.dismissible}
              onToggle={(value) => update("dismissible", value)}
            />
          </section>

          <section
            aria-labelledby="banner-source-heading"
            className="flex min-h-[38rem] flex-col bg-black/20 p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Code2 className="size-4 text-white/55" aria-hidden />
                  <h4
                    id="banner-source-heading"
                    className="text-sm font-semibold text-white"
                  >
                    JSX source
                  </h4>
                </div>
                <p className="mt-1.5 max-w-[58ch] text-xs leading-relaxed text-white/45">
                  Edit every rendered prop directly. This component is parsed,
                  validated, and never executed.
                </p>
              </div>
              <SourceStatus error={sourceError} />
            </div>

            <div className="relative mt-5 min-h-0 flex-1">
              <textarea
                aria-label="Announcement banner JSX"
                value={source}
                onFocus={() => {
                  sourceHasFocus.current = true;
                }}
                onBlur={finishSourceEditing}
                onChange={(event) => updateSource(event.target.value)}
                spellCheck={false}
                className="h-full min-h-[30rem] w-full resize-y rounded-xl border border-white/10 bg-[#08090b] p-4 font-mono text-[13px] leading-6 text-sky-100 shadow-inner outline-hidden transition focus:border-sky-400/45 focus:ring-2 focus:ring-sky-400/15"
              />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceStatus({ error }: { error: string | null }) {
  return error ? (
    <span className="inline-flex max-w-xs items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-300">
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {error}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300">
      <Check className="size-3.5" aria-hidden />
      Valid JSX
    </span>
  );
}

function BannerField({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `announcement-banner-${label.toLowerCase()}-color`;
  return (
    <BannerField id={id} label={label}>
      <div className="flex gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-12 shrink-0 p-1"
        />
        <Input
          aria-label={`${label} hex color`}
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </BannerField>
  );
}
