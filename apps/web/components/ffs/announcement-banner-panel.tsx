"use client";

import { AnnouncementBannerSurface } from "@/components/layout/announcement-banner-surface";
import { SettingsCheckboxRow } from "@/components/ffs/settings";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ANNOUNCEMENT_ICON_NAMES,
  type AnnouncementBannerConfig,
} from "@/lib/flags/announcement-banner";
import {
  announcementBannerConfigToJsx,
  parseAnnouncementBannerJsx,
} from "@/lib/flags/announcement-banner-jsx";
import { cn } from "@/lib/utils";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  enabled: boolean;
  config: AnnouncementBannerConfig;
  onEnabledChange: (enabled: boolean) => void;
  onConfigChange: (config: AnnouncementBannerConfig) => void;
};

const compactInputClass =
  "h-8 border-border bg-transparent text-sm shadow-none";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Changes go live only after you save.
        </p>
        <Badge variant="outline" className="text-[11px]" aria-live="polite">
          {enabled ? "Enabled" : "Hidden"}
        </Badge>
      </div>

      <section aria-labelledby="banner-preview-heading" className="space-y-2">
        <h4
          id="banner-preview-heading"
          className="text-xs font-medium text-foreground"
        >
          Preview
        </h4>
        <div className="overflow-hidden rounded-md border border-border">
          <AnnouncementBannerSurface config={config} preview />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-xs font-medium text-foreground">Content</h4>
          <div className="divide-y divide-border">
            <SettingsCheckboxRow
              id="announcement-banner-enabled"
              label="Show banner"
              description="Publish this announcement site-wide"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
            <BannerField
              id="announcement-banner-title"
              label="Title"
              className="py-3"
            >
              <Input
                id="announcement-banner-title"
                value={config.title}
                maxLength={100}
                placeholder="A short headline"
                className={compactInputClass}
                onChange={(event) => update("title", event.target.value)}
              />
            </BannerField>
            <BannerField
              id="announcement-banner-message"
              label="Message"
              className="py-3"
            >
              <Textarea
                id="announcement-banner-message"
                value={config.message}
                maxLength={280}
                placeholder="Add supporting context"
                rows={3}
                className="min-h-18 text-sm"
                onChange={(event) => update("message", event.target.value)}
              />
            </BannerField>
            <BannerField
              id="announcement-banner-link-label"
              label="Action label"
              className="py-3"
            >
              <Input
                id="announcement-banner-link-label"
                value={config.linkLabel}
                maxLength={40}
                placeholder="Optional"
                className={compactInputClass}
                onChange={(event) => update("linkLabel", event.target.value)}
              />
            </BannerField>
            <BannerField
              id="announcement-banner-link-url"
              label="Action URL"
              className="py-3"
            >
              <Input
                id="announcement-banner-link-url"
                value={config.linkUrl}
                maxLength={500}
                placeholder="/updates or https://…"
                className={cn(compactInputClass, "font-mono")}
                onChange={(event) => update("linkUrl", event.target.value)}
              />
            </BannerField>
            <SettingsCheckboxRow
              id="announcement-banner-dismissible"
              label="Dismissible"
              description="Allow visitors to close this release"
              checked={config.dismissible}
              onCheckedChange={(value) => update("dismissible", value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-medium text-foreground">Appearance</h4>
          <div className="space-y-4">
            <BannerField id="announcement-banner-icon" label="Icon">
              <Select
                value={config.icon || "none"}
                onValueChange={(value) =>
                  update(
                    "icon",
                    value === "none"
                      ? ""
                      : (value as AnnouncementBannerConfig["icon"]),
                  )
                }
              >
                <SelectTrigger className={cn(compactInputClass, "h-8")}>
                  <SelectValue placeholder="Select icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ANNOUNCEMENT_ICON_NAMES.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BannerField>
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
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-muted/40 motion-reduce:transition-none">
          <span>Advanced</span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none",
              advancedOpen && "rotate-180",
            )}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <BannerField id="announcement-banner-id" label="Release ID">
            <Input
              id="announcement-banner-id"
              value={config.id}
              maxLength={64}
              className={cn(compactInputClass, "font-mono")}
              onChange={(event) => update("id", event.target.value)}
            />
          </BannerField>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="announcement-banner-jsx">JSX source</Label>
              <SourceStatus error={sourceError} />
            </div>
            <Textarea
              id="announcement-banner-jsx"
              aria-label="Announcement banner JSX"
              value={source}
              onFocus={() => {
                sourceHasFocus.current = true;
              }}
              onBlur={finishSourceEditing}
              onChange={(event) => updateSource(event.target.value)}
              spellCheck={false}
              rows={12}
              className="min-h-64 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Parsed and validated. Never executed.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SourceStatus({ error }: { error: string | null }) {
  return error ? (
    <Badge variant="outline" className="gap-1 text-[11px] text-destructive">
      <TriangleAlert className="size-3" aria-hidden />
      Error
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[11px]">
      Valid
    </Badge>
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
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
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
          className="h-8 w-10 shrink-0 border-border bg-transparent p-1 shadow-none"
        />
        <Input
          aria-label={`${label} hex color`}
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
          className={cn(compactInputClass, "font-mono")}
        />
      </div>
    </BannerField>
  );
}
