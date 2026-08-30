import type { ScorableAnimeScrapePayload } from "@/lib/playback/playback-preferences";

export type ScrapeStartupProbeFields = {
  startupProbeMs?: number;
  startupProbeOk?: boolean;
};

export const STARTUP_PROBE_PENDING_PENALTY = 50_000;
export const STARTUP_PROBE_FAILED_PENALTY = 40_000;
export const STARTUP_PROBE_MAX_BONUS = 4_000;

/** Lower latency → higher bonus (caps at STARTUP_PROBE_MAX_BONUS). */
export const scorePlaybackStartupMs = (ms: number): number => {
  if (!Number.isFinite(ms) || ms < 0) {
    return 0;
  }

  const capped = Math.min(ms, 12_000);
  return Math.max(0, STARTUP_PROBE_MAX_BONUS - Math.round(capped / 3));
};

export const scorePayloadWithStartupProbe = (
  baseScore: number,
  payload: ScrapeStartupProbeFields,
): number => {
  if (payload.startupProbeOk === undefined) {
    return baseScore - STARTUP_PROBE_PENDING_PENALTY;
  }

  if (!payload.startupProbeOk) {
    return baseScore - STARTUP_PROBE_FAILED_PENALTY;
  }

  return baseScore + scorePlaybackStartupMs(payload.startupProbeMs ?? 12_000);
};

export const payloadStartupProbeReady = (
  payload: ScrapeStartupProbeFields,
): boolean => payload.startupProbeOk !== undefined;

export const payloadStartupProbePassed = (
  payload: ScrapeStartupProbeFields,
): boolean => payload.startupProbeOk === true;

export type StartupAwareScorablePayload = ScorableAnimeScrapePayload &
  ScrapeStartupProbeFields;

export const pickBestCachedFallback = <
  TProviderId extends string,
  TPayload extends ScrapeStartupProbeFields,
>(options: {
  order: readonly TProviderId[];
  cache: ReadonlyMap<TProviderId, TPayload>;
  failed: ReadonlySet<TProviderId>;
  excludeIds?: ReadonlySet<TProviderId>;
  scorePayload?: (payload: TPayload) => number;
  requireStartupProbePass?: boolean;
}): { providerId: TProviderId; payload: TPayload } | null => {
  const excludeIds = options.excludeIds ?? new Set<TProviderId>();
  let best: {
    providerId: TProviderId;
    payload: TPayload;
    score: number;
  } | null = null;

  for (const providerId of options.order) {
    if (options.failed.has(providerId) || excludeIds.has(providerId)) {
      continue;
    }

    const payload = options.cache.get(providerId);
    if (!payload) {
      continue;
    }

    if (options.requireStartupProbePass && payload.startupProbeOk === false) {
      continue;
    }

    if (!options.scorePayload) {
      return { providerId, payload };
    }

    const score = options.scorePayload(payload);
    if (!best || score > best.score) {
      best = { providerId, payload, score };
    }
  }

  if (best) {
    return { providerId: best.providerId, payload: best.payload };
  }

  if (options.requireStartupProbePass && options.scorePayload) {
    return pickBestCachedFallback({
      ...options,
      requireStartupProbePass: false,
    });
  }

  return null;
};
