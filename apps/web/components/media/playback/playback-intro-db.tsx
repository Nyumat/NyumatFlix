"use client";

import { useMemo } from "react";

import {
  IntroDbSegmentControl,
  VidstackIntroDbSegmentControl,
} from "@/components/media/controls/introdb-segment-control";
import { useIntroDbSegments } from "@/hooks/use-introdb-segments";
import {
  buildIntroDbChapterGradient,
  buildIntroDbChaptersVtt,
  formatIntroDbSegmentTitle,
  type IntroDbSegment,
} from "@/lib/playback/introdb";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import type { ChapterMarker } from "@/lib/player/movi-host-api";
import type { CSSProperties } from "react";

type ScrapePlayerStyle = CSSProperties & {
  [name: `--${string}`]: string | number | null | undefined;
};

export const toIntroDbChapterMarkers = (
  segments: IntroDbSegment[],
): ChapterMarker[] =>
  segments.map((segment) => ({
    title: formatIntroDbSegmentTitle(segment.type),
    start: segment.startSeconds,
    end: segment.endSeconds,
  }));

export const usePlaybackIntroDb = (
  progressKey: PlaybackProgressKey,
  duration: number,
  imdbId?: string | null,
) => {
  const { segments } = useIntroDbSegments(progressKey, duration, imdbId ?? null);

  const chaptersVtt = useMemo(
    () => buildIntroDbChaptersVtt(segments),
    [segments],
  );

  const chapterGradient = useMemo(
    () => buildIntroDbChapterGradient(segments, duration),
    [duration, segments],
  );

  const chapterMarkers = useMemo(
    () => toIntroDbChapterMarkers(segments),
    [segments],
  );

  const vidstackPlayerStyle: ScrapePlayerStyle | undefined = chapterGradient
    ? ({
        "--nyumat-introdb-chapter-gradient": chapterGradient,
      } as ScrapePlayerStyle)
    : undefined;

  const chaptersDataUrl = useMemo(
    () =>
      chaptersVtt
        ? `data:text/vtt;charset=utf-8,${encodeURIComponent(chaptersVtt)}`
        : null,
    [chaptersVtt],
  );

  return {
    segments,
    chaptersVtt,
    chapterGradient,
    chapterMarkers,
    vidstackPlayerStyle,
    chaptersDataUrl,
  };
};

type PlaybackIntroDbNativeProps = {
  segments: IntroDbSegment[];
  currentTime: number;
  duration: number;
  isTv?: boolean;
  onSeek: (time: number) => void;
  onAdvanceToNextEpisode?: () => Promise<boolean>;
};

export const PlaybackIntroDbNativeControl = ({
  segments,
  currentTime,
  duration,
  isTv = false,
  onSeek,
  onAdvanceToNextEpisode,
}: PlaybackIntroDbNativeProps) => (
  <IntroDbSegmentControl
    segments={segments}
    currentTime={currentTime}
    duration={duration}
    isTv={isTv}
    onSeek={onSeek}
    onAdvanceToNextEpisode={onAdvanceToNextEpisode}
  />
);

type PlaybackIntroDbVidstackProps = {
  segments: IntroDbSegment[];
  isTv?: boolean;
  onAdvanceToNextEpisode?: () => Promise<boolean>;
};

export const PlaybackIntroDbVidstackControl = ({
  segments,
  isTv = false,
  onAdvanceToNextEpisode,
}: PlaybackIntroDbVidstackProps) => (
  <VidstackIntroDbSegmentControl
    segments={segments}
    isTv={isTv}
    onAdvanceToNextEpisode={onAdvanceToNextEpisode}
  />
);
