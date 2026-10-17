"use client";

import type { ReactNode } from "react";

import { LiveProgramGuide } from "@/components/live/live-program-guide";
import { LiveNowPlayingStrip } from "@/components/live/live-now-playing-strip";
import { LiveTvGuideProvider } from "@/components/live/live-tv-guide-context";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

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
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {selectedChannel ? (
          <LiveNowPlayingStrip channel={selectedChannel} />
        ) : null}

        <div className="aspect-video w-full bg-black">{player}</div>
      </div>
      <LiveProgramGuide
        channels={channels}
        categories={categories}
        loadingMore={loadingMoreChannels}
        refreshing={refreshing}
        onRefresh={onRefresh}
        selectedChannelId={selectedChannelId}
        onSelectChannel={onSelectChannel}
        query={query}
        onQueryChange={onQueryChange}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
      />
    </LiveTvGuideProvider>
  );
}
