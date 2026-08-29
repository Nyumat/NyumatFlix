"use client";

import {
  MediaPlayer,
  MediaProvider,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import dynamic from "next/dynamic";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { DirectStream } from "@/lib/direct/types";
import {
  engineSourceUrl,
  engineStreamKind,
  isStreamPlayable,
  nextFallbackEngine,
  selectInitialEngine,
  type DirectPlaybackEngine,
} from "@/lib/direct/playback";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { buildScrapePlayerKey } from "@/lib/scrape/player-sources";
import { createMediaReadyHandler } from "@/lib/playback/media-ready";
import { cn } from "@/lib/utils";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

const ScrapeHlsPlayer = dynamic(
  () =>
    import("@/components/media/scrape-hls-player").then(
      (module) => module.ScrapeHlsPlayer,
    ),
  { ssr: false },
);

const MoviStreamPlayer = lazy(() =>
  import("@/components/media/movi-stream-player").then((module) => ({
    default: module.MoviStreamPlayer,
  })),
);

type CalluspiratesStreamPlayerProps = {
  stream: DirectStream;
  title?: string;
  poster?: string | null;
  className?: string;
  progressKey: PlaybackProgressKey;
  onStreamFailed: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
};

const VIDSTACK_START_TIMEOUT_MS = 30_000;

function VidstackDirectPlayer({
  stream,
  engine,
  title,
  poster,
  progressKey,
  onError,
  onMediaReady,
  onEnded,
}: {
  stream: DirectStream;
  engine: Extract<DirectPlaybackEngine, "vidstack-hls" | "vidstack-direct">;
  title?: string;
  poster?: string | null;
  progressKey?: PlaybackProgressKey | null;
  onError: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
}) {
  const sourceUrl = engineSourceUrl(stream, engine);
  const streamKind = engineStreamKind(engine, sourceUrl);

  if (engine === "vidstack-hls" && progressKey) {
    return (
      <ScrapeHlsPlayer
        key={buildScrapePlayerKey({ playUrl: sourceUrl })}
        playUrl={sourceUrl}
        streamKind={streamKind}
        title={title ?? stream.name}
        poster={poster}
        progressKey={progressKey}
        className="nyumat-direct-stream-player h-full w-full"
        autoPlay
        onFatalError={onError}
        onMediaReady={onMediaReady}
        onEnded={onEnded}
      />
    );
  }

  const [layoutReady, setLayoutReady] = useState(false);
  const playerRef = useRef<MediaPlayerInstance>(null);
  const startedRef = useRef(false);
  const settledRef = useRef(false);
  const readyRef = useRef(false);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  const markMediaReady = useCallback(() => {
    createMediaReadyHandler(onMediaReady, readyRef)();
  }, [onMediaReady]);

  const markSettled = useCallback(() => {
    settledRef.current = true;
    markMediaReady();
  }, [markMediaReady]);

  const attemptPlaybackStart = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const providerVideo =
      player.provider && "video" in player.provider
        ? player.provider.video
        : null;
    const video =
      providerVideo ??
      document.querySelector(".nyumat-direct-stream-player video");

    if (video instanceof HTMLVideoElement && video.paused === false) {
      startedRef.current = true;
      markSettled();
      return;
    }

    player.muted = false;
    player.volume = 1;
    if (video instanceof HTMLVideoElement) {
      video.muted = false;
      video.volume = 1;
      if (video.readyState < 2) {
        return;
      }
      void video
        .play()
        .then(() => {
          if (!video.paused) {
            startedRef.current = true;
            markSettled();
          }
        })
        .catch(() => undefined);
      return;
    }

    void player
      .play()
      .then(() => {
        if (!player.paused) {
          startedRef.current = true;
          markSettled();
        }
      })
      .catch(() => undefined);
  }, [markSettled]);

  const handleCanPlay = useCallback(() => {
    if (engine === "vidstack-direct") {
      const player = playerRef.current;
      const providerVideo =
        player?.provider && "video" in player.provider
          ? player.provider.video
          : null;
      const video =
        providerVideo ??
        document.querySelector(".nyumat-direct-stream-player video");
      if (video instanceof HTMLVideoElement && video.readyState >= 2) {
        markSettled();
        return;
      }
    }
    attemptPlaybackStart();
  }, [attemptPlaybackStart, engine, markSettled]);

  useEffect(() => {
    startedRef.current = false;
    settledRef.current = false;
    readyRef.current = false;
  }, [engine, sourceUrl]);

  useEffect(() => {
    const tick = () => {
      attemptPlaybackStart();
    };

    tick();
    const interval = window.setInterval(tick, 1500);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 180_000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [engine, sourceUrl, attemptPlaybackStart]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!settledRef.current) {
        onError();
      }
    }, VIDSTACK_START_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [engine, sourceUrl, onError]);

  const src =
    engine === "vidstack-hls"
      ? { src: sourceUrl, type: "application/x-mpegurl" as const }
      : sourceUrl;

  return (
    <MediaPlayer
      key={`${engine}:${sourceUrl}`}
      ref={playerRef}
      className="nyumat-direct-stream-player h-full w-full"
      title={title ?? stream.name}
      src={src}
      poster={poster ?? undefined}
      playsInline
      autoPlay
      muted={false}
      volume={1}
      streamType="on-demand"
      load="eager"
      crossOrigin="anonymous"
      onCanPlay={handleCanPlay}
      onLoadedData={handleCanPlay}
      onPlaying={markMediaReady}
      onError={onError}
    >
      <MediaProvider />
      {layoutReady ? <DefaultVideoLayout icons={defaultLayoutIcons} /> : null}
    </MediaPlayer>
  );
}

