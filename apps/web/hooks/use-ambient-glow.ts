"use client";

import { useEffect, useRef } from "react";

const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 90;

type UseAmbientGlowOptions = {
  active: boolean;
  intervalMs?: number;
};

export function useAmbientGlow(
  getVideo: () => HTMLVideoElement | null,
  { active, intervalMs = 80 }: UseAmbientGlowOptions,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const getVideoRef = useRef(getVideo);
  getVideoRef.current = getVideo;

  useEffect(() => {
    if (!active) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;

    let rafId: number | null = null;
    let lastSample = 0;

    const sample = (timestamp: number) => {
      rafId = requestAnimationFrame(sample);

      if (document.hidden || timestamp - lastSample < intervalMs) {
        return;
      }
      lastSample = timestamp;

      const video = getVideoRef.current();
      if (
        !video ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.paused ||
        video.ended ||
        video.seeking
      ) {
        return;
      }

      try {
        context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      } catch {
        // A frame can be undrawable for one tick after a track/quality switch.
        return;
      }
    };

    rafId = requestAnimationFrame(sample);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [active, intervalMs]);

  return canvasRef;
}
