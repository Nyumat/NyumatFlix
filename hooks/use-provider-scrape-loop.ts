"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearPreferredScrapeProvider,
  getPreferredScrapeProvider,
  setPreferredScrapeProvider,
} from "@/lib/scrape/preferred-provider";
import {
  nextRaceBatch,
  SCRAPE_ATTEMPT_TIMEOUT_MS,
  SCRAPE_RACE_CONCURRENCY,
} from "@/lib/scrape/provider-race";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";

export type ProviderScrapePlayerStatus =
  | "idle"
  | "scraping"
  | "playing"
  | "error";

type ScrapeAttemptResult<TPayload> =
  | { outcome: "success"; payload: TPayload }
  | { outcome: "failure" }
  | { outcome: "cancelled" };

export type ProviderScrapeLoopConfig<
  TProviderId extends string,
  TInput,
  _TPayload extends { providerId: TProviderId },
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
  TPayload extends { providerId: TProviderId },
>(config: ProviderScrapeLoopConfig<TProviderId, TInput, TPayload>) {
  const {
    providerOrder,
    resolveProviderOrder,
    providerLabels,
    mediaKeyFor,
    allFailedError,
    apiPath,
    buildRequestBody,
  } = config;

  const activeProviderOrderRef = useRef<readonly TProviderId[]>(providerOrder);

  const getOrderForInput = useCallback(
    (input: TInput) => resolveProviderOrder?.(input) ?? providerOrder,
    [providerOrder, resolveProviderOrder],
  );

  const [items, setItems] = useState<ScrapeItem[]>(() =>
    initialItems(providerOrder, providerLabels),
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
      setItems(initialItems(order, providerLabels));
    },
    [providerLabels],
  );

  const updateItem = useCallback(
    (
      providerId: TProviderId,
      next: Partial<Pick<ScrapeItem, "status" | "error">>,
    ) => {
      setItems((current) =>
        current.map((item) =>
          item.providerId === providerId ? { ...item, ...next } : item,
        ),
      );
    },
    [],
  );

  const scrapeProvider = useCallback(
    async (
      providerId: TProviderId,
      input: TInput,
      runId: number,
      signal: AbortSignal,
    ): Promise<ScrapeAttemptResult<TPayload>> => {
      updateItem(providerId, { status: "pending", error: undefined });

      let response: Response;

      try {
        response = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRequestBody(providerId, input)),
          signal,
        });
      } catch {
        if (runId !== runIdRef.current || signal.aborted) {
          return { outcome: "cancelled" };
        }

        updateItem(providerId, {
          status: "failure",
          error: "Request failed",
        });
        return { outcome: "failure" };
      }

      if (runId !== runIdRef.current || signal.aborted) {
        return { outcome: "cancelled" };
      }

      let rawPayload: Record<string, unknown>;

      try {
        rawPayload = (await response.json()) as Record<string, unknown>;
      } catch {
        if (runId !== runIdRef.current || signal.aborted) {
          return { outcome: "cancelled" };
        }

        updateItem(providerId, {
          status: "failure",
          error: "Invalid response",
        });
        return { outcome: "failure" };
      }

      if (runId !== runIdRef.current || signal.aborted) {
        return { outcome: "cancelled" };
      }

      if (!rawPayload.ok) {
        updateItem(providerId, {
          status: "failure",
          error:
            typeof rawPayload.error === "string"
              ? rawPayload.error
              : "Unknown error",
        });
        return { outcome: "failure" };
      }

      updateItem(providerId, { status: "success", error: undefined });
      return { outcome: "success", payload: rawPayload as TPayload };
    },
    [apiPath, buildRequestBody, updateItem],
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
        ? (failedProvidersRef.current.get(mediaKey) ?? new Set())
        : new Set<TProviderId>();
      const order =
        startFromIndex > 0
          ? activeProviderOrderRef.current
          : getOrderForInput(input);

      if (startFromIndex === 0) {
        activeProviderOrderRef.current = order;
        resetItems(order);
      }

      let index = startFromIndex;

      while (index < order.length) {
        if (runId !== runIdRef.current) {
          return;
        }

        const { batch, nextIndex } = nextRaceBatch(
          order,
          index,
          failed,
          SCRAPE_RACE_CONCURRENCY,
        );

        if (batch.length === 0) {
          break;
        }

        setActiveProviderId(batch[0] ?? null);

        const controllers = batch.map(() => {
          const controller = new AbortController();
          abortControllersRef.current.add(controller);
          const timeoutId = window.setTimeout(() => {
            controller.abort();
          }, SCRAPE_ATTEMPT_TIMEOUT_MS);
          controller.signal.addEventListener(
            "abort",
            () => window.clearTimeout(timeoutId),
            { once: true },
          );
          return controller;
        });

        type AttemptEntry = {
          providerId: TProviderId;
          attempt: ScrapeAttemptResult<TPayload>;
        };

        const attemptPromises = batch.map((providerId, batchIndex) =>
          scrapeProvider(
            providerId,
            input,
            runId,
            controllers[batchIndex]!.signal,
          ).then(
            (attempt): AttemptEntry => ({
              providerId,
              attempt,
            }),
          ),
        );

        const settled: AttemptEntry[] = [];
        let winner: AttemptEntry | undefined;

        await new Promise<void>((resolve) => {
          let remaining = attemptPromises.length;
          if (remaining === 0) {
            resolve();
            return;
          }

          for (const promise of attemptPromises) {
            void promise.then((entry) => {
              settled.push(entry);

              if (
                !winner &&
                entry.attempt.outcome === "success" &&
                runId === runIdRef.current
              ) {
                winner = entry;
                for (const controller of controllers) {
                  if (!controller.signal.aborted) {
                    controller.abort();
                  }
                }
              }

              remaining -= 1;
              if (remaining === 0 || winner) {
                if (winner && remaining > 0) {
                  void Promise.allSettled(attemptPromises).then(() =>
                    resolve(),
                  );
                  return;
                }
                resolve();
              }
            });
          }
        });

        for (const controller of controllers) {
          abortControllersRef.current.delete(controller);
        }

        if (runId !== runIdRef.current) {
          return;
        }

        if (winner?.attempt.outcome === "success") {
          for (const entry of settled) {
            if (entry.providerId === winner.providerId) {
              continue;
            }
            if (entry.attempt.outcome === "failure") {
              failed.add(entry.providerId);
              continue;
            }
            updateItem(entry.providerId, { status: "skipped" });
          }

          setPreferredScrapeProvider(mediaKey, winner.providerId);
          setResult(winner.attempt.payload);
          setStatus("playing");
          setActiveProviderId(winner.providerId);
          failedProvidersRef.current.set(mediaKey, failed);
          return;
        }

        for (const entry of settled) {
          if (entry.attempt.outcome === "cancelled") {
            updateItem(entry.providerId, {
              status: "failure",
              error: "Timed out",
            });
          }
          failed.add(entry.providerId);
        }

        failedProvidersRef.current.set(mediaKey, failed);
        index = nextIndex;
      }

      if (runId !== runIdRef.current) {
        return;
      }

      setStatus("error");
      setError(allFailedError);
      setActiveProviderId(null);
    },
    [
      abortActiveFetches,
      allFailedError,
      getOrderForInput,
      mediaKeyFor,
      resetItems,
      scrapeProvider,
      updateItem,
    ],
  );

  const startScraping = useCallback(
    (input: TInput, preferredProviderId?: TProviderId) => {
      failedProvidersRef.current.delete(mediaKeyFor(input));
      const order = getOrderForInput(input);
      resetItems(order);
      const mediaKey = mediaKeyFor(input);
      const storedPreferred = getPreferredScrapeProvider(mediaKey);
      const preferredFromArg =
        preferredProviderId && order.includes(preferredProviderId)
          ? preferredProviderId
          : undefined;
      const preferredFromStore = order.find((id) => id === storedPreferred);
      const preferred = preferredFromArg ?? preferredFromStore;
      const preferredIndex = preferred ? order.indexOf(preferred) : -1;
      const startIndex = preferredIndex >= 0 ? preferredIndex : 0;
      void runScrapeLoop(input, startIndex, { useFailedCache: false });
    },
    [getOrderForInput, mediaKeyFor, resetItems, runScrapeLoop],
  );

  const resumeScraping = useCallback(
    (
      input: TInput,
      fromProviderId: TProviderId,
      failureReason = "Playback failed",
    ) => {
      const order = activeProviderOrderRef.current;
      const startIndex = order.indexOf(fromProviderId);
      const nextIndex = startIndex >= 0 ? startIndex + 1 : 0;
      const mediaKey = mediaKeyFor(input);
      const failed = failedProvidersRef.current.get(mediaKey) ?? new Set();
      failed.add(fromProviderId);
      failedProvidersRef.current.set(mediaKey, failed);
      clearPreferredScrapeProvider(mediaKey);
      updateItem(fromProviderId, {
        status: "failure",
        error: failureReason,
      });
      void runScrapeLoop(input, nextIndex, { useFailedCache: true });
    },
    [mediaKeyFor, runScrapeLoop, updateItem],
  );

  const switchToProvider = useCallback(
    (input: TInput, providerId: TProviderId) => {
      const order = getOrderForInput(input);
      const startIndex = order.indexOf(providerId);
      if (startIndex < 0) {
        return;
      }

      failedProvidersRef.current.delete(mediaKeyFor(input));
      resetItems(order);
      void runScrapeLoop(input, startIndex, { useFailedCache: false });
    },
    [getOrderForInput, mediaKeyFor, resetItems, runScrapeLoop],
  );

  const stopScraping = useCallback(() => {
    if (statusRef.current === "idle") {
      return;
    }

    runIdRef.current += 1;
    abortActiveFetches();

    if (currentInputRef.current) {
      failedProvidersRef.current.delete(mediaKeyFor(currentInputRef.current));
    }

    currentInputRef.current = null;
    setStatus("idle");
    setActiveProviderId(null);
    setResult(null);
    setError(null);
    resetItems(providerOrder);
  }, [abortActiveFetches, mediaKeyFor, providerOrder, resetItems]);

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
    stopScraping,
  };
}
