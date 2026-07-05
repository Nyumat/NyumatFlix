"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { VideasyStreamVideo } from "@/components/hero/videasy-stream-video";
import {
  HERO_AMBIENT_VIDEO_MASK,
  HERO_MEDIA_TRANSITION,
} from "@/components/hero/hero-overlay";

type AmbientVideoBackdropProps = {
  ambientVideoKey: string;
  backdropSrc: string;
  backdropAlt: string;
  mp4Url: string | null;
  hlsUrl: string | null;
  isMuted: boolean;
  onAutoplayBlocked(): void;
  onStreamError(): void;
  onBackdropActiveChange?(active: boolean): void;
};

export function AmbientVideoBackdrop({
  ambientVideoKey,
  backdropSrc,
  backdropAlt,
  mp4Url,
  hlsUrl,
  isMuted,
  onAutoplayBlocked,
  onStreamError,
  onBackdropActiveChange,
}: AmbientVideoBackdropProps) {
  const [isReady, setIsReady] = useState(false);

  const handleReadyChange = (ready: boolean) => {
    setIsReady(ready);
    onBackdropActiveChange?.(ready);
  };

  return (
    <>
      <motion.img
        src={backdropSrc}
        fetchPriority="high"
        alt={backdropAlt}
        className="w-full h-full object-cover absolute inset-0 z-0"
        initial={false}
        animate={{ opacity: isReady ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={HERO_MEDIA_TRANSITION}
      />

      <motion.div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        initial={false}
        animate={{ opacity: isReady ? 1 : 0 }}
        transition={HERO_MEDIA_TRANSITION}
        style={{
          maskImage: HERO_AMBIENT_VIDEO_MASK,
          WebkitMaskImage: HERO_AMBIENT_VIDEO_MASK,
        }}
      >
        <VideasyStreamVideo
          key={ambientVideoKey}
          mp4Url={mp4Url}
          hlsUrl={hlsUrl}
          playback="ambient"
          isMuted={isMuted}
          onAutoplayBlocked={onAutoplayBlocked}
          onCanPlay={() => handleReadyChange(true)}
          onError={() => {
            handleReadyChange(false);
            onStreamError();
          }}
          className="absolute top-1/2 left-1/2 aspect-video h-[calc(100%+14rem)] min-w-[calc(100%+14rem)] -translate-x-1/2 -translate-y-[calc(50%+25px)] scale-[1.015] object-cover"
        />
      </motion.div>
    </>
  );
}
