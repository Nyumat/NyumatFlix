"use client";

import { useQuery } from "@tanstack/react-query";

import useMedia from "@/hooks/useMedia";
import {
  fetchIntroDbSegments,
  introDbDurationMs,
  isIntroDbLookupReady,
} from "@/lib/playback/introdb";
import {
  progressStorageKey,
  type PlaybackProgressKey,
} from "@/lib/playback/progress-storage";
import { queryKeys } from "@/lib/query-keys";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function useIntroDbSegments(
  progressKey: PlaybackProgressKey,
  durationSeconds: number,
  imdbId: string | null,
) {
  const isDesktop = useMedia("(min-width: 769px)", false);
  const durationMs = introDbDurationMs(durationSeconds);
  const enabled =
    isDesktop && durationMs !== null && isIntroDbLookupReady(progressKey);

  const query = useQuery({
    queryKey: queryKeys.introDbSegments(
      progressStorageKey(progressKey),
      durationMs ?? 0,
      imdbId,
    ),
    queryFn: ({ signal }) =>
      fetchIntroDbSegments(progressKey, durationSeconds, imdbId, signal),
    enabled,
    staleTime: TWENTY_FOUR_HOURS_MS,
    gcTime: TWENTY_FOUR_HOURS_MS,
    retry: false,
  });

  return {
    segments: enabled ? (query.data ?? []) : [],
    isEnabled: enabled,
  };
}
