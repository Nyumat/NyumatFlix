import { z } from "zod";

import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

export const THE_INTRO_DB_MEDIA_ENDPOINT =
  "https://api.theintrodb.org/v3/media";
export const INTRO_DB_APP_SEGMENTS_ENDPOINT =
  "https://api.introdb.app/segments";

const MAX_TMDB_ID = 10_000_000;
const MAX_MEDIA_DURATION_SECONDS = 6 * 60 * 60;
const MAX_SEGMENTS_PER_TYPE = 20;
const IMDB_ID_PATTERN = /^tt[0-9]{7,8}$/;

export const introDbSegmentTypes = [
  "recap",
  "intro",
  "preview",
  "credits",
] as const;

export type IntroDbSegmentType = (typeof introDbSegmentTypes)[number];

export type IntroDbSegment = {
  id: string;
  type: IntroDbSegmentType;
  startSeconds: number;
  endSeconds: number;
  endsAtMediaEnd: boolean;
};

const timestampSchema = z.object({
  start_ms: z.number().int().min(0).nullable(),
  end_ms: z.number().int().min(0).nullable(),
});

const timestampListSchema = z
  .array(timestampSchema)
  .max(MAX_SEGMENTS_PER_TYPE)
  .optional();

const mediaResponseSchema = z.object({
  tmdb_id: z.number().int().min(1).max(MAX_TMDB_ID),
  type: z.enum(["movie", "tv"]),
  season: z.number().int().min(1).nullable().optional(),
  episode: z.number().int().min(1).nullable().optional(),
  intro: timestampListSchema,
  recap: timestampListSchema,
  credits: timestampListSchema,
  preview: timestampListSchema,
});

const introDbAppTimestampSchema = z.object({
  start_ms: z.number().int().min(0),
  end_ms: z.number().int().min(0),
});

const introDbAppResponseSchema = z.object({
  imdb_id: z.string().regex(IMDB_ID_PATTERN),
  season: z.number().int().min(1),
  episode: z.number().int().min(1),
  intro: introDbAppTimestampSchema.nullable(),
  recap: introDbAppTimestampSchema.nullable(),
  outro: introDbAppTimestampSchema.nullable(),
});

type IntroDbMediaResponse = z.infer<typeof mediaResponseSchema>;
type IntroDbTimestamp = z.infer<typeof timestampSchema>;
export type IntroDbAppResponse = z.infer<typeof introDbAppResponseSchema>;

export type IntroDbAppLookup = {
  imdbId: string;
  seasonNumber: number;
  episodeNumber: number;
};

export function normalizeIntroDbImdbId(value: unknown): string | null {
  return typeof value === "string" && IMDB_ID_PATTERN.test(value)
    ? value
    : null;
}

export function readIntroDbImdbId(media: unknown): string | null {
  if (!media || typeof media !== "object") {
    return null;
  }

  const candidate = media as {
    imdb_id?: unknown;
    external_ids?: { imdb_id?: unknown };
  };

  return (
    normalizeIntroDbImdbId(candidate.external_ids?.imdb_id) ??
    normalizeIntroDbImdbId(candidate.imdb_id)
  );
}

const isPositiveInteger = (value: number | undefined): value is number =>
  Number.isInteger(value) && typeof value === "number" && value > 0;

export function isIntroDbLookupReady(key: PlaybackProgressKey): boolean {
  if (!isPositiveInteger(key.contentId) || key.contentId > MAX_TMDB_ID) {
    return false;
  }

  if (key.mediaType === "movie") {
    return true;
  }

  return (
    isPositiveInteger(key.seasonNumber) && isPositiveInteger(key.episodeNumber)
  );
}

export function introDbDurationMs(durationSeconds: number): number | null {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_MEDIA_DURATION_SECONDS
  ) {
    return null;
  }

  return Math.round(durationSeconds * 1000);
}

export function buildIntroDbMediaUrl(
  key: PlaybackProgressKey,
  durationSeconds: number,
): string | null {
  const durationMs = introDbDurationMs(durationSeconds);
  if (!isIntroDbLookupReady(key) || durationMs === null) {
    return null;
  }

  const url = new URL(THE_INTRO_DB_MEDIA_ENDPOINT);
  url.searchParams.set("tmdb_id", String(key.contentId));
  url.searchParams.set("duration_ms", String(durationMs));

  if (key.mediaType === "tv") {
    url.searchParams.set("season", String(key.seasonNumber));
    url.searchParams.set("episode", String(key.episodeNumber));
  }

  return url.toString();
}

const responseMatchesLookup = (
  response: IntroDbMediaResponse,
  key: PlaybackProgressKey,
): boolean => {
  if (response.tmdb_id !== key.contentId || response.type !== key.mediaType) {
    return false;
  }

  if (key.mediaType === "movie") {
    return true;
  }

  return (
    response.season === key.seasonNumber &&
    response.episode === key.episodeNumber
  );
};

