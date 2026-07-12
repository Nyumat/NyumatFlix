"use client";

import { useMediaRemote, useMediaState } from "@vidstack/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import {
  findActiveIntroDbSegment,
  isTerminalIntroDbCredit,
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

const segmentShortName = (segment: IntroDbSegment): string => {
  switch (segment.type) {
    case "intro":
      return "Intro";
    case "recap":
      return "Recap";
    case "preview":
      return "Preview";
    case "credits":
      return "Credits";
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
    isTerminalIntroDbCredit(activeSegment, segments);
  const isPending = pendingSegmentId === activeSegment.id;
  const actionHint = canAdvanceEpisode ? "Up next" : "Skip";
  const actionLabel = canAdvanceEpisode
    ? "Next episode"
    : segmentShortName(activeSegment);

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
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        className="pointer-events-auto absolute bottom-20 right-4 z-40"
      >
        <button
          type="button"
          data-introdb-segment={activeSegment.type}
          disabled={isPending}
          onClick={() => void handleClick()}
          aria-label={
            isPending
              ? "Loading next episode"
              : canAdvanceEpisode
                ? "Next episode"
                : `Skip ${segmentShortName(activeSegment).toLowerCase()}`
          }
          title="Shoutout Pas % Yeb for providing me with timing data"
          className={cn(
            buttonVariants({ variant: "chrome", size: "sm" }),
            "h-9 gap-2 rounded-full border-white/25 bg-white/10 px-3.5 py-2 text-white shadow-lg shadow-black/25 ring-1 ring-inset ring-white/10 backdrop-blur-xl hover:border-white/35 hover:bg-white/18 hover:shadow-xl disabled:cursor-wait disabled:opacity-70",
          )}
        >
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
              {isPending ? "Loading" : actionHint}
            </span>
            <span className="truncate text-sm font-semibold">
              {isPending ? "Next episode" : actionLabel}
            </span>
          </span>
          {isPending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <SkipForward className="size-3.5 shrink-0 opacity-80" aria-hidden />
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
