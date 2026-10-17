import type { LiveProgram } from "@/lib/live/types";

export const HALF_HOUR_MS = 30 * 60_000;
export const GUIDE_WINDOW_MS = 2 * 60 * 60_000;
export const GUIDE_HORIZON_MS = 24 * 60 * 60_000;

export const getProgramPosition = (
  program: LiveProgram,
  start: number,
  end: number,
) => {
  const since = Date.parse(program.startsAt);
  const till = Date.parse(program.endsAt);
  if (
    !Number.isFinite(since) ||
    !Number.isFinite(till) ||
    till <= since ||
    till <= start ||
    since >= end ||
    end <= start
  )
    return null;
  return {
    left: ((Math.max(start, since) - start) / (end - start)) * 100,
    width:
      ((Math.min(end, till) - Math.max(start, since)) / (end - start)) * 100,
  };
};

export const isProgramOnNow = (program: LiveProgram, now: number) =>
  Date.parse(program.startsAt) <= now && now < Date.parse(program.endsAt);
