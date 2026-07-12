"use client";

import { cn } from "@/lib/utils";
import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

export type VideasyStreamPlayback = "ambient" | "controls";

type VideasyStreamVideoProps = {
  mp4Url: string | null;
  hlsUrl: string | null;
  playback: VideasyStreamPlayback;
  className?: string;
  onEnded?: () => void;
  onError?: () => void;
  onCanPlay?: () => void;
  onAutoplayBlocked?: () => void;
  isMuted?: boolean;
};

const canPlayNativeHls = (video: HTMLVideoElement): boolean =>
  video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
  video.canPlayType("application/x-mpegURL") !== "";

export const VideasyStreamVideo = ({
  mp4Url,
  hlsUrl,
  playback,
  className,
  onEnded,
  onError,
  onCanPlay,
  onAutoplayBlocked,
  isMuted = true,
}: VideasyStreamVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayBlockedNotifiedRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onCanPlayRef = useRef(onCanPlay);
  onCanPlayRef.current = onCanPlay;
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  onAutoplayBlockedRef.current = onAutoplayBlocked;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const [useFallbackSource, setUseFallbackSource] = useState(false);
  const useFallbackSourceRef = useRef(useFallbackSource);
  useFallbackSourceRef.current = useFallbackSource;
  const primarySource =
    playback === "ambient"
      ? mp4Url
        ? "mp4"
        : hlsUrl
          ? "hls"
          : null
      : hlsUrl
        ? "hls"
        : mp4Url
          ? "mp4"
          : null;
  const fallbackSource =
    primarySource === "mp4" && hlsUrl
      ? "hls"
      : primarySource === "hls" && mp4Url
        ? "mp4"
        : null;
  const fallbackSourceRef = useRef(fallbackSource);
  fallbackSourceRef.current = fallbackSource;
  const activeSource =
    useFallbackSource && fallbackSource ? fallbackSource : primarySource;

  useEffect(() => {
    setUseFallbackSource(false);
  }, [playback, mp4Url, hlsUrl]);

  const handleSourceError = useCallback(() => {
    if (!useFallbackSourceRef.current && fallbackSourceRef.current) {
      setUseFallbackSource(true);
      return;
    }
    onErrorRef.current?.();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let hlsInstance: Hls | null = null;
    let disposed = false;

    const clearSrc = () => {
      video.removeAttribute("src");
      video.load();
    };

    if (activeSource === "hls" && hlsUrl) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (!disposed && data.fatal) {
            handleSourceError();
          }
        });
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.attachMedia(video);
        return () => {
          disposed = true;
          hlsInstance?.destroy();
          hlsInstance = null;
          clearSrc();
        };
      }
      if (canPlayNativeHls(video)) {
        video.src = hlsUrl;
        return () => {
          disposed = true;
          clearSrc();
        };
      }
      handleSourceError();
      return;
    }

    if (activeSource === "mp4" && mp4Url) {
      video.src = mp4Url;
      return () => {
        disposed = true;
        clearSrc();
      };
    }

    return undefined;
  }, [activeSource, handleSourceError, hlsUrl, mp4Url]);

  useEffect(() => {
    if (playback !== "ambient") {
      return;
    }
    const v = videoRef.current;
    if (!v) {
      return;
    }
    autoplayBlockedNotifiedRef.current = false;
    v.muted = isMuted;
    const tryPlay = () => {
      void v.play().catch(() => {
        if (!isMuted && !autoplayBlockedNotifiedRef.current) {
          autoplayBlockedNotifiedRef.current = true;
          onAutoplayBlockedRef.current?.();
        }
      });
    };
    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    return () => {
      v.removeEventListener("loadeddata", tryPlay);
    };
  }, [playback, mp4Url, hlsUrl, isMuted]);

  const ambient = playback === "ambient";

  return (
    <video
      ref={videoRef}
      className={cn(className)}
      controls={!ambient}
      muted={ambient ? isMuted : false}
      loop={ambient}
      playsInline
      autoPlay={ambient}
      aria-hidden={ambient || undefined}
      onEnded={() => onEndedRef.current?.()}
      onError={handleSourceError}
      onCanPlay={() => onCanPlayRef.current?.()}
    />
  );
};
