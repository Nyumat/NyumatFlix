"use client";

import { useMediaRemote, useMediaState } from "@vidstack/react";
import { SkipForward } from "lucide-react";
import { useEffect, useState } from "react";

import {
  findActiveIntroDbSegment,
  isTerminalIntroDbCredit,
  type IntroDbSegment,
} from "@/lib/playback/introdb";

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
      return "Skip intro";
    case "recap":
      return "Skip recap";
    case "preview":
      return "Skip preview";
    case "credits":
      return "Skip credits";
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
  const label = canAdvanceEpisode ? "Next episode" : skipLabel(activeSegment);

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
    <div className="pointer-events-auto absolute bottom-16 right-3 z-40">
      <button
        type="button"
        data-introdb-segment={activeSegment.type}
        disabled={isPending}
        onClick={() => void handleClick()}
        title="Timing data from TheIntroDB"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-white/30 bg-black/75 px-4 text-sm font-semibold text-white shadow-xl backdrop-blur-md transition hover:border-white/60 hover:bg-white hover:text-black focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-60"
      >
        <span>{isPending ? "Loading next episode..." : label}</span>
        <SkipForward className="size-4" aria-hidden="true" />
      </button>
    </div>
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
