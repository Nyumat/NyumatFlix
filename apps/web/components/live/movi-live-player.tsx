"use client";

import { useCallback, useEffect, useRef } from "react";

import { LiveTvShell } from "@/components/live/live-tv-shell";
import { useAdaptiveLiveHls } from "@/hooks/use-adaptive-live-hls";
import { buildLiveChannelShareUrl } from "@/lib/live/channel-slugs";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";
import { loadMoviCompat } from "@/lib/player/load-player";
import { buildMoviScrapePlaybackHeaders } from "@/lib/player/movi-scrape-headers";
import {
  applyMoviSource,
  disposeMoviPlayer,
  type MoviPlayerElement,
} from "@/lib/player/player-element";
import {
  getMoviVideoElement,
  isMoviVideoPlaybackReady,
  resetMoviProgressObservation,
} from "@/lib/player/player-playback-ready";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

type MoviLivePlayerProps = {
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

function MoviLiveStream({
  playUrl,
  poster,
  title,
  playerKey,
  onPlaying,
}: {
  playUrl: string;
  poster?: string | null;
  title?: string;
  playerKey: string;
  onPlaying: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<MoviPlayerElement | null>(null);
  const onPlayingRef = useRef(onPlaying);
  onPlayingRef.current = onPlaying;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let cancelled = false;

    void loadMoviCompat()
      .then(() => {
        if (cancelled) {
          return;
        }

        disposeMoviPlayer(playerRef.current);
        playerRef.current = null;
        container.replaceChildren();

        const el = document.createElement("movi-player") as MoviPlayerElement;
        playerRef.current = el;
        el.setAttribute("presentation", "native");
        el.setAttribute("data-movi-harness", "live");
        el.className = "nyumat-movi-live-player h-full w-full";

        const headers = buildMoviScrapePlaybackHeaders(playUrl);
        if (Object.keys(headers).length > 0) {
          el.headers = headers;
        }

        applyMoviSource(el, playUrl, poster, title);
        el.addEventListener("playing", () => {
          onPlayingRef.current();
        });
        el.addEventListener("loadeddata", () => {
          const video = getMoviVideoElement(el);
          if (video && isMoviVideoPlaybackReady(video)) {
            onPlayingRef.current();
          }
        });

        container.appendChild(el);
        resetMoviProgressObservation(el);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      disposeMoviPlayer(playerRef.current);
      if (playerRef.current) {
        resetMoviProgressObservation(playerRef.current);
      }
      playerRef.current = null;
    };
  }, [playUrl, playerKey, poster, title]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export function MoviLivePlayer({
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
}: MoviLivePlayerProps) {
  const { playerKey, onPlaying } = useAdaptiveLiveHls(playUrl);

  const handlePlaying = useCallback(() => {
    onPlaying();
  }, [onPlaying]);

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
          <MoviLiveStream
            key={playerKey}
            playUrl={playUrl}
            poster={poster}
            title={selectedChannel?.name}
            playerKey={playerKey}
            onPlaying={handlePlaying}
          />
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
