"use client";

import { useMediaRemote, useMediaState } from "@vidstack/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

import {
  findActiveIntroDbSegment,
  isIntroDbCloserSegment,
  type IntroDbSegment,
} from "@/lib/playback/introdb";
import { cn } from "@/lib/utils";

type IntroDbSegmentControlProps = {
  segments: IntroDbSegment[];
  currentTime: number;
  duration: number;
  isTv: boolean;
  onSeek: (time: number) => void;
  onAdvanceToNextEpisode?: () => Promise<boolean>;
};

const skipLabel = (segment: IntroDbSegment): string => {
  switch (segment.type) {
    case "intro":
      return "Skip Intro";
    case "recap":
      return "Skip Recap";
    case "preview":
      return "Skip Preview";
    case "credits":
      return "Skip Closer";
  }
};

export function IntroDbSegmentControl({
  segments,
  currentTime,
  duration,
  isTv,
  onSeek,
  onAdvanceToNextEpisode,
}: IntroDbSegmentControlProps) {
  const activeSegment = findActiveIntroDbSegment(segments, currentTime);
  const [pendingSegmentId, setPendingSegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingSegmentId && pendingSegmentId !== activeSegment?.id) {
      setPendingSegmentId(null);
    }
  }, [activeSegment?.id, pendingSegmentId]);

  if (!activeSegment || !Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const canAdvanceEpisode =
    isTv &&
    Boolean(onAdvanceToNextEpisode) &&
    isIntroDbCloserSegment(activeSegment);
  const isPending = pendingSegmentId === activeSegment.id;
  const buttonLabel = isPending
    ? "Next Episode"
    : canAdvanceEpisode
      ? "Next Episode"
      : skipLabel(activeSegment);

  const handleClick = async () => {
    if (isPending) {
      return;
    }

    if (canAdvanceEpisode && onAdvanceToNextEpisode) {
      setPendingSegmentId(activeSegment.id);
      try {
        const advanced = await onAdvanceToNextEpisode();
        if (!advanced) {
          onSeek(activeSegment.endSeconds);
        }
      } finally {
        setPendingSegmentId(null);
      }
      return;
    }

    onSeek(activeSegment.endSeconds);
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeSegment.id}
        initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto absolute right-3 bottom-24 z-40 sm:right-5"
      >
        <button
          type="button"
          data-introdb-segment={activeSegment.type}
          disabled={isPending}
          onClick={() => void handleClick()}
          aria-label={
            isPending ? "Loading next episode" : buttonLabel.toLowerCase()
          }
          title="Shoutout Pas % Yeb for providing me with timing data"
          className={cn(
            "group flex h-10 items-center gap-2 rounded-md border px-3.5 text-sm font-semibold tracking-wide",
            "border-white/75 bg-black/80 text-white shadow-[0_12px_28px_-12px_rgba(0,0,0,0.9)]",
            "backdrop-blur-sm transition-[background-color,color,border-color,transform] duration-200",
            "hover:scale-[1.02] hover:border-white hover:bg-white hover:text-black",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black",
            "active:scale-[0.98]",
            "disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100 disabled:hover:border-white/75 disabled:hover:bg-black/80 disabled:hover:text-white",
          )}
        >
          <span>{buttonLabel}</span>
          {isPending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <SkipForward
              className="size-3.5 shrink-0 opacity-90 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export function VidstackIntroDbSegmentControl({
  segments,
  isTv,
  onAdvanceToNextEpisode,
}: {
  segments: IntroDbSegment[];
  isTv: boolean;
  onAdvanceToNextEpisode?: () => Promise<boolean>;
}) {
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");
  const remote = useMediaRemote();

  return (
    <IntroDbSegmentControl
      segments={segments}
      currentTime={currentTime}
      duration={duration}
      isTv={isTv}
      onSeek={(time) => remote.seek(time)}
      onAdvanceToNextEpisode={onAdvanceToNextEpisode}
    />
  );
}
