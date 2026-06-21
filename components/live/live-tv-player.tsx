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
import { useCallback } from "react";

import { LiveChannelSidebar } from "@/components/live/live-channel-sidebar";
import { LiveTvGuideProvider } from "@/components/live/live-tv-guide-context";
import { LiveVideoLayout } from "@/components/live/live-video-layout";
import { useAdaptiveLiveHls } from "@/hooks/use-adaptive-live-hls";
import { buildLiveHlsConfig } from "@/lib/live/adaptive-hls";
import { buildLiveChannelShareUrl } from "@/lib/live/channel-slugs";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { cn } from "@/lib/utils";

import "./live-hls-player.css";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

type LiveTvPlayerProps = {
  categories: LiveGuideCategory[];
  channels: LiveChannel[];
  loadingMoreChannels?: boolean;
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

const configureHlsProvider = (
  provider: MediaProviderAdapter | null,
  config: ReturnType<typeof buildLiveHlsConfig>,
) => {
  if (!provider || !isHLSProvider(provider)) {
    return;
  }

  provider.library = Hls;
  provider.config = config;
};

export function LiveTvPlayer({
  categories,
  channels,
  loadingMoreChannels = false,
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
  const { hlsConfig, playerKey, onHlsError, onPlaying } =
    useAdaptiveLiveHls(playUrl);

  const handleProviderChange = useCallback(
    (provider: MediaProviderAdapter | null) => {
      configureHlsProvider(provider, hlsConfig);
    },
    [hlsConfig],
  );

  const shareUrl = selectedChannel
    ? buildLiveChannelShareUrl(selectedChannel)
    : null;

  return (
    <LiveTvGuideProvider shareUrl={shareUrl}>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 shadow-2xl shadow-black/35 backdrop-blur-md">
        <div className="flex flex-col xl:relative">
          <div className="relative min-w-0 bg-black xl:pr-[320px]">
            <div className="aspect-video w-full">
              {playUrl ? (
                <MediaPlayer
                  key={playerKey}
                  className="nyumat-live-player h-full w-full"
                  src={playUrl}
                  title={selectedChannel?.name}
                  poster={poster ?? undefined}
                  streamType="live"
                  autoPlay
                  playsInline
                  load="eager"
                  onHlsError={onHlsError}
                  onPlaying={onPlaying}
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

          <LiveChannelSidebar
            categories={categories}
            channels={channels}
            loadingMore={loadingMoreChannels}
            className={cn(
              "max-xl:max-h-[min(50vh,28rem)] max-xl:w-full max-xl:border-t max-xl:border-l-0",
              "xl:absolute xl:inset-y-0 xl:right-0 xl:z-30 xl:flex xl:w-[320px] xl:max-h-none xl:border-l xl:border-t-0",
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
