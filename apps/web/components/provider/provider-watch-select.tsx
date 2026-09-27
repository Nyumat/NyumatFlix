"use client";

import { ProviderLogoMark } from "@/components/provider/provider-logo-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { contentRowSelectTriggerClassName } from "@/lib/content-row-select-trigger";
import { cn } from "@/lib/utils";
export type ProviderWatchBrand = {
  id: number;
  name: string;
  logoPath?: string;
  localLogo?: string;
  surface: string;
};

const groupedSelectItemClassName = (index: number, lastIndex: number) => {
  if (lastIndex === 0) {
    return "rounded-xl";
  }
  if (index === 0) {
    return "rounded-t-xl rounded-b-none";
  }
  if (index === lastIndex) {
    return "rounded-b-xl rounded-t-none";
  }
  return "rounded-none";
};

export function ProviderWatchSelect({
  providers,
  value,
  onValueChange,
  onProviderPrefetch,
  onMenuOpen,
  large = false,
}: {
  providers: ProviderWatchBrand[];
  value: string;
  onValueChange: (value: string) => void;
  onProviderPrefetch?: (providerId: string) => void;
  onMenuOpen?: () => void;
  large?: boolean;
}) {
  const activeProvider =
    providers.find((provider) => String(provider.id) === value) ?? providers[0];
  const lastIndex = providers.length - 1;

  if (!activeProvider) {
    return null;
  }

  return (
    <Select
      value={String(activeProvider.id)}
      onOpenChange={(open) => {
        if (open) {
          onMenuOpen?.();
        }
      }}
      onValueChange={(next) => {
        if (next !== String(activeProvider.id)) {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        aria-label={`Streaming service: ${activeProvider.name}`}
        className={cn(
          contentRowSelectTriggerClassName(large),
          "group/trigger data-[state=open]:[&>span]:border-pink-500",
        )}
      >
        <span className="border-b-2 border-pink-500/45 pb-1 transition-colors group-hover/trigger:border-pink-500">
          <SelectValue placeholder={activeProvider.name} />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        side="bottom"
        position="popper"
        size="long-list"
        avoidCollisions={false}
        sideOffset={10}
        className="z-[60] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-border/70 p-0 shadow-xl backdrop-blur-xl [&_[data-radix-select-viewport]]:p-0"
      >
        {providers.map((provider, index) => (
          <SelectItem
            key={provider.id}
            value={String(provider.id)}
            textValue={provider.name}
            onPointerEnter={() => {
              onProviderPrefetch?.(String(provider.id));
            }}
            onFocus={() => {
              onProviderPrefetch?.(String(provider.id));
            }}
            className={cn(
              "cursor-pointer py-2.5 pl-8 pr-3 font-medium focus:bg-accent/90 data-[highlighted]:bg-accent/90 data-[state=checked]:bg-accent/50 data-[state=checked]:font-semibold",
              groupedSelectItemClassName(index, lastIndex),
              large ? "text-base" : "text-sm",
            )}
          >
            <span className="flex items-center gap-1.5">
              <ProviderLogoMark
                provider={provider}
                className="size-7 shrink-0 rounded-lg"
              />
              <span>{provider.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
