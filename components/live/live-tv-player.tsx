"use client";

import {
  isHLSProvider,
  MediaAnnouncer,
  MediaPlayer,
  MediaProvider,
  Poster,
  type MediaProviderAdapter,
} from "@vidstack/react";
import Hls from "hls.js";
import { useCallback, useState } from "react";

import { LiveChannelSidebar } from "@/components/live/live-channel-sidebar";
import { LiveTvGuideProvider } from "@/components/live/live-tv-guide-context";
import { LiveVideoLayout } from "@/components/live/live-video-layout";
import { cn } from "@/lib/utils";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

import "./live-hls-player.css";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

type LiveTvPlayerProps = {
  categories: LiveGuideCategory[];
  channels: LiveChannel[];
  onCategoryChange: (categoryId: string) => void;
  onRefresh: () => void;
  onQueryChange: (query: string) => void;
  onSelectChannel: (channel: LiveChannel) => void;
  playUrl: string | null;
  poster?: string | null;
  query: string;
  refreshing: boolean;
  selectedCategory: string;
  selectedChannel: LiveChannel | null;
  selectedChannelId: string | null;
};

const configureHlsProvider = (provider: MediaProviderAdapter | null) => {
  if (!provider || !isHLSProvider(provider)) {
    return;
  }

  provider.library = Hls;
  provider.config = {
    enableWorker: true,
    lowLatencyMode: true,
    maxBufferLength: 24,
  };
};

export function LiveTvPlayer({
  categories,
  channels,
  onCategoryChange,
  onRefresh,
  onQueryChange,
  onSelectChannel,
  playUrl,
  poster,
  query,
  refreshing,
  selectedCategory,
  selectedChannel,
  selectedChannelId,
}: LiveTvPlayerProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      configureHlsProvider(provider);
    },
    [],
  );

  const handleSelectChannel = (channel: LiveChannel) => {
    onSelectChannel(channel);
    setGuideOpen(false);
  };

  const channelSubtitle = selectedChannel
    ? [selectedChannel.categoryName, selectedChannel.label]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <LiveTvGuideProvider guideOpen={guideOpen} setGuideOpen={setGuideOpen}>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 shadow-2xl shadow-black/35 backdrop-blur-md">
        <div className="relative">
          <div className="relative min-w-0 bg-black xl:pr-[320px]">
            <div className="aspect-video w-full">
              {playUrl ? (
                <MediaPlayer
                  key={playUrl}
                  className="nyumat-live-player h-full w-full"
                  src={playUrl}
                  title={selectedChannel?.name}
                  poster={poster ?? undefined}
                  streamType="live"
                  autoPlay
                  playsInline
                  load="eager"
                  onProviderChange={handleProviderChange}
                >
                  <MediaProvider />
                  <MediaAnnouncer />
                  <Poster className="vds-poster" alt="" />
                  <LiveVideoLayout />
                </MediaPlayer>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  Select a channel
                </div>
              )}
            </div>
          </div>

          {guideOpen ? (
            <button
              type="button"
              className="absolute inset-0 z-20 bg-black/45 xl:hidden"
              aria-label="Close channel guide"
              onClick={() => setGuideOpen(false)}
            />
          ) : null}

          <LiveChannelSidebar
            categories={categories}
            channels={channels}
            className={cn(
              "absolute inset-y-0 right-0 z-30 border-l max-xl:w-[min(300px,82vw)] max-xl:shadow-2xl max-xl:shadow-black/50 xl:w-[320px]",
              guideOpen ? "flex" : "max-xl:hidden xl:flex",
            )}
            onCategoryChange={onCategoryChange}
            onClose={() => setGuideOpen(false)}
            onRefresh={onRefresh}
            onQueryChange={onQueryChange}
            onSelectChannel={handleSelectChannel}
            query={query}
            refreshing={refreshing}
            selectedCategory={selectedCategory}
            selectedChannelId={selectedChannelId}
            showClose
            subtitle={channelSubtitle}
          />
        </div>
      </div>
    </LiveTvGuideProvider>
  );
}
