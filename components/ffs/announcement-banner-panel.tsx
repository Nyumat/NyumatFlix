"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANNOUNCEMENT_ICON_NAMES,
  type AnnouncementBannerConfig,
  type AnnouncementIconName,
} from "@/lib/flags/announcement-banner";

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
  const update = <K extends keyof AnnouncementBannerConfig>(
    key: K,
    value: AnnouncementBannerConfig[K],
  ) => onConfigChange({ ...config, [key]: value });

  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="text-lg">Announcement banner</CardTitle>
        <CardDescription>
          The site has no banner while this is disabled. Change the banner ID to
          show a dismissed announcement again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FfsToggleRow
          label="Show banner"
          description="Publish this announcement site-wide"
          enabled={enabled}
          onToggle={onEnabledChange}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <BannerField label="Banner ID">
            <Input
              value={config.id}
              maxLength={64}
              onChange={(event) => update("id", event.target.value)}
            />
          </BannerField>
          <BannerField label="Lucide icon">
            <Select
              value={config.icon}
              onValueChange={(value) =>
                update("icon", value as AnnouncementIconName)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANNOUNCEMENT_ICON_NAMES.map((icon) => (
                  <SelectItem key={icon} value={icon}>
                    {icon}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </BannerField>
          <BannerField label="Title">
            <Input
              value={config.title}
              maxLength={100}
              onChange={(event) => update("title", event.target.value)}
            />
          </BannerField>
          <BannerField label="Message">
            <Input
              value={config.message}
              maxLength={280}
              onChange={(event) => update("message", event.target.value)}
            />
          </BannerField>
          <BannerField label="Link label">
            <Input
              value={config.linkLabel}
              maxLength={40}
              placeholder="Optional"
              onChange={(event) => update("linkLabel", event.target.value)}
            />
          </BannerField>
          <BannerField label="Link URL">
            <Input
              value={config.linkUrl}
              maxLength={500}
              placeholder="/updates or https://…"
              onChange={(event) => update("linkUrl", event.target.value)}
            />
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

        <FfsToggleRow
          label="Dismissible"
          description="Allow visitors to close this banner"
          enabled={config.dismissible}
          onToggle={(value) => update("dismissible", value)}
        />
      </CardContent>
    </Card>
  );
}

function BannerField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
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
  return (
    <BannerField label={label}>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-14 p-1"
        />
        <Input
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </BannerField>
  );
}
