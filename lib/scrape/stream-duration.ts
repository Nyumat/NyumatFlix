import type { StreamKind } from "./stream-url-patterns";

const ISO8601_DURATION =
  /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i;

export const parseIso8601DurationSeconds = (value: string): number | null => {
  const match = value.trim().match(ISO8601_DURATION);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return Number.isFinite(total) && total > 0 ? total : null;
};

export const parseDashDurationSeconds = (body: string): number | null => {
  const match = body.match(/mediaPresentationDuration="([^"]+)"/i);
  if (!match?.[1]) {
    return null;
  }

  return parseIso8601DurationSeconds(match[1]);
};

export const parseHlsDurationSeconds = (body: string): number | null => {
  if (!body.includes("#EXTM3U")) {
    return null;
  }

  let total = 0;
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#EXTINF:")) {
      continue;
    }

    const value = Number(trimmed.slice("#EXTINF:".length).split(",")[0]);
    if (Number.isFinite(value) && value > 0) {
      total += value;
    }
  }

  return total > 0 ? total : null;
};

export const parseStreamDurationSeconds = (
  body: string,
  kind: StreamKind,
): number | null => {
  if (kind === "dash") {
    return parseDashDurationSeconds(body);
  }

  if (kind === "hls") {
    return parseHlsDurationSeconds(body);
  }

  return null;
};

export const streamDurationMatchesExpected = (
  actualSeconds: number,
  expectedMinutes: number,
): boolean => {
  if (!Number.isFinite(actualSeconds) || actualSeconds <= 0) {
    return false;
  }

  if (!Number.isFinite(expectedMinutes) || expectedMinutes <= 0) {
    return true;
  }

  const expectedSeconds = expectedMinutes * 60;
  const minSeconds = expectedSeconds * 0.45;
  const maxSeconds = expectedSeconds * 2.2 + 180;

  return actualSeconds >= minSeconds && actualSeconds <= maxSeconds;
};
