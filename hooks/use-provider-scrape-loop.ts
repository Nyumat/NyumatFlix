"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWithCapSession } from "@/lib/cap/client";
import { areScrapeProvidersExhausted } from "@/lib/scrape/scrape-provider-menu";
import {
  clearPreferredScrapeProvider,
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
  shouldFinalizeBatchWinner,
  shouldFinalizeRaceWinner,
  type ScrapeCancelReason,
} from "@/lib/scrape/scrape-race-batch";
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
    harvestSubtitleProviders,
  } = config;

  const useScoredRaceWinner = Boolean(scoreRacePayload) && !raceFirstWin;
  const shouldRaceFirstWin = raceFirstWin;

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
  const currentInputRef = useRef<TInput | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  const abortActiveFetches = useCallback(() => {
    for (const controller of abortControllersRef.current) {
      controller.abort();
    }
    abortControllersRef.current.clear();
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
      options: { quiet?: boolean; maxRetries?: number } = {},
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
            headers: { "Content-Type": "application/json" },
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

          // Non-retryable permanent failures
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

  const reopenSkippedProviders = useCallback(
    (failed: Set<TProviderId>) => {
      syncItems((current) =>
        current.map((item) => {
          if (failed.has(item.providerId as TProviderId)) {
            return item;
          }

          if (item.status === "skipped") {
            return {
              ...item,
              status: "waiting" as ScrapeItemStatus,
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

  const runScrapeLoop = useCallback(
    async (
      input: TInput,
      startFromIndex = 0,
      options: { useFailedCache?: boolean } = {},
    ) => {
      const { useFailedCache = true } = options;
      abortActiveFetches();
      const runId = ++runIdRef.current;
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

      let batchStartIndex = startFromIndex;

      while (batchStartIndex < order.length) {
        if (runId !== runIdRef.current) {
          return;
        }

        const { batch, nextIndex } = nextRaceBatch(
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

        setActiveProviderId(batch[0] ?? null);

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

        const tryFinalizeWinner = (): ScrapeAttemptResult<TPayload> | null => {
          const winnerEntry = shouldRaceFirstWin
            ? shouldFinalizeRaceWinner(successes)
            : shouldFinalizeBatchWinner(
                order,
                successes,
                pending,
                useScoredRaceWinner ? scoreRacePayload : undefined,
              );
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
              successes.push({
                providerId,
                attempt: { outcome: "success", payload: attempt.payload },
              });
              return { providerId, attempt, winner: tryFinalizeWinner() };
            }

            if (attempt.outcome === "cancelled") {
              const cancelClass = classifySiblingCancel(attempt.reason);
              if (cancelClass === "skipped") {
                updateItem(providerId, {
                  status: "skipped",
                  error: undefined,
                });
              } else if (cancelClass === "failure") {
                updateItem(providerId, {
                  status: "failure",
                  error: "Timed out",
                });
                failed.add(providerId);
                failedProvidersRef.current.set(mediaKey, failed);
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
            const winnerEntry = useScoredRaceWinner
              ? pickScoredRaceWinner(order, successes, scoreRacePayload!)
              : pickRaceWinner(order, successes);
            if (winnerEntry?.attempt.payload) {
              finalized = {
                outcome: "success",
                payload: winnerEntry.attempt.payload,
              };
            }
          }
        }

        if (finalized?.outcome === "success") {
          const winnerId = finalized.payload.providerId;
          failed.delete(winnerId);
          finalizeBatchWinner(order, winnerId, batch);
          setPreferredScrapeProvider(mediaKey, winnerId);

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
          return;
        }
      }

      if (runId !== runIdRef.current) {
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
      allFailedError,
      applyItemsForOrder,
      finalizeBatchWinner,
      getOrderForInput,
      harvestRemainingSubtitles,
      harvestSubtitleProviders,
      mediaKeyFor,
      onAllProvidersFailed,
      resetItems,
      scrapeProvider,
      soloFirstProviders,
      scoreRacePayload,
      shouldRaceFirstWin,
      syncItems,
      updateItem,
      useScoredRaceWinner,
    ],
  );

  const startScraping = useCallback(
    (input: TInput, preferredProviderId?: TProviderId) => {
      const baseOrder = getOrderForInput(input);
      const mediaKey = mediaKeyFor(input);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      // Direct is the calluspirates bridge — always retry on a fresh scrape pass.
      failed.delete("direct" as TProviderId);
      failedProvidersRef.current.set(mediaKey, failed);
      const preferred =
        preferredProviderId && baseOrder.includes(preferredProviderId)
          ? preferredProviderId
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
      getOrderForInput,
      mediaKeyFor,
      resetItems,
      runScrapeLoop,
    ],
  );

  const resumeScraping = useCallback(
    (
      input: TInput,
      fromProviderId: TProviderId,
      failureReason = "Playback failed",
    ) => {
      const mediaKey = mediaKeyFor(input);
      const failed = failedProvidersRef.current.get(mediaKey) ?? new Set();
      failed.add(fromProviderId);
      failedProvidersRef.current.set(mediaKey, failed);
      clearPreferredScrapeProvider(mediaKey);
      updateItem(fromProviderId, {
        status: "failure",
        error: failureReason,
      });
      reopenSkippedProviders(failed);
      void runScrapeLoop(input, 0, { useFailedCache: true });
    },
    [mediaKeyFor, reopenSkippedProviders, runScrapeLoop, updateItem],
  );

  const switchToProvider = useCallback(
    (input: TInput, providerId: TProviderId) => {
      const mediaKey = mediaKeyFor(input);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      failed.delete(providerId);
      failedProvidersRef.current.set(mediaKey, failed);

      const baseOrder = getOrderForInput(input);
      const order = deprioritizeProviders(baseOrder, failed);
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
      void runScrapeLoop(input, startIndex, { useFailedCache: true });
    },
    [applyItemsForOrder, getOrderForInput, mediaKeyFor, runScrapeLoop],
  );

  const stopScraping = useCallback(() => {
    if (statusRef.current === "idle") {
      return;
    }

    runIdRef.current += 1;
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
      const mediaKey = mediaKeyFor(input);
      failedProvidersRef.current.delete(mediaKey);
      clearPreferredScrapeProvider(mediaKey);
      const order = getOrderForInput(input);
      resetItems(order);
      void runScrapeLoop(input, 0, { useFailedCache: false });
    },
    [getOrderForInput, mediaKeyFor, resetItems, runScrapeLoop],
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
