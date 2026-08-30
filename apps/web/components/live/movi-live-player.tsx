"use client";

import { useCallback, useEffect, useRef } from "react";

import { LiveChannelSidebar } from "@/components/live/live-channel-sidebar";
import { LiveTvGuideProvider } from "@/components/live/live-tv-guide-context";
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
import { cn } from "@/lib/utils";

type LiveGuideCategory = LiveChannelsResponse["categories"][number];

type MoviLivePlayerProps = {
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
    <LiveTvGuideProvider shareUrl={shareUrl}>
      <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 shadow-2xl shadow-black/35 backdrop-blur-md">
        <div className="flex flex-col xl:relative">
          <div className="relative min-w-0 bg-black xl:pr-[320px]">
            <div className="aspect-video w-full">
              {playUrl ? (
                <>
                  <MoviLiveStream
                    key={playerKey}
                    playUrl={playUrl}
                    poster={poster}
                    title={selectedChannel?.name}
                    playerKey={playerKey}
                    onPlaying={handlePlaying}
                  />
                  <div className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-red-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                    Live
                  </div>
                </>
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