function CalluspiratesStreamPlayerInstance({
  stream,
  title,
  poster,
  className,
  progressKey,
  onStreamFailed,
  onMediaReady,
  onEnded,
}: CalluspiratesStreamPlayerProps) {
  const initialEngine = selectInitialEngine(stream);
  const [engine, setEngine] = useState<DirectPlaybackEngine | null>(
    initialEngine,
  );
  const [failed, setFailed] = useState(!isStreamPlayable(stream));
  const errorReportedRef = useRef(false);
  const onStreamFailedRef = useRef(onStreamFailed);
  onStreamFailedRef.current = onStreamFailed;

  useEffect(() => {
    errorReportedRef.current = false;
    const nextEngine = selectInitialEngine(stream);
    setEngine(nextEngine);
    setFailed(!isStreamPlayable(stream));
  }, [stream]);

  const reportStreamFailed = useCallback(() => {
    if (errorReportedRef.current) {
      return;
    }
    errorReportedRef.current = true;
    onStreamFailedRef.current();
  }, []);

  const handleEngineError = useCallback(() => {
    if (!engine) {
      setFailed(true);
      reportStreamFailed();
      return;
    }
    const fallback = nextFallbackEngine(stream, engine);
    if (fallback) {
      setFailed(false);
      setEngine(fallback);
      return;
    }
    setFailed(true);
    reportStreamFailed();
  }, [engine, reportStreamFailed, stream]);

  if (failed || !engine) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-black px-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        Trying next stream...
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full min-h-0", className)}>
      {engine === "movi" ? (
        <Suspense fallback={null}>
          <MoviStreamPlayer
            key={stream.url}
            src={stream.url}
            poster={poster}
            title={title ?? stream.name}
            progressKey={progressKey}
            onError={handleEngineError}
            onMediaReady={onMediaReady}
            onEnded={onEnded}
            className="h-full w-full"
          />
        </Suspense>
      ) : (
        <VidstackDirectPlayer
          key={`${engine}:${stream.url}`}
          stream={stream}
          engine={engine}
          title={title}
          poster={poster}
          progressKey={progressKey}
          onError={handleEngineError}
          onMediaReady={onMediaReady}
          onEnded={onEnded}
        />
      )}
    </div>
  );
}

export function CalluspiratesStreamPlayer(
  props: CalluspiratesStreamPlayerProps,
) {
  return (
    <CalluspiratesStreamPlayerInstance
      key={`${props.stream.hash}:${props.stream.url}`}
      {...props}
    />
  );
}
