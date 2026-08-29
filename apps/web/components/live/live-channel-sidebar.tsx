"use client";

import { AlertTriangle, RefreshCw, Search, Tv, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

const formatEventTime = (value: string | null) => {
  if (!value) {
    return "Live";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "Live";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
};

type LiveChannelSidebarProps = {
  categories: LiveGuideCategory[];
  channels: LiveChannel[];
  className?: string;
  onCategoryChange: (categoryId: string) => void;
  onClose?: () => void;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onSelectChannel: (channel: LiveChannel) => void;
  query: string;
  loadingMore?: boolean;
  refreshing: boolean;
  selectedCategory: string;
  selectedChannelId: string | null;
  showClose?: boolean;
};

export function LiveChannelSidebar({
  categories,
  channels,
  className,
  onCategoryChange,
  onClose,
  onRefresh,
  onQueryChange,
  onSelectChannel,
  query,
  loadingMore = false,
  refreshing,
  selectedCategory,
  selectedChannelId,
  showClose = false,
}: LiveChannelSidebarProps) {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-[min(300px,82vw)] shrink-0 flex-col border-border bg-card/95 backdrop-blur-xl xl:w-[320px] xl:border-l",
        className,
      )}
    >
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search channels"
              className="h-8 rounded-[7px] border-border bg-background/50 pl-8 text-sm"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-[7px] text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh channels"
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
            />
          </Button>
          {showClose && onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-[7px] text-muted-foreground hover:text-foreground xl:hidden"
              onClick={onClose}
              aria-label="Close channels"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 max-xl:scrollbar-hidden">
          <CategoryButton
            active={selectedCategory === "all"}
            label="All"
            onClick={() => onCategoryChange("all")}
          />
          {categories.map((item) => (
            <CategoryButton
              key={item.id}
              active={selectedCategory === item.id}
              label={item.name}
              onClick={() => onCategoryChange(item.id)}
            />
          ))}
        </div>
      </div>

      {loadingMore ? (
        <p className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
          Loading more channels...
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {channels.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                active={channel.id === selectedChannelId}
                onSelect={() => onSelectChannel(channel)}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-muted/20 px-4 text-center">
            <Search className="mb-2 size-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              No channels found
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "h-6 shrink-0 rounded-full px-2.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ChannelRow({
  active,
  channel,
  onSelect,
}: {
  active: boolean;
  channel: LiveChannel;
  onSelect: () => void;
}) {
  const disabled = !channel.playUrl;

  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-[7px] px-2 py-1.5 text-left transition",
        "hover:bg-white/[0.06]",
        "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-primary/12 hover:bg-primary/15",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
      )}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
    >
      <ChannelLogo channel={channel} />

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-foreground",
              active && "text-primary",
            )}
          >
            {channel.name}
          </p>
          {channel.kind === "event" && (
            <Badge className="hidden h-4 shrink-0 rounded-[5px] border-amber-300/20 bg-amber-400/15 px-1 text-[9px] font-semibold text-amber-200 sm:inline-flex">
              Event
            </Badge>
          )}
        </div>
        <p className="truncate text-[11px] leading-tight text-muted-foreground/70">
          {channel.unavailableReason ??
            (channel.kind === "event"
              ? formatEventTime(channel.startsAt)
              : channel.categoryName)}
        </p>
      </div>

      {disabled ? (
        <AlertTriangle className="size-3.5 shrink-0 text-amber-300/80" />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-transparent transition group-hover:bg-muted-foreground/40",
            active && "bg-primary group-hover:bg-primary",
          )}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function ChannelLogo({ channel }: { channel: LiveChannel }) {
  const [failed, setFailed] = useState(false);

  if (!channel.logoUrl || failed) {
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-white/5 text-muted-foreground">
        <Tv className="size-4" strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] border border-white/10 bg-white/5 p-1">
      <img
        src={channel.logoUrl}
        alt=""
        className="max-h-full max-w-full object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
