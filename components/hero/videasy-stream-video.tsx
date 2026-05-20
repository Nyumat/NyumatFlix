"use client";

import { cn } from "@/lib/utils";
import Hls from "hls.js";
import { useEffect, useRef } from "react";

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let hlsInstance: Hls | null = null;

    const clearSrc = () => {
      video.removeAttribute("src");
      video.load();
    };

    if (playback === "ambient") {
      if (mp4Url) {
        video.src = mp4Url;
        return () => {
          clearSrc();
        };
      }
      if (hlsUrl) {
        if (Hls.isSupported()) {
          hlsInstance = new Hls({ enableWorker: true });
          hlsInstance.loadSource(hlsUrl);
          hlsInstance.attachMedia(video);
          return () => {
            hlsInstance?.destroy();
            hlsInstance = null;
            clearSrc();
          };
        }
        if (canPlayNativeHls(video)) {
          video.src = hlsUrl;
          return () => {
            clearSrc();
          };
        }
      }
      return;
    }

    if (hlsUrl) {
      if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true });
        hlsInstance.loadSource(hlsUrl);
        hlsInstance.attachMedia(video);
        return () => {
          hlsInstance?.destroy();
          hlsInstance = null;
          clearSrc();
        };
      }
      if (canPlayNativeHls(video)) {
        video.src = hlsUrl;
        return () => {
          clearSrc();
        };
      }
    }

    if (mp4Url) {
      video.src = mp4Url;
      return () => {
        clearSrc();
      };
    }

    return undefined;
  }, [playback, mp4Url, hlsUrl]);

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
          onAutoplayBlocked?.();
        }
      });
    };
    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    return () => {
      v.removeEventListener("loadeddata", tryPlay);
    };
  }, [playback, mp4Url, hlsUrl, isMuted, onAutoplayBlocked]);

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
      onEnded={onEnded}
      onError={onError}
      onCanPlay={onCanPlay}
    />
  );
};
