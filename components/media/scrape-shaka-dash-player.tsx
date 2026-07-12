"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IntroDbSegmentControl } from "@/components/media/controls/introdb-segment-control";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import { usePlaybackProgress } from "@/hooks/use-playback-progress";
import { buildIntroDbChaptersVtt } from "@/lib/playback/introdb";
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
  imdbId?: string | null;
  className?: string;
  onFatalError?: () => void;
  onEnded?: () => Promise<boolean>;
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
  imdbId = null,
  className,
  onFatalError,
  onEnded,
}: ScrapeShakaDashPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<import("shaka-player").default.Player | null>(null);
  const [playbackState, setPlaybackState] = useState({
    currentTime: 0,
    duration: 0,
  });

  const playbackUrl = useMemo(() => absolutizeUrl(playUrl), [playUrl]);

  const { resumeTime, persist, persistImmediate } =
    usePlaybackProgress(progressKey);

  const textTracks = useMemo(
    () => buildScrapeSubtitleTracks(subtitles, referer),
    [referer, subtitles],
  );
  const { segments: introDbSegments } = useIntroDbSegments(
    progressKey,
    playbackState.duration,
    imdbId,
  );
  const introDbChapters = useMemo(
    () => buildIntroDbChaptersVtt(introDbSegments),
    [introDbSegments],
  );
  const introDbChaptersUrl = useMemo(
    () =>
      introDbChapters
        ? `data:text/vtt;charset=utf-8,${encodeURIComponent(introDbChapters)}`
        : null,
    [introDbChapters],
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
      void 0;
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

      shaka.polyfill.installAll();

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
    setPlaybackState({ currentTime: 0, duration: 0 });
  }, [playbackUrl]);

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

  // Native <video controls> only — DefaultVideoLayout requires a Vidstack
  // MediaPlayer parent and throws `$props` if rendered here.
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
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setPlaybackState({
            currentTime: video.currentTime,
            duration: video.duration || 0,
          });
        }}
        onDurationChange={(event) => {
          const video = event.currentTarget;
          setPlaybackState((state) => ({
            ...state,
            duration: state.duration || video.duration || 0,
          }));
        }}
        onTimeUpdate={(e) => {
          const video = e.currentTarget;
          setPlaybackState((state) => ({
            currentTime: video.currentTime,
            duration: state.duration || video.duration || 0,
          }));
          persist(video.currentTime, video.duration || 0);
        }}
        onEnded={(e) => {
          const video = e.currentTarget;
          persistImmediate(video.currentTime, video.duration || 0);
          void onEnded?.();
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
        {introDbChaptersUrl ? (
          <track
            src={introDbChaptersUrl}
            kind="chapters"
            label="TheIntroDB segments"
            default
          />
        ) : null}
      </video>
      <IntroDbSegmentControl
        segments={introDbSegments}
        currentTime={playbackState.currentTime}
        duration={playbackState.duration}
        isTv={progressKey.mediaType === "tv"}
        onSeek={(time) => {
          const video = videoRef.current;
          if (video) {
            video.currentTime = time;
          }
        }}
        onAdvanceToNextEpisode={onEnded}
      />
    </div>
  );
}
