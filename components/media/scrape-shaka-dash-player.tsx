"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { ScrapeVideoLayout } from "@/components/media/scrape-video-layout";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { buildScrapeSubtitleTracks } from "@/lib/scrape/player-sources";
import type { ScrapeSubtitle } from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

type ScrapeShakaDashPlayerProps = {
  playUrl: string;
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  title: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  className?: string;
  onFatalError?: () => void;
  onEnded?: () => void;
};

const absolutizeUrl = (url: string): string => {
  if (!url.startsWith("/")) {
    return url;
  }

  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return url;
  }
};

export function ScrapeShakaDashPlayer({
  playUrl,
  referer,
  subtitles,
  title,
  poster,
  progressKey,
  className,
  onFatalError,
  onEnded,
}: ScrapeShakaDashPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<import("shaka-player").default.Player | null>(null);

  const playbackUrl = useMemo(() => absolutizeUrl(playUrl), [playUrl]);

  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);

  const textTracks = useMemo(
    () => buildScrapeSubtitleTracks(subtitles, referer),
    [referer, subtitles],
  );

  const destroyPlayer = useCallback(async () => {
    const player = playerRef.current;
    playerRef.current = null;
    if (!player) {
      return;
    }

    try {
      await player.destroy();
    } catch {
      // ignore teardown failures
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      await destroyPlayer();

      const shaka = (await import("shaka-player")).default;
      if (cancelled) {
        return;
      }

      if (!shaka.Player.isBrowserSupported()) {
        onFatalError?.();
        return;
      }

      const player = new shaka.Player(video);
      playerRef.current = player;

      player.addEventListener("error", () => {
        onFatalError?.();
      });

      try {
        await player.load(playbackUrl);
      } catch {
        onFatalError?.();
      }
    };

    void setup();

    return () => {
      cancelled = true;
      void destroyPlayer();
    };
  }, [destroyPlayer, onFatalError, playbackUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || resumeTime <= 0) {
      return;
    }

    const apply = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }
      video.currentTime = Math.min(resumeTime, video.duration);
    };

    video.addEventListener("loadedmetadata", apply);
    return () => video.removeEventListener("loadedmetadata", apply);
  }, [resumeTime]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      <video
        ref={videoRef}
        className="h-full w-full rounded-lg bg-black"
        controls
        playsInline
        preload="auto"
        poster={poster ?? undefined}
        title={title}
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          persist(video.currentTime, video.duration || 0);
        }}
        onEnded={(e) => {
          const video = e.currentTarget;
          persistImmediate(video.currentTime, video.duration || 0);
          onEnded?.();
        }}
      >
        {textTracks
          .filter((track) => track.type === "vtt")
          .map((track) => (
            <track
              key={track.id}
              src={track.src}
              kind="subtitles"
              label={track.label}
              srcLang={track.lang}
              default={track.default}
            />
          ))}
      </video>
      <ScrapeVideoLayout />
    </div>
  );
}
