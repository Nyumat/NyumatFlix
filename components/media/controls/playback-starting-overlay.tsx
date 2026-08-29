"use client";

import { cn } from "@/lib/utils";

type PlaybackStartingOverlayProps = {
  className?: string;
  message?: string;
  error?: string | null;
};

export function PlaybackStartingOverlay({
  className,
  message = "Starting playback…",
  error = null,
}: PlaybackStartingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-center justify-center bg-black px-6",
        className,
      )}
      aria-live="polite"
      aria-busy={!error}
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {error ? (
          <p className="text-sm font-medium text-amber-200">{error}</p>
        ) : (
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white"
            aria-hidden="true"
          />
        )}
        <p className="text-sm text-white/70">{message}</p>
      </div>
    </div>
  );
}