const normalizeTimestamp = (
  source: "theintrodb" | "introdb-app",
  type: IntroDbSegmentType,
  timestamp: IntroDbTimestamp,
  index: number,
  durationMs: number,
): IntroDbSegment | null => {
  const startCanBeOpen = type === "intro" || type === "recap";
  const endCanBeOpen = type === "credits" || type === "preview";

  if (timestamp.start_ms === null && !startCanBeOpen) {
    return null;
  }
  if (timestamp.end_ms === null && !endCanBeOpen) {
    return null;
  }

  const startMs = timestamp.start_ms ?? 0;
  const endMs = timestamp.end_ms ?? durationMs;

  if (startMs >= endMs || startMs >= durationMs || endMs > durationMs) {
    return null;
  }

  return {
    id: `${source}:${type}:${startMs}:${timestamp.end_ms ?? "end"}:${index}`,
    type,
    startSeconds: startMs / 1000,
    endSeconds: endMs / 1000,
    endsAtMediaEnd:
      timestamp.end_ms === null || Math.abs(endMs - durationMs) <= 1000,
  };
};

export function parseIntroDbSegments(
  input: unknown,
  key: PlaybackProgressKey,
  durationSeconds: number,
): IntroDbSegment[] | null {
  const durationMs = introDbDurationMs(durationSeconds);
  const parsed = mediaResponseSchema.safeParse(input);
  if (
    durationMs === null ||
    !parsed.success ||
    !responseMatchesLookup(parsed.data, key)
  ) {
    return null;
  }

  const segments: IntroDbSegment[] = [];
  for (const type of introDbSegmentTypes) {
    for (const [index, timestamp] of (parsed.data[type] ?? []).entries()) {
      const normalized = normalizeTimestamp(
        "theintrodb",
        type,
        timestamp,
        index,
        durationMs,
      );
      if (normalized) {
        segments.push(normalized);
      }
    }
  }

  return segments.sort((a, b) => {
    const startDelta = a.startSeconds - b.startSeconds;
    if (startDelta !== 0) {
      return startDelta;
    }
    return (
      introDbSegmentTypes.indexOf(a.type) - introDbSegmentTypes.indexOf(b.type)
    );
  });
}

export async function fetchTheIntroDbSegments(
  key: PlaybackProgressKey,
  durationSeconds: number,
  signal?: AbortSignal,
): Promise<IntroDbSegment[]> {
  const url = buildIntroDbMediaUrl(key, durationSeconds);
  if (!url) {
    return [];
  }

  const response = await fetch(url, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`IntroDB request failed: ${response.status}`);
  }

  const input: unknown = await response.json();
  const segments = parseIntroDbSegments(input, key, durationSeconds);
  if (!segments) {
    throw new Error("IntroDB returned an invalid media response");
  }

  return segments;
}

export function parseIntroDbAppResponse(
  input: unknown,
  lookup: IntroDbAppLookup,
): IntroDbAppResponse | null {
  const parsed = introDbAppResponseSchema.safeParse(input);
  if (
    !parsed.success ||
    parsed.data.imdb_id !== lookup.imdbId ||
    parsed.data.season !== lookup.seasonNumber ||
    parsed.data.episode !== lookup.episodeNumber
  ) {
    return null;
  }

  return parsed.data;
}

export function parseIntroDbAppSegments(
  input: unknown,
  lookup: IntroDbAppLookup,
  durationSeconds: number,
): IntroDbSegment[] | null {
  const durationMs = introDbDurationMs(durationSeconds);
  const response = parseIntroDbAppResponse(input, lookup);
  if (durationMs === null || !response) {
    return null;
  }

  const candidates: Array<{
    type: "intro" | "recap" | "credits";
    timestamp: IntroDbTimestamp | null;
  }> = [
    { type: "recap", timestamp: response.recap },
    { type: "intro", timestamp: response.intro },
    { type: "credits", timestamp: response.outro },
  ];

  return candidates.flatMap(({ type, timestamp }, index) => {
    if (!timestamp) {
      return [];
    }

    const normalized = normalizeTimestamp(
      "introdb-app",
      type,
      timestamp,
      index,
      durationMs,
    );
    return normalized ? [normalized] : [];
  });
}

export function mergeIntroDbSegments(
  primary: IntroDbSegment[],
  fallback: IntroDbSegment[],
): IntroDbSegment[] {
  const primaryTypes = new Set(primary.map((segment) => segment.type));
  return [
    ...primary,
    ...fallback.filter(({ type }) => !primaryTypes.has(type)),
  ].sort((a, b) => a.startSeconds - b.startSeconds);
}

const needsIntroDbAppFallback = (segments: IntroDbSegment[]): boolean =>
  (["intro", "recap", "credits"] as const).some(
    (type) => !segments.some((segment) => segment.type === type),
  );

