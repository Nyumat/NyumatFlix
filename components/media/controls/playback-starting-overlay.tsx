"use client";

import { cn } from "@/lib/utils";

type PlaybackStartingOverlayProps = {
  className?: string;
};

export function PlaybackStartingOverlay({
  className,
}: PlaybackStartingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black px-6",
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white"
          aria-hidden="true"
        />
        <p className="text-sm text-white/70">Starting playback…</p>
      </div>
    </div>
  );
}
