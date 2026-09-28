"use client";

import type { ReactNode } from "react";

import { LiveChannelSidebar } from "@/components/live/live-channel-sidebar";
import { LiveNowPlayingStrip } from "@/components/live/live-now-playing-strip";
import { LiveTvGuideProvider } from "@/components/live/live-tv-guide-context";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { cn } from "@/lib/utils";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

export type LiveTvShellProps = {
  categories: LiveGuideCategory[];
  channels: LiveChannel[];
  channelCount?: number;
  loadingMoreChannels?: boolean;
  onCategoryChange: (categoryId: string) => void;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onSelectChannel: (channel: LiveChannel) => void;
  player: ReactNode;
  query: string;
  refreshing: boolean;
  selectedCategory: string;
  selectedChannel: LiveChannel | null;
  selectedChannelId: string | null;
  shareUrl: string | null;
};

export function LiveTvShell({
  categories,
  channels,
  channelCount,
  loadingMoreChannels = false,
  onCategoryChange,
  onRefresh,
  onQueryChange,
  onSelectChannel,
  player,
  query,
  refreshing,
  selectedCategory,
  selectedChannel,
  selectedChannelId,
  shareUrl,
}: LiveTvShellProps) {
  return (
    <LiveTvGuideProvider shareUrl={shareUrl}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30 shadow-xl shadow-black/20 backdrop-blur-md">
        {selectedChannel ? (
          <LiveNowPlayingStrip channel={selectedChannel} />
        ) : null}

        <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
          <div className="relative min-w-0 self-start bg-black">
            <div className="aspect-video w-full">{player}</div>
          </div>

          <LiveChannelSidebar
            categories={categories}
            channels={channels}
            channelCount={channelCount}
            loadingMore={loadingMoreChannels}
            className={cn(
              "max-lg:max-h-[max(22rem,min(34rem,calc(100dvh-18rem)))] max-lg:w-full max-lg:border-t max-lg:border-l-0",
              "lg:h-0 lg:min-h-full lg:overflow-hidden lg:border-l lg:border-t-0",
            )}
            onCategoryChange={onCategoryChange}
            onRefresh={onRefresh}
            onQueryChange={onQueryChange}
            onSelectChannel={onSelectChannel}
            query={query}
            refreshing={refreshing}
            selectedCategory={selectedCategory}
            selectedChannelId={selectedChannelId}
          />
        </div>
      </div>
    </LiveTvGuideProvider>
  );
}