async function fetchIntroDbAppSegments(
  lookup: IntroDbAppLookup,
  durationSeconds: number,
  signal?: AbortSignal,
): Promise<IntroDbSegment[]> {
  const params = new URLSearchParams({
    imdb_id: lookup.imdbId,
    season: String(lookup.seasonNumber),
    episode: String(lookup.episodeNumber),
  });
  const response = await fetch(`/api/introdb/segments?${params.toString()}`, {
    credentials: "same-origin",
    signal,
  });

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`IntroDB.app request failed: ${response.status}`);
  }

  const input: unknown = await response.json();
  const segments = parseIntroDbAppSegments(input, lookup, durationSeconds);
  if (!segments) {
    throw new Error("IntroDB.app returned an invalid segment response");
  }

  return segments;
}

export async function fetchIntroDbSegments(
  key: PlaybackProgressKey,
  durationSeconds: number,
  imdbId: string | null,
  signal?: AbortSignal,
): Promise<IntroDbSegment[]> {
  let primary: IntroDbSegment[] = [];
  let primaryError: unknown;

  try {
    primary = await fetchTheIntroDbSegments(key, durationSeconds, signal);
  } catch (error) {
    primaryError = error;
  }

  const normalizedImdbId = normalizeIntroDbImdbId(imdbId);
  const seasonNumber = key.seasonNumber;
  const episodeNumber = key.episodeNumber;
  if (
    key.mediaType === "tv" &&
    normalizedImdbId &&
    isPositiveInteger(seasonNumber) &&
    isPositiveInteger(episodeNumber) &&
    needsIntroDbAppFallback(primary)
  ) {
    try {
      const fallback = await fetchIntroDbAppSegments(
        {
          imdbId: normalizedImdbId,
          seasonNumber,
          episodeNumber,
        },
        durationSeconds,
        signal,
      );
      return mergeIntroDbSegments(primary, fallback);
    } catch {
      if (primaryError) {
        throw primaryError;
      }
      return primary;
    }
  }

  if (primaryError) {
    throw primaryError;
  }

  return primary;
}

export function findActiveIntroDbSegment(
  segments: IntroDbSegment[],
  currentTime: number,
): IntroDbSegment | null {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return null;
  }

  return (
    segments.find(
      (segment) =>
        currentTime >= segment.startSeconds && currentTime < segment.endSeconds,
    ) ?? null
  );
}

export function isTerminalIntroDbCredit(
  segment: IntroDbSegment,
  segments: IntroDbSegment[],
): boolean {
  if (segment.type !== "credits" || !segment.endsAtMediaEnd) {
    return false;
  }

  return !segments.some(
    (candidate) =>
      candidate.type === "credits" &&
      candidate.startSeconds > segment.startSeconds,
  );
}

const formatVttTimestamp = (seconds: number): string => {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    `${String(wholeSeconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`,
  ].join(":");
};

const segmentTitle = (type: IntroDbSegmentType): string =>
  type.charAt(0).toUpperCase() + type.slice(1);

const introDbChapterColors: Record<IntroDbSegmentType, string> = {
  intro: "rgb(217 70 239 / 0.92)",
  recap: "rgb(245 158 11 / 0.92)",
  credits: "rgb(99 102 241 / 0.92)",
  preview: "rgb(34 197 94 / 0.92)",
};

const selectNonOverlappingSegments = (
  segments: IntroDbSegment[],
): IntroDbSegment[] => {
  const selected: IntroDbSegment[] = [];
  const sorted = [...segments].sort((a, b) => a.startSeconds - b.startSeconds);

  for (const segment of sorted) {
    const previous = selected.at(-1);
    if (previous && segment.startSeconds < previous.endSeconds) {
      continue;
    }
    selected.push(segment);
  }

  return selected;
};

const formatGradientPercent = (value: number): string =>
  `${Number(value.toFixed(3))}%`;

export function buildIntroDbChapterGradient(
  segments: IntroDbSegment[],
  durationSeconds: number,
): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }

  const selected = selectNonOverlappingSegments(segments).filter(
    (segment) =>
      segment.startSeconds >= 0 && segment.endSeconds <= durationSeconds,
  );
  if (selected.length === 0) {
    return null;
  }

  const stops = ["transparent 0%"];
  for (const segment of selected) {
    const start = formatGradientPercent(
      (segment.startSeconds / durationSeconds) * 100,
    );
    const end = formatGradientPercent(
      (segment.endSeconds / durationSeconds) * 100,
    );
    const color = introDbChapterColors[segment.type];

    stops.push(
      `transparent ${start}`,
      `${color} ${start}`,
      `${color} ${end}`,
      `transparent ${end}`,
    );
  }
  stops.push("transparent 100%");

  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function buildIntroDbChaptersVtt(
  segments: IntroDbSegment[],
): string | null {
  const nonOverlapping = selectNonOverlappingSegments(segments);

  if (nonOverlapping.length === 0) {
    return null;
  }

  const cues = nonOverlapping.map(
    (segment, index) =>
      `${index + 1}\n${formatVttTimestamp(segment.startSeconds)} --> ${formatVttTimestamp(segment.endSeconds)}\n${segmentTitle(segment.type)}`,
  );

  return `WEBVTT\n\n${cues.join("\n\n")}\n`;
}
