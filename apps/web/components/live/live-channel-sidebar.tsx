"use client";

import { AlertTriangle, RefreshCw, Search, Tv, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { cn } from "@/lib/utils";

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
  channelCount?: number;
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
  channelCount,
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
  const visibleCount = channels.length;
  const totalLabel =
    channelCount !== undefined && channelCount !== visibleCount
      ? `${visibleCount} of ${channelCount}`
      : `${visibleCount}`;

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col bg-black/30 lg:w-[320px]",
        className,
      )}
    >
      <div className="border-b border-white/10 px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-foreground">
              Channels
            </p>
            <p className="text-xs text-muted-foreground">
              {totalLabel} available
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl text-muted-foreground hover:text-foreground"
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
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground lg:hidden"
                onClick={onClose}
                aria-label="Close channels"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search channels"
            className="h-9 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-sm"
          />
        </div>

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 max-lg:scrollbar-hidden">
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
              count={item.count}
              onClick={() => onCategoryChange(item.id)}
            />
          ))}
        </div>
      </div>

      {loadingMore ? (
        <p className="border-b border-white/10 px-4 py-2 text-[11px] text-muted-foreground">
          Loading more channels...
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {channels.length > 0 ? (
          <div className="flex flex-col gap-1">
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
          <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
            <Search className="mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              No channels found
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another category or search term
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

function CategoryButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count?: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition",
        active
          ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
          : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/10 hover:text-foreground",
      )}
      onClick={onClick}
    >
      {label}
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "text-[10px] tabular-nums",
            active ? "text-primary-foreground/80" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      ) : null}
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
        "group relative flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-2 text-left transition",
        "hover:border-white/10 hover:bg-white/[0.04]",
        "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary/25 bg-primary/10 hover:bg-primary/12",
        disabled &&
          "cursor-not-allowed opacity-50 hover:border-transparent hover:bg-transparent",
      )}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
    >
      <ChannelLogo channel={channel} active={active} />

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-medium leading-tight text-foreground",
              active && "text-primary",
            )}
          >
            {channel.name}
          </p>
          {channel.kind === "event" && (
            <Badge className="hidden h-4 shrink-0 rounded-md border-amber-300/20 bg-amber-400/15 px-1 text-[9px] font-semibold text-amber-200 sm:inline-flex">
              Event
            </Badge>
          )}
        </div>
        <p className="truncate text-xs leading-tight text-muted-foreground/80">
          {channel.unavailableReason ??
            (channel.kind === "event"
              ? formatEventTime(channel.startsAt)
              : channel.categoryName)}
        </p>
      </div>

      {disabled ? (
        <AlertTriangle className="size-4 shrink-0 text-amber-300/80" />
      ) : (
        <span
          className={cn(
            "size-2 shrink-0 rounded-full bg-transparent transition",
            active && "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.65)]",
            !active && "group-hover:bg-muted-foreground/40",
          )}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function ChannelLogo({
  channel,
  active = false,
}: {
  channel: LiveChannel;
  active?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!channel.logoUrl || failed) {
    return (
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white/[0.04] text-muted-foreground",
          active ? "border-primary/25" : "border-white/10",
        )}
      >
        <Tv className="size-4" strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl border bg-white/[0.04] p-1",
        active ? "border-primary/25" : "border-white/10",
      )}
    >
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
