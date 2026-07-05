"use client";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { scrapeServer, useServerStore } from "@/lib/stores/server-store";
import { cn } from "@/lib/utils";
import { Check, ImageIcon, ShieldOff } from "lucide-react";

type BrowseSettingsProps = {
  variant: "desktop" | "mobile";
};

const settingRowClassName =
  "flex w-full cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-card/45 p-3 text-left text-white outline-hidden transition-all hover:border-white/25 hover:bg-white/8";

export function BrowseSettings({ variant }: BrowseSettingsProps) {
  const noAdsMode = useAppSettingsStore((state) => state.noAdsMode);
  const disableHeroTrailers = useAppSettingsStore(
    (state) => state.disableHeroTrailers,
  );
  const setNoAdsMode = useAppSettingsStore((state) => state.setNoAdsMode);
  const setDisableHeroTrailers = useAppSettingsStore(
    (state) => state.setDisableHeroTrailers,
  );
  const setSelectedServer = useServerStore((state) => state.setSelectedServer);

  const handleNoAdsModeChange = (enabled: boolean) => {
    setNoAdsMode(enabled);
    if (enabled) {
      setSelectedServer(scrapeServer);
    }
  };

  if (variant === "desktop") {
    return (
      <>
        <DropdownMenuSeparator className="m-0 bg-white/8" />
        <div className="space-y-1 p-3">
          <p className="px-1 pb-1 text-xs font-normal tracking-wide text-muted-foreground">
            Settings
          </p>
          <DropdownMenuCheckboxItem
            checked={noAdsMode}
            onCheckedChange={handleNoAdsModeChange}
            onSelect={(event) => event.preventDefault()}
            className="cursor-pointer rounded-md pl-8 focus:bg-white/8 focus:text-white"
          >
            <div className="space-y-0.5">
              <span className="font-medium">No ads mode</span>
              <p className="text-xs text-muted-foreground">
                Subject to monkey patching
              </p>
            </div>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={disableHeroTrailers}
            onCheckedChange={setDisableHeroTrailers}
            onSelect={(event) => event.preventDefault()}
            className="cursor-pointer rounded-md pl-8 focus:bg-white/8 focus:text-white"
          >
            <div className="space-y-0.5">
              <span className="font-medium">Static hero</span>
              <p className="text-xs text-muted-foreground">
                Backdrop image instead of autoplay trailers
              </p>
            </div>
          </DropdownMenuCheckboxItem>
        </div>
      </>
    );
  }

  return (
    <section className="space-y-2">
      <p className="px-1 text-sm font-medium text-white/70">Settings</p>
      <div className="space-y-2">
        <MobileSettingRow
          icon={ShieldOff}
          title="No ads mode"
          description="Subject to monkey patching"
          enabled={noAdsMode}
          onToggle={() => handleNoAdsModeChange(!noAdsMode)}
        />
        <MobileSettingRow
          icon={ImageIcon}
          title="Static hero"
          description="Backdrop image instead of autoplay trailers"
          enabled={disableHeroTrailers}
          onToggle={() => setDisableHeroTrailers(!disableHeroTrailers)}
        />
      </div>
    </section>
  );
}

function MobileSettingRow({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: typeof ShieldOff;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        settingRowClassName,
        enabled && "border-primary/35 bg-primary/10 ring-1 ring-primary/20",
      )}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", enabled && "text-primary")}
        strokeWidth={1.65}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-white/55">{description}</p>
      </div>
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/20",
          enabled && "border-primary/40 bg-primary/20 text-primary",
        )}
      >
        {enabled ? <Check className="size-3" strokeWidth={2} /> : null}
      </span>
    </button>
  );
}
