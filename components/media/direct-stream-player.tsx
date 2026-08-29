"use client";

import dynamic from "next/dynamic";
import { lazy, Suspense, useCallback, useState } from "react";

import {
  directEngineSourceUrl,
  directEngineStreamKind,
  nextDirectPlaybackEngine,
  selectDirectPlaybackEngine,
  type DirectPlaybackEngine,
  type DirectPlaybackMode,
} from "@/lib/scrape/direct-playback";
import { buildScrapePlayerKey } from "@/lib/scrape/player-sources";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { cn } from "@/lib/utils";

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

type DirectStreamPlayerProps = {
  mediaUrl: string;
  fallbackUrl?: string;
  playback: DirectPlaybackMode;
  streamName?: string;
  fileName?: string;
  qualities?: ScrapeQuality[];
  referer?: string;
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  title: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  imdbId?: string | null;
  className?: string;
  onFatalError?: () => void;
  onMediaReady?: () => void;
  onEnded?: () => Promise<boolean>;
};

function DirectStreamPlayerInstance({
  mediaUrl,
  fallbackUrl,
  playback,
  streamName,
  fileName,
  qualities,
  referer,
  subtitles,
  audioVersions,
  defaultAudioLang,
  defaultHardSubLang,
  preferredAudioLang,
  title,
  poster,
  progressKey,
  imdbId,
  className,
  onFatalError,
  onMediaReady,
  onEnded,
}: DirectStreamPlayerProps) {
  const [engine, setEngine] = useState<DirectPlaybackEngine | null>(() =>
    selectDirectPlaybackEngine(
      playback,
      fallbackUrl,
      mediaUrl,
      fileName,
      streamName ?? title,
      undefined,
      playback === "direct" ? true : undefined,
    ),
  );
  const [failed, setFailed] = useState(() => {
    const initial = selectDirectPlaybackEngine(
      playback,
      fallbackUrl,
      mediaUrl,
      fileName,
      streamName ?? title,
    );
    return initial === null;
  });

  const handleEngineError = useCallback(() => {
    if (!engine) {
      setFailed(true);
      onFatalError?.();
      return;
    }
    const next = nextDirectPlaybackEngine(
      playback,
      engine,
      fallbackUrl,
      mediaUrl,
      fileName,
      streamName ?? title,
    );
    if (next) {
      setFailed(false);
      setEngine(next);
      return;
    }
    setFailed(true);
    onFatalError?.();
  }, [
    engine,
    fallbackUrl,
    fileName,
    mediaUrl,
    onFatalError,
    playback,
    streamName,
    title,
  ]);

  if (failed || !engine) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-lg border border-border/20 bg-black text-sm text-muted-foreground",
          className,
        )}
      >
        Playback failed for this stream.
      </div>
    );
  }

  const sourceUrl = directEngineSourceUrl(mediaUrl, fallbackUrl, engine);
  const streamKind = directEngineStreamKind(engine, sourceUrl);

  if (engine === "movi") {
    return (
      <Suspense fallback={null}>
        <MoviStreamPlayer
          key={sourceUrl}
          src={sourceUrl}
          poster={poster}
          title={title}
          preferredAudioLang={preferredAudioLang}
          progressKey={progressKey}
          onError={handleEngineError}
          onMediaReady={onMediaReady}
          onEnded={onEnded}
          className={className}
        />
      </Suspense>
    );
  }

  return (
    <ScrapeHlsPlayer
      key={buildScrapePlayerKey({
        playUrl: sourceUrl,
        qualities,
        subtitles,
        audioVersions,
      })}
      playUrl={sourceUrl}
      streamKind={streamKind}
      qualities={qualities}
      referer={referer}
      subtitles={subtitles}
      audioVersions={audioVersions}
      defaultAudioLang={defaultAudioLang}
      defaultHardSubLang={defaultHardSubLang}
      preferredAudioLang={preferredAudioLang}
      title={title}
      poster={poster}
      progressKey={progressKey}
      imdbId={imdbId}
      className={className}
      autoPlay
      onFatalError={handleEngineError}
      onMediaReady={onMediaReady}
      onEnded={onEnded}
    />
  );
}

export function DirectStreamPlayer(props: DirectStreamPlayerProps) {
  return (
    <DirectStreamPlayerInstance
      key={`${props.mediaUrl}:${props.playback}:${props.fallbackUrl ?? ""}`}
      {...props}
    />
  );
}
