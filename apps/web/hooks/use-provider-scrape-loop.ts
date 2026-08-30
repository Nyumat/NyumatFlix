"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWithCapSession } from "@/lib/cap/client";
import { areScrapeProvidersExhausted } from "@/lib/scrape/scrape-provider-menu";
import {
  clearPreferredScrapeProvider,
  getPreferredScrapeProvider,
  setPreferredScrapeProvider,
} from "@/lib/scrape/preferred-provider";
import {
  deprioritizeProviders,
  getScrapeAttemptTimeoutMs,
  nextRaceBatch,
  pickRaceWinner,
  pickScoredRaceWinner,
  reorderProvidersWithPreferred,
  SCRAPE_RACE_CONCURRENCY,
  SCRAPE_RACE_FIRST_WIN,
  SOLO_FIRST_SCRAPE_PROVIDERS,
  type RaceAttemptEntry,
} from "@/lib/scrape/provider-race";
import {
  classifySiblingCancel,
  hasPendingStartupProbes,
  shouldFinalizeBatchWinner,
  shouldFinalizeFirstPreferenceMatch,
  shouldFinalizeFirstPreferenceMatchWithStartup,
  shouldFinalizeRaceWinner,
  type ScrapeCancelReason,
} from "@/lib/scrape/scrape-race-batch";
import {
  probeClientPlaybackStartup,
  prefetchScrapePlayback,
} from "@/lib/scrape/client-playback-startup-probe";
import {
  scorePayloadWithStartupProbe,
  pickBestCachedFallback,
} from "@/lib/scrape/playback-startup-score";
import type {
  ScrapeItem,
  ScrapeItemStatus,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import {
  mapWithConcurrency,
  mergePayloadSubtitles,
  SUBTITLE_HARVEST_CONCURRENCY,
  type HarvestableScrapePayload,
} from "@/lib/scrape/subtitle-harvest";

export type ProviderScrapePlayerStatus =
  | "idle"
  | "scraping"
  | "playing"
  | "error";

export const DEFAULT_SCRAPE_RETRY_ATTEMPTS = 2;
export const DEFAULT_SCRAPE_RETRY_DELAY_MS = 500;

function waitWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

type ScrapeAttemptResult<TPayload> =
  | { outcome: "success"; payload: TPayload }
  | { outcome: "failure" }
  | { outcome: "cancelled"; reason: ScrapeCancelReason };

export type ProviderScrapeLoopConfig<
  TProviderId extends string,
  TInput,
  _TPayload extends { providerId: TProviderId } & HarvestableScrapePayload,
> = {
  providerOrder: readonly TProviderId[];
  resolveProviderOrder?: (input: TInput) => readonly TProviderId[];
  providerLabels: Record<TProviderId, string>;
  mediaKeyFor: (input: TInput) => string;
  allFailedError: string;
  apiPath: string;
  buildRequestBody: (
    providerId: TProviderId,
    input: TInput,
  ) => Record<string, unknown>;
  onAllProvidersFailed?: () => void;
  soloFirstProviders?: ReadonlySet<string>;
  /** First successful scrape in a batch wins (TMDB overlay). */
  raceFirstWin?: boolean;
  /** Number of retries on failure (default 2, meaning 3 attempts total). */
  retryAttempts?: number;
  /** Delay between retries in milliseconds (default 500). */
  retryDelayMs?: number;
  /** When set, wait for the batch to finish and pick the best-scoring success. */
  scoreRacePayload?: (payload: _TPayload) => number;
  /** Start playback on the first success that satisfies these hard prefs. */
  matchesPlaybackPreferences?: (payload: _TPayload) => boolean;
  /** Probe master → first segment in-browser; prefer fastest buffer path. */
  raceStartupProbe?: boolean;
  harvestSubtitleProviders?: (
    winnerId: TProviderId,
    order: readonly TProviderId[],
    failed: ReadonlySet<TProviderId>,
  ) => readonly TProviderId[];
};

const initialItems = <TProviderId extends string>(
  providerOrder: readonly TProviderId[],
  providerLabels: Record<TProviderId, string>,
): ScrapeItem[] =>
  providerOrder.map((providerId) => ({
    providerId,
    name: providerLabels[providerId],
    status: "waiting" as ScrapeItemStatus,
  }));

export function useProviderScrapeLoop<
  TProviderId extends string,
  TInput,
  TPayload extends { providerId: TProviderId } & HarvestableScrapePayload,
>(config: ProviderScrapeLoopConfig<TProviderId, TInput, TPayload>) {
  const {
    providerOrder,
    resolveProviderOrder,
    providerLabels,
    mediaKeyFor,
    allFailedError,
    apiPath,
    buildRequestBody,
    onAllProvidersFailed,
    soloFirstProviders = SOLO_FIRST_SCRAPE_PROVIDERS,
    raceFirstWin = SCRAPE_RACE_FIRST_WIN,
    retryAttempts = DEFAULT_SCRAPE_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_SCRAPE_RETRY_DELAY_MS,
    scoreRacePayload,
    matchesPlaybackPreferences,
    raceStartupProbe = false,
    harvestSubtitleProviders,
  } = config;

  const usePreferenceMatchFirstWin =
    Boolean(matchesPlaybackPreferences) && !raceFirstWin;
  const useScoredRaceWinner =
    Boolean(scoreRacePayload) && !raceFirstWin && !usePreferenceMatchFirstWin;
  const shouldRaceFirstWin = raceFirstWin;
  const useStartupAwareRace = raceStartupProbe && Boolean(scoreRacePayload);

  const scoreRacePayloadWithStartup = useCallback(
    (payload: TPayload): number => {
      if (!scoreRacePayload) {
        return 0;
      }
      const base = scoreRacePayload(payload);
      return useStartupAwareRace
        ? scorePayloadWithStartupProbe(base, payload)
        : base;
    },
    [scoreRacePayload, useStartupAwareRace],
  );

  const activeProviderOrderRef = useRef<readonly TProviderId[]>(providerOrder);

  const getOrderForInput = useCallback(
    (input: TInput) => resolveProviderOrder?.(input) ?? providerOrder,
    [providerOrder, resolveProviderOrder],
  );

  const [items, setItems] = useState<ScrapeItem[]>(() =>
    initialItems(providerOrder, providerLabels),
  );
  const itemsRef = useRef<ScrapeItem[]>(items);
  itemsRef.current = items;

  const syncItems = useCallback(
    (updater: (current: ScrapeItem[]) => ScrapeItem[]) => {
      const next = updater(itemsRef.current);
      itemsRef.current = next;
      setItems(next);
    },
    [],
  );
  const [status, setStatus] = useState<ProviderScrapePlayerStatus>("idle");
  const [activeProviderId, setActiveProviderId] = useState<TProviderId | null>(
    null,
  );
  const [result, setResult] = useState<TPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const statusRef = useRef<ProviderScrapePlayerStatus>("idle");
  statusRef.current = status;
  const failedProvidersRef = useRef<Map<string, Set<TProviderId>>>(new Map());
  const payloadCacheRef = useRef<Map<string, Map<TProviderId, TPayload>>>(
    new Map(),
  );
  const playbackLockedRef = useRef(false);
  const pinnedProviderRef = useRef<TProviderId | null>(null);
  const currentInputRef = useRef<TInput | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  const abortActiveFetches = useCallback(() => {
    for (const controller of abortControllersRef.current) {
      controller.abort();
    }
    abortControllersRef.current.clear();
  }, []);

  const storePayloadCache = useCallback(
    (mediaKey: string, providerId: TProviderId, payload: TPayload) => {
      const byProvider =
        payloadCacheRef.current.get(mediaKey) ??
        new Map<TProviderId, TPayload>();
      byProvider.set(providerId, payload);
      payloadCacheRef.current.set(mediaKey, byProvider);
    },
    [],
  );

  const clearPayloadCache = useCallback((mediaKey: string) => {
    payloadCacheRef.current.delete(mediaKey);
  }, []);

  const resetItems = useCallback(
    (order: readonly TProviderId[]) => {
      activeProviderOrderRef.current = order;
      const next = initialItems(order, providerLabels);
      itemsRef.current = next;
      setItems(next);
    },
    [providerLabels],
  );

  const buildItemsForOrder = useCallback(
    (
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
      previousItems: readonly ScrapeItem[],
      overrides?: Partial<
        Record<TProviderId, Partial<Pick<ScrapeItem, "status" | "error">>>
      >,
    ): ScrapeItem[] => {
      const errorByProvider = new Map(
        previousItems.map((item) => [
          item.providerId as TProviderId,
          item.error,
        ]),
      );
      const statusByProvider = new Map(
        previousItems.map((item) => [
          item.providerId as TProviderId,
          item.status,
        ]),
      );

      return order.map((providerId) => {
        const override = overrides?.[providerId];
        if (override) {
          return {
            providerId,
            name: providerLabels[providerId],
            status: override.status ?? "waiting",
            error: override.error,
          };
        }

        if (failed.has(providerId)) {
          const previousStatus = statusByProvider.get(providerId);
          if (previousStatus === "skipped") {
            return {
              providerId,
              name: providerLabels[providerId],
              status: "skipped" as ScrapeItemStatus,
              error: undefined,
            };
          }

          return {
            providerId,
            name: providerLabels[providerId],
            status: "failure" as ScrapeItemStatus,
            error: errorByProvider.get(providerId) ?? "Failed earlier",
          };
        }

        const previousStatus = statusByProvider.get(providerId);
        if (previousStatus === "success" || previousStatus === "unavailable") {
          return {
            providerId,
            name: providerLabels[providerId],
            status: previousStatus,
            error: errorByProvider.get(providerId),
          };
        }

        if (previousStatus === "failure") {
          return {
            providerId,
            name: providerLabels[providerId],
            status: "failure",
            error: errorByProvider.get(providerId),
          };
        }

        return {
          providerId,
          name: providerLabels[providerId],
          status: "waiting" as ScrapeItemStatus,
        };
      });
    },
    [providerLabels],
  );

  const applyItemsForOrder = useCallback(
    (
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
      overrides?: Partial<
        Record<TProviderId, Partial<Pick<ScrapeItem, "status" | "error">>>
      >,
    ) => {
      activeProviderOrderRef.current = order;
      syncItems((current) =>
        buildItemsForOrder(order, failed, current, overrides),
      );
    },
    [buildItemsForOrder, syncItems],
  );

  const updateItem = useCallback(
    (
      providerId: TProviderId,
      next: Partial<Pick<ScrapeItem, "status" | "error">>,
    ) => {
      syncItems((current) =>
        current.map((item) =>
          item.providerId === providerId ? { ...item, ...next } : item,
        ),
      );
    },
    [syncItems],
  );

  const resolveCancelReason = useCallback(
    (signal: AbortSignal): ScrapeCancelReason => {
      const reason = signal.reason;
      if (reason === "winner" || reason === "timeout" || reason === "run") {
        return reason;
      }
      return "run";
    },
    [],
  );

  const scrapeProvider = useCallback(
    async (
      providerId: TProviderId,
      input: TInput,
      runId: number,
      signal: AbortSignal,
      options: {
        quiet?: boolean;
        maxRetries?: number;
      } = {},
    ): Promise<ScrapeAttemptResult<TPayload>> => {
      const quiet = options.quiet === true;
      const retries = options.maxRetries ?? retryAttempts;

      if (!quiet) {
        updateItem(providerId, { status: "pending", error: undefined });
      }

      let lastErrorMessage = "Request failed";
      let isUnavailable = false;

      for (let attempt = 0; attempt <= retries; attempt++) {
        if (runId !== runIdRef.current || signal.aborted) {
          return { outcome: "cancelled", reason: resolveCancelReason(signal) };
        }

        if (attempt > 0) {
          await waitWithSignal(retryDelayMs * attempt, signal);
          if (runId !== runIdRef.current || signal.aborted) {
            return {
              outcome: "cancelled",
              reason: resolveCancelReason(signal),
            };
          }
        }

        let response: Response;

        try {
          response = await fetchWithCapSession(apiPath, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(buildRequestBody(providerId, input)),
            signal,
          });
        } catch {
          if (runId !== runIdRef.current || signal.aborted) {
            return {
              outcome: "cancelled",
              reason: resolveCancelReason(signal),
            };
          }
          lastErrorMessage = "Request failed";
          continue;
        }

        if (runId !== runIdRef.current || signal.aborted) {
          return { outcome: "cancelled", reason: resolveCancelReason(signal) };
        }

        let rawPayload: Record<string, unknown>;

        try {
          rawPayload = (await response.json()) as Record<string, unknown>;
        } catch {
          if (runId !== runIdRef.current || signal.aborted) {
            return {
              outcome: "cancelled",
              reason: resolveCancelReason(signal),
            };
          }
          lastErrorMessage = "Invalid response";
          continue;
        }

        if (runId !== runIdRef.current || signal.aborted) {
          return { outcome: "cancelled", reason: resolveCancelReason(signal) };
        }

        if (!rawPayload.ok) {
          lastErrorMessage =
            typeof rawPayload.error === "string"
              ? rawPayload.error
              : "Unknown error";
          isUnavailable = rawPayload.unavailable === true;

          if (
            isUnavailable ||
            response.status === 403 ||
            lastErrorMessage === "Provider disabled by site policy" ||
            lastErrorMessage === "Direct provider is not available on this site"
          ) {
            break;
          }

          continue;
        }

        if (!quiet) {
          updateItem(providerId, { status: "success", error: undefined });
        }
        return { outcome: "success", payload: rawPayload as TPayload };
      }

      if (!quiet) {
        updateItem(providerId, {
          status: isUnavailable ? "unavailable" : "failure",
          error: lastErrorMessage,
        });
      }
      return { outcome: "failure" };
    },
    [
      apiPath,
      buildRequestBody,
      resolveCancelReason,
      retryAttempts,
      retryDelayMs,
      updateItem,
    ],
  );

  const payloadSubtitles = (payload: TPayload | undefined): ScrapeSubtitle[] =>
    payload?.subtitles ?? [];

  const harvestRemainingSubtitles = useCallback(
    async (
      runId: number,
      input: TInput,
      winnerId: TProviderId,
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
      alreadyHarvested: ReadonlySet<TProviderId>,
    ) => {
      if (!harvestSubtitleProviders) {
        return;
      }

      const donorIds = harvestSubtitleProviders(winnerId, order, failed).filter(
        (providerId) =>
          providerId !== winnerId && !alreadyHarvested.has(providerId),
      );

      await mapWithConcurrency(
        donorIds,
        SUBTITLE_HARVEST_CONCURRENCY,
        async (providerId) => {
          if (runId !== runIdRef.current) {
            return;
          }

          const controller = new AbortController();
          abortControllersRef.current.add(controller);
          const timeoutId = window.setTimeout(
            () => {
              if (!controller.signal.aborted) {
                controller.abort("timeout");
              }
            },
            getScrapeAttemptTimeoutMs(providerId, true),
          );
          controller.signal.addEventListener(
            "abort",
            () => window.clearTimeout(timeoutId),
            { once: true },
          );

          try {
            const attempt = await scrapeProvider(
              providerId,
              input,
              runId,
              controller.signal,
              { quiet: true },
            );

            if (runId !== runIdRef.current) {
              return;
            }

            if (attempt.outcome !== "success") {
              return;
            }

            const incoming = payloadSubtitles(attempt.payload);
            if (incoming.length === 0) {
              return;
            }

            setResult((current) =>
              current ? mergePayloadSubtitles(current, incoming) : current,
            );
          } finally {
            abortControllersRef.current.delete(controller);
          }
        },
      );
    },
    [harvestSubtitleProviders, scrapeProvider],
  );

  const harvestRemainingMenuProviders = useCallback(
    async (
      runId: number,
      input: TInput,
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
    ) => {
      const mediaKey = mediaKeyFor(input);
      const toHarvest = order.filter((providerId) => {
        const item =
          itemsRef.current.find((entry) => entry.providerId === providerId) ??
          null;

        if (failed.has(providerId)) {
          return item?.error === "Timed out";
        }

        const status = item?.status ?? "idle";
        return status !== "success" && status !== "unavailable";
      });

      await mapWithConcurrency(
        toHarvest,
        SUBTITLE_HARVEST_CONCURRENCY,
        async (providerId) => {
          if (runId !== runIdRef.current) {
            return;
          }

          const controller = new AbortController();
          abortControllersRef.current.add(controller);
          const timeoutId = window.setTimeout(
            () => {
              if (!controller.signal.aborted) {
                controller.abort("timeout");
              }
            },
            getScrapeAttemptTimeoutMs(providerId, true),
          );
          controller.signal.addEventListener(
            "abort",
            () => window.clearTimeout(timeoutId),
            { once: true },
          );

          try {
            const attempt = await scrapeProvider(
              providerId,
              input,
              runId,
              controller.signal,
            );
            if (runId !== runIdRef.current || attempt.outcome !== "success") {
              return;
            }

            const mutableFailed =
              failedProvidersRef.current.get(mediaKey) ??
              new Set<TProviderId>();
            mutableFailed.delete(providerId);
            failedProvidersRef.current.set(mediaKey, mutableFailed);
            storePayloadCache(mediaKey, providerId, attempt.payload);
          } finally {
            abortControllersRef.current.delete(controller);
          }
        },
      );
    },
    [mediaKeyFor, scrapeProvider, storePayloadCache],
  );

  const pickWarmedFallback = useCallback(
    (
      mediaKey: string,
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
      excludeIds: ReadonlySet<TProviderId> = new Set<TProviderId>(),
    ): { providerId: TProviderId; payload: TPayload } | null => {
      const cache = payloadCacheRef.current.get(mediaKey);
      if (!cache) {
        return null;
      }

      const scoreFn = useStartupAwareRace
        ? scoreRacePayloadWithStartup
        : scoreRacePayload;

      return pickBestCachedFallback({
        order,
        cache,
        failed,
        excludeIds,
        scorePayload: scoreFn,
        requireStartupProbePass: useStartupAwareRace,
      });
    },
    [scoreRacePayload, scoreRacePayloadWithStartup, useStartupAwareRace],
  );

  const startBackgroundHarvest = useCallback(
    (
      runId: number,
      input: TInput,
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
      excludeId: TProviderId,
    ) => {
      const harvestOrder = order.filter(
        (providerId) => providerId !== excludeId,
      );
      if (harvestOrder.length === 0) {
        return;
      }

      void harvestRemainingMenuProviders(runId, input, harvestOrder, failed);
    },
    [harvestRemainingMenuProviders],
  );

  const finalizePlaybackWinner = useCallback(
    (winnerId: TProviderId, batch: readonly TProviderId[]) => {
      syncItems((current) =>
        current.map((item) => {
          const providerId = item.providerId as TProviderId;

          if (providerId === winnerId) {
            return {
              ...item,
              status: "success" as ScrapeItemStatus,
              error: undefined,
            };
          }

          if (batch.includes(providerId) && item.status === "pending") {
            return {
              ...item,
              status: "skipped" as ScrapeItemStatus,
              error: undefined,
            };
          }

          return item;
        }),
      );
    },
    [syncItems],
  );

  const finalizeBatchWinner = useCallback(
    (
      order: readonly TProviderId[],
      winnerId: TProviderId,
      batch: readonly TProviderId[],
    ) => {
      const winnerIndex = order.indexOf(winnerId);

      syncItems((current) =>
        current.map((item) => {
          const providerId = item.providerId as TProviderId;
          const itemIndex = order.indexOf(providerId);

          if (providerId === winnerId) {
            return {
              ...item,
              status: "success" as ScrapeItemStatus,
              error: undefined,
            };
          }

          if (batch.includes(providerId) && item.status === "pending") {
            return {
              ...item,
              status: "skipped" as ScrapeItemStatus,
              error: undefined,
            };
          }

          if (
            winnerIndex >= 0 &&
            itemIndex > winnerIndex &&
            item.status === "waiting"
          ) {
            return {
              ...item,
              status: "skipped" as ScrapeItemStatus,
              error: undefined,
            };
          }

          return item;
        }),
      );
    },
    [syncItems],
  );

  const activateCachedProvider = useCallback(
    (
      runId: number,
      input: TInput,
      mediaKey: string,
      providerId: TProviderId,
      payload: TPayload,
      order: readonly TProviderId[],
      failed: ReadonlySet<TProviderId>,
    ) => {
      pinnedProviderRef.current = providerId;
      playbackLockedRef.current = true;
      currentInputRef.current = input;
      storePayloadCache(mediaKey, providerId, payload);
      finalizePlaybackWinner(providerId, []);
      setPreferredScrapeProvider(mediaKey, providerId);
      setResult(payload);
      setStatus("playing");
      setActiveProviderId(providerId);
      setError(null);
      updateItem(providerId, { status: "success", error: undefined });
      void startBackgroundHarvest(runId, input, order, failed, providerId);
    },
    [
      finalizePlaybackWinner,
      startBackgroundHarvest,
      storePayloadCache,
      updateItem,
    ],
  );

  const runScrapeLoop = useCallback(
    async (
      input: TInput,
      startFromIndex = 0,
      options: { useFailedCache?: boolean; pinned?: boolean } = {},
    ) => {
      const { useFailedCache = true, pinned: pinnedOption = false } = options;
      const isPinned = pinnedOption && pinnedProviderRef.current !== null;
      abortActiveFetches();
      const runId = ++runIdRef.current;
      playbackLockedRef.current = false;
      currentInputRef.current = input;
      setStatus("scraping");
      setResult(null);
      setError(null);

      const mediaKey = mediaKeyFor(input);
      const failed = useFailedCache
        ? (failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>())
        : new Set<TProviderId>();
      let order =
        startFromIndex > 0
          ? activeProviderOrderRef.current
          : getOrderForInput(input);

      if (useFailedCache && failed.size > 0) {
        order = deprioritizeProviders(order, failed);
      }

      if (startFromIndex === 0) {
        activeProviderOrderRef.current = order;
        if (useFailedCache && failed.size > 0) {
          applyItemsForOrder(order, failed);
        } else {
          resetItems(order);
        }
      }

      if (isPinned && pinnedProviderRef.current) {
        void startBackgroundHarvest(
          runId,
          input,
          order,
          failed,
          pinnedProviderRef.current,
        );
      }

      const tryWarmPreferredCachedProvider = (): boolean => {
        if (
          startFromIndex !== 0 ||
          playbackLockedRef.current ||
          !useFailedCache
        ) {
          return false;
        }

        const storedPreferred = getPreferredScrapeProvider(mediaKey);
        if (!storedPreferred) {
          return false;
        }

        const preferredId = storedPreferred as TProviderId;
        if (!order.includes(preferredId) || failed.has(preferredId)) {
          return false;
        }

        const cached = payloadCacheRef.current.get(mediaKey)?.get(preferredId);
        if (!cached) {
          return false;
        }

        if (matchesPlaybackPreferences && !matchesPlaybackPreferences(cached)) {
          return false;
        }

        storePayloadCache(mediaKey, preferredId, cached);
        finalizePlaybackWinner(preferredId, []);
        playbackLockedRef.current = true;
        setPreferredScrapeProvider(mediaKey, preferredId);
        setResult(cached);
        setStatus("playing");
        setActiveProviderId(preferredId);
        return true;
      };

      let batchStartIndex = startFromIndex;

      if (tryWarmPreferredCachedProvider()) {
        if (runId !== runIdRef.current) {
          return;
        }
        batchStartIndex = order.length;
      }

      while (batchStartIndex < order.length) {
        if (runId !== runIdRef.current) {
          return;
        }

        const pinnedId = pinnedProviderRef.current;
        const { batch, nextIndex } =
          isPinned && pinnedId
            ? {
                batch: failed.has(pinnedId) ? [] : [pinnedId],
                nextIndex: order.length,
              }
            : nextRaceBatch(
                order,
                batchStartIndex,
                failed,
                SCRAPE_RACE_CONCURRENCY,
                soloFirstProviders,
              );
        batchStartIndex = nextIndex;

        if (batch.length === 0) {
          break;
        }

        if (!playbackLockedRef.current) {
          setActiveProviderId(batch[0] ?? null);
        }

        const controllers = new Map<TProviderId, AbortController>();
        const pending = new Set<TProviderId>(batch);
        const successes: RaceAttemptEntry<TProviderId, TPayload>[] = [];

        const cancelSiblings = (winnerId: TProviderId) => {
          for (const [providerId, controller] of controllers) {
            if (providerId === winnerId) {
              continue;
            }
            if (!controller.signal.aborted) {
              controller.abort("winner");
            }
          }
        };

        let batchWinner: ScrapeAttemptResult<TPayload> | null = null;
        let resolveBatchEarly: (() => void) | undefined;
        const batchEarlyPromise = new Promise<void>((resolve) => {
          resolveBatchEarly = resolve;
        });

        const scheduleStartupProbe = (
          providerId: TProviderId,
          payload: TPayload,
          signal?: AbortSignal,
        ) => {
          if (!useStartupAwareRace) {
            return;
          }

          const playUrl =
            typeof payload.playUrl === "string" ? payload.playUrl : "";
          if (!playUrl) {
            return;
          }

          prefetchScrapePlayback(playUrl);

          void probeClientPlaybackStartup(playUrl, { signal }).then((probe) => {
            if (runId !== runIdRef.current || signal?.aborted) {
              return;
            }

            const enriched = {
              ...payload,
              startupProbeMs: probe.ms,
              startupProbeOk: probe.ok,
            };
            storePayloadCache(mediaKey, providerId, enriched);

            const successEntry = successes.find(
              (entry) => entry.providerId === providerId,
            );
            if (successEntry?.attempt.outcome === "success") {
              successEntry.attempt.payload = enriched;
            }

            const winner = tryFinalizeWinner();
            if (winner?.outcome === "success") {
              resolveBatchEarly?.();
            }
          });
        };

        const tryFinalizeWinner = (): ScrapeAttemptResult<TPayload> | null => {
          if (playbackLockedRef.current) {
            return null;
          }

          let winnerEntry: RaceAttemptEntry<TProviderId, TPayload> | undefined;

          if (shouldRaceFirstWin) {
            winnerEntry = shouldFinalizeRaceWinner(successes);
          } else if (usePreferenceMatchFirstWin && matchesPlaybackPreferences) {
            winnerEntry = useStartupAwareRace
              ? shouldFinalizeFirstPreferenceMatchWithStartup(
                  successes,
                  matchesPlaybackPreferences,
                )
              : shouldFinalizeFirstPreferenceMatch(
                  successes,
                  matchesPlaybackPreferences,
                );
            if (
              !winnerEntry &&
              pending.size === 0 &&
              successes.length > 0 &&
              scoreRacePayload &&
              (!useStartupAwareRace || !hasPendingStartupProbes(successes))
            ) {
              winnerEntry = pickScoredRaceWinner(
                order,
                successes,
                scoreRacePayloadWithStartup,
              );
            }
          } else {
            winnerEntry = shouldFinalizeBatchWinner(
              order,
              successes,
              pending,
              useScoredRaceWinner || useStartupAwareRace
                ? scoreRacePayloadWithStartup
                : undefined,
              useStartupAwareRace,
            );
          }

          if (!winnerEntry?.attempt.payload) {
            return null;
          }

          cancelSiblings(winnerEntry.providerId);
          const finalizedAttempt: ScrapeAttemptResult<TPayload> = {
            outcome: "success",
            payload: winnerEntry.attempt.payload,
          };
          batchWinner = finalizedAttempt;
          resolveBatchEarly?.();
          resolveBatchEarly = undefined;
          return finalizedAttempt;
        };

        const attemptPromises = batch.map(
          async (
            providerId,
          ): Promise<{
            providerId: TProviderId;
            attempt: ScrapeAttemptResult<TPayload>;
            winner?: ScrapeAttemptResult<TPayload> | null;
          }> => {
            const controller = new AbortController();
            controllers.set(providerId, controller);
            abortControllersRef.current.add(controller);

            const timeoutId = window.setTimeout(
              () => {
                if (!controller.signal.aborted) {
                  controller.abort("timeout");
                }
              },
              getScrapeAttemptTimeoutMs(providerId, batch.length > 1),
            );
            controller.signal.addEventListener(
              "abort",
              () => window.clearTimeout(timeoutId),
              { once: true },
            );

            const attempt = await scrapeProvider(
              providerId,
              input,
              runId,
              controller.signal,
            );

            abortControllersRef.current.delete(controller);
            pending.delete(providerId);

            if (runId !== runIdRef.current) {
              return { providerId, attempt };
            }

            if (attempt.outcome === "success") {
              storePayloadCache(mediaKey, providerId, attempt.payload);
              successes.push({
                providerId,
                attempt: { outcome: "success", payload: attempt.payload },
              });
              scheduleStartupProbe(
                providerId,
                attempt.payload,
                controller.signal,
              );
              return { providerId, attempt, winner: tryFinalizeWinner() };
            }

            if (attempt.outcome === "cancelled") {
              const cancelClass = classifySiblingCancel(attempt.reason);
              if (cancelClass === "skipped") {
                updateItem(providerId, {
                  status: usePreferenceMatchFirstWin
                    ? ("waiting" as ScrapeItemStatus)
                    : ("skipped" as ScrapeItemStatus),
                  error: undefined,
                });
              } else if (cancelClass === "failure") {
                const softTimeout =
                  attempt.reason === "timeout" &&
                  (usePreferenceMatchFirstWin || playbackLockedRef.current);
                if (softTimeout) {
                  updateItem(providerId, {
                    status: "waiting" as ScrapeItemStatus,
                    error: undefined,
                  });
                } else {
                  updateItem(providerId, {
                    status: "failure",
                    error: "Timed out",
                  });
                  failed.add(providerId);
                  failedProvidersRef.current.set(mediaKey, failed);
                }
              }
              return { providerId, attempt };
            }

            failed.add(providerId);
            failedProvidersRef.current.set(mediaKey, failed);
            return { providerId, attempt };
          },
        );

        const settledPromise = Promise.all(attemptPromises);
        await Promise.race([settledPromise, batchEarlyPromise]);

        if (runId !== runIdRef.current) {
          return;
        }

        let finalized: ScrapeAttemptResult<TPayload> | null = batchWinner;

        if (!finalized) {
          const settled = await settledPromise;
          finalized =
            settled
              .map((entry) => entry.winner)
              .find(
                (
                  winner,
                ): winner is Extract<
                  ScrapeAttemptResult<TPayload>,
                  { outcome: "success" }
                > => Boolean(winner && winner.outcome === "success"),
              ) ?? null;

          if (!finalized) {
            const winnerEntry =
              scoreRacePayload &&
              (usePreferenceMatchFirstWin ||
                useScoredRaceWinner ||
                useStartupAwareRace)
                ? pickScoredRaceWinner(
                    order,
                    successes,
                    scoreRacePayloadWithStartup,
                  )
                : pickRaceWinner(order, successes);
            if (winnerEntry?.attempt.payload) {
              finalized = {
                outcome: "success",
                payload: winnerEntry.attempt.payload,
              };
            }
          }
        }

        if (finalized?.outcome === "success" && !playbackLockedRef.current) {
          const winnerId = finalized.payload.providerId;
          failed.delete(winnerId);
          if (usePreferenceMatchFirstWin) {
            finalizePlaybackWinner(winnerId, batch);
          } else {
            finalizeBatchWinner(order, winnerId, batch);
          }
          setPreferredScrapeProvider(mediaKey, winnerId);
          playbackLockedRef.current = true;

          let payload = finalized.payload;
          const siblingSubtitles = harvestSubtitleProviders
            ? successes.flatMap((entry) =>
                entry.providerId === winnerId
                  ? []
                  : payloadSubtitles(entry.attempt.payload),
              )
            : [];
          if (siblingSubtitles.length > 0) {
            payload = mergePayloadSubtitles(payload, siblingSubtitles);
          }

          setResult(payload);
          setStatus("playing");
          setActiveProviderId(winnerId);
          failedProvidersRef.current.set(mediaKey, failed);

          const alreadyHarvested = new Set(
            successes.map((entry) => entry.providerId),
          );
          void harvestRemainingSubtitles(
            runId,
            input,
            winnerId,
            order,
            failed,
            alreadyHarvested,
          );
          continue;
        }
      }

      if (runId !== runIdRef.current) {
        return;
      }

      if (playbackLockedRef.current) {
        void harvestRemainingMenuProviders(runId, input, order, failed);
        return;
      }

      if (isPinned && pinnedProviderRef.current) {
        const warmed = pickWarmedFallback(
          mediaKey,
          order,
          failed,
          new Set([pinnedProviderRef.current]),
        );
        if (warmed) {
          activateCachedProvider(
            runId,
            input,
            mediaKey,
            warmed.providerId,
            warmed.payload,
            order,
            failed,
          );
          return;
        }

        const hasRemaining = order.some(
          (providerId) => !failed.has(providerId),
        );
        if (hasRemaining) {
          pinnedProviderRef.current = null;
          void runScrapeLoop(input, 0, {
            useFailedCache: true,
            pinned: false,
          });
          return;
        }

        syncItems((current) =>
          current.map((item) =>
            item.status === "waiting"
              ? {
                  ...item,
                  status: "skipped" as ScrapeItemStatus,
                  error: undefined,
                }
              : item,
          ),
        );
        setStatus("error");
        setError(allFailedError);
        setActiveProviderId(null);
        onAllProvidersFailed?.();
        return;
      }

      const nextUntriedIndex = order.findIndex((providerId) => {
        if (failed.has(providerId)) {
          return false;
        }

        const itemStatus =
          itemsRef.current.find((item) => item.providerId === providerId)
            ?.status ?? "idle";
        return itemStatus === "waiting" || itemStatus === "idle";
      });

      if (nextUntriedIndex >= 0) {
        void runScrapeLoop(input, nextUntriedIndex, options);
        return;
      }

      if (!areScrapeProvidersExhausted(itemsRef.current, order)) {
        setStatus("idle");
        setError(null);
        setActiveProviderId(null);
        return;
      }

      syncItems((current) =>
        current.map((item) =>
          item.status === "waiting"
            ? {
                ...item,
                status: "skipped" as ScrapeItemStatus,
                error: undefined,
              }
            : item,
        ),
      );
      setStatus("error");
      setError(allFailedError);
      setActiveProviderId(null);
      onAllProvidersFailed?.();
    },
    [
      abortActiveFetches,
      activateCachedProvider,
      allFailedError,
      applyItemsForOrder,
      finalizeBatchWinner,
      finalizePlaybackWinner,
      getOrderForInput,
      harvestRemainingMenuProviders,
      harvestRemainingSubtitles,
      harvestSubtitleProviders,
      matchesPlaybackPreferences,
      mediaKeyFor,
      onAllProvidersFailed,
      pickWarmedFallback,
      resetItems,
      scrapeProvider,
      soloFirstProviders,
      scoreRacePayload,
      scoreRacePayloadWithStartup,
      shouldRaceFirstWin,
      startBackgroundHarvest,
      storePayloadCache,
      syncItems,
      updateItem,
      usePreferenceMatchFirstWin,
      useScoredRaceWinner,
      useStartupAwareRace,
    ],
  );

  const startScraping = useCallback(
    (input: TInput, preferredProviderId?: TProviderId) => {
      pinnedProviderRef.current = null;
      const baseOrder = getOrderForInput(input);
      const mediaKey = mediaKeyFor(input);
      clearPayloadCache(mediaKey);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      // Direct is the calluspirates bridge — always retry on a fresh scrape pass.
      failed.delete("direct" as TProviderId);
      failedProvidersRef.current.set(mediaKey, failed);
      const preferredFromStorage = getPreferredScrapeProvider(mediaKey);
      const preferred =
        preferredProviderId && baseOrder.includes(preferredProviderId)
          ? preferredProviderId
          : preferredFromStorage &&
              baseOrder.includes(preferredFromStorage as TProviderId)
            ? (preferredFromStorage as TProviderId)
            : undefined;
      let order = reorderProvidersWithPreferred(baseOrder, preferred);
      if (failed.size > 0) {
        order = deprioritizeProviders(order, failed);
      }
      activeProviderOrderRef.current = order;
      if (failed.size > 0) {
        applyItemsForOrder(order, failed);
      } else {
        resetItems(order);
      }
      void runScrapeLoop(input, 0, { useFailedCache: true });
    },
    [
      applyItemsForOrder,
      clearPayloadCache,
      getOrderForInput,
      mediaKeyFor,
      resetItems,
      runScrapeLoop,
    ],
  );

  const switchToProvider = useCallback(
    (input: TInput, providerId: TProviderId) => {
      const mediaKey = mediaKeyFor(input);
      const baseOrder = getOrderForInput(input);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      const order = deprioritizeProviders(baseOrder, failed);

      pinnedProviderRef.current = providerId;

      const cached = payloadCacheRef.current.get(mediaKey)?.get(providerId);
      if (cached) {
        runIdRef.current += 1;
        abortActiveFetches();
        activateCachedProvider(
          runIdRef.current,
          input,
          mediaKey,
          providerId,
          cached,
          order,
          failed,
        );
        return;
      }

      failed.delete(providerId);
      failedProvidersRef.current.set(mediaKey, failed);

      const startIndex = order.indexOf(providerId);
      if (startIndex < 0) {
        return;
      }

      applyItemsForOrder(order, failed, {
        [providerId]: {
          status: "waiting" as ScrapeItemStatus,
          error: undefined,
        },
      } as Partial<
        Record<TProviderId, Partial<Pick<ScrapeItem, "status" | "error">>>
      >);
      void runScrapeLoop(input, startIndex, {
        useFailedCache: true,
        pinned: true,
      });
    },
    [
      abortActiveFetches,
      activateCachedProvider,
      applyItemsForOrder,
      getOrderForInput,
      mediaKeyFor,
      runScrapeLoop,
    ],
  );

  const resumeScraping = useCallback(
    (
      input: TInput,
      fromProviderId: TProviderId,
      _failureReason = "Playback failed",
    ) => {
      const mediaKey = mediaKeyFor(input);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      failed.add(fromProviderId);
      failedProvidersRef.current.set(mediaKey, failed);
      clearPreferredScrapeProvider(mediaKey);
      updateItem(fromProviderId, {
        status: "skipped" as ScrapeItemStatus,
        error: undefined,
      });

      const order = deprioritizeProviders(getOrderForInput(input), failed);
      activeProviderOrderRef.current = order;

      const warmed = pickWarmedFallback(
        mediaKey,
        order,
        failed,
        new Set([fromProviderId]),
      );
      if (warmed) {
        runIdRef.current += 1;
        abortActiveFetches();
        activateCachedProvider(
          runIdRef.current,
          input,
          mediaKey,
          warmed.providerId,
          warmed.payload,
          order,
          failed,
        );
        return;
      }

      pinnedProviderRef.current = null;
      const hasRemaining = order.some((providerId) => !failed.has(providerId));
      if (hasRemaining) {
        applyItemsForOrder(order, failed);
        void runScrapeLoop(input, 0, {
          useFailedCache: true,
          pinned: false,
        });
        return;
      }

      syncItems((current) =>
        current.map((item) =>
          item.status === "waiting"
            ? {
                ...item,
                status: "skipped" as ScrapeItemStatus,
                error: undefined,
              }
            : item,
        ),
      );
      setStatus("error");
      setError(allFailedError);
      setActiveProviderId(null);
      onAllProvidersFailed?.();
    },
    [
      abortActiveFetches,
      activateCachedProvider,
      allFailedError,
      applyItemsForOrder,
      getOrderForInput,
      mediaKeyFor,
      onAllProvidersFailed,
      pickWarmedFallback,
      runScrapeLoop,
      syncItems,
      updateItem,
    ],
  );

  const stopScraping = useCallback(() => {
    if (statusRef.current === "idle") {
      return;
    }

    runIdRef.current += 1;
    playbackLockedRef.current = false;
    pinnedProviderRef.current = null;
    abortActiveFetches();

    currentInputRef.current = null;
    setStatus("idle");
    setActiveProviderId(null);
    setResult(null);
    setError(null);
    resetItems(providerOrder);
  }, [abortActiveFetches, providerOrder, resetItems]);

  const retryAllScraping = useCallback(
    (input: TInput) => {
      pinnedProviderRef.current = null;
      const mediaKey = mediaKeyFor(input);
      failedProvidersRef.current.delete(mediaKey);
      clearPayloadCache(mediaKey);
      clearPreferredScrapeProvider(mediaKey);
      const order = getOrderForInput(input);
      resetItems(order);
      void runScrapeLoop(input, 0, { useFailedCache: false });
    },
    [
      clearPayloadCache,
      getOrderForInput,
      mediaKeyFor,
      resetItems,
      runScrapeLoop,
    ],
  );

  useEffect(
    () => () => {
      runIdRef.current += 1;
      abortActiveFetches();
    },
    [abortActiveFetches],
  );

  return {
    items,
    status,
    activeProviderId,
    result,
    error,
    startScraping,
    resumeScraping,
    switchToProvider,
    retryAllScraping,
    stopScraping,
  };
}
