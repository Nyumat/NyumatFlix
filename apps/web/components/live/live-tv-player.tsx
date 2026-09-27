"use client";

import dynamic from "next/dynamic";
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

import { LiveTvShell } from "@/components/live/live-tv-shell";
import { LiveVideoLayout } from "@/components/live/live-video-layout";
import { useAdaptiveLiveHls } from "@/hooks/use-adaptive-live-hls";
import { useMoviPreview } from "@/hooks/use-movi-preview";
import { mergeScrapeHlsClientAuthConfig } from "@/lib/api/scrape-hls-client-auth";
import { buildLiveHlsConfig } from "@/lib/live/adaptive-hls";
import { buildLiveChannelShareUrl } from "@/lib/live/channel-slugs";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

import "./live-hls-player.css";

const MoviLivePlayer = dynamic(
  () =>
    import("@/components/live/movi-live-player").then(
      (module) => module.MoviLivePlayer,
    ),
  { ssr: false, loading: () => null },
);

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

type LiveTvPlayerProps = {
  categories: LiveGuideCategory[];
  channels: LiveChannel[];
  channelCount?: number;
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
  provider.config = mergeScrapeHlsClientAuthConfig(config);
};

export function LiveTvPlayer(props: LiveTvPlayerProps) {
  const moviPreview = useMoviPreview();

  if (moviPreview) {
    return <MoviLivePlayer {...props} />;
  }

  return <VidstackLiveTvPlayer {...props} />;
}

function VidstackLiveTvPlayer({
  categories,
  channels,
  channelCount,
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
    <LiveTvShell
      categories={categories}
      channels={channels}
      channelCount={channelCount}
      loadingMoreChannels={loadingMoreChannels}
      onCategoryChange={onCategoryChange}
      onRefresh={onRefresh}
      onQueryChange={onQueryChange}
      onSelectChannel={onSelectChannel}
      query={query}
      refreshing={refreshing}
      selectedCategory={selectedCategory}
      selectedChannel={selectedChannel}
      selectedChannelId={selectedChannelId}
      shareUrl={shareUrl}
      player={
        playUrl ? (
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
            logLevel="silent"
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
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black text-muted-foreground">
            <p className="text-sm font-medium text-foreground/80">
              Select a channel
            </p>
            <p className="text-xs text-muted-foreground">
              Pick a channel from the guide to start watching
            </p>
          </div>
        )
      }
    />
  );
}
