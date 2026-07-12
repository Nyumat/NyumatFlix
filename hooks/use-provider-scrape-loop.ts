"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearPreferredScrapeProvider,
  getPreferredScrapeProvider,
  setPreferredScrapeProvider,
} from "@/lib/scrape/preferred-provider";
import {
  reorderProvidersWithPreferred,
  SCRAPE_ATTEMPT_TIMEOUT_MS,
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

  const reopenSkippedProviders = useCallback((failed: Set<TProviderId>) => {
    setItems((current) =>
      current.map((item) => {
        if (failed.has(item.providerId as TProviderId)) {
          return item;
        }

        if (item.status === "skipped" || item.status === "success") {
          return {
            ...item,
            status: "waiting" as ScrapeItemStatus,
            error: undefined,
          };
        }

        return item;
      }),
    );
  }, []);

  const markRemainingSkipped = useCallback(
    (order: readonly TProviderId[], afterProviderId: TProviderId) => {
      const startIndex = order.indexOf(afterProviderId);
      if (startIndex < 0) {
        return;
      }

      setItems((current) =>
        current.map((item) => {
          const itemIndex = order.indexOf(item.providerId as TProviderId);
          if (itemIndex <= startIndex) {
            return item;
          }

          if (item.status !== "waiting") {
            return item;
          }

          return {
            ...item,
            status: "skipped" as ScrapeItemStatus,
            error: undefined,
          };
        }),
      );
    },
    [],
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

      for (let index = startFromIndex; index < order.length; index += 1) {
        if (runId !== runIdRef.current) {
          return;
        }

        const providerId = order[index];
        if (providerId === undefined || failed.has(providerId)) {
          continue;
        }

        setActiveProviderId(providerId);

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

        const attempt = await scrapeProvider(
          providerId,
          input,
          runId,
          controller.signal,
        );

        abortControllersRef.current.delete(controller);

        if (runId !== runIdRef.current) {
          return;
        }

        if (attempt.outcome === "cancelled") {
          updateItem(providerId, {
            status: "failure",
            error: "Timed out",
          });
          failed.add(providerId);
          failedProvidersRef.current.set(mediaKey, failed);
          continue;
        }

        if (attempt.outcome === "success") {
          markRemainingSkipped(order, providerId);
          setPreferredScrapeProvider(mediaKey, providerId);
          setResult(attempt.payload);
          setStatus("playing");
          setActiveProviderId(providerId);
          failedProvidersRef.current.set(mediaKey, failed);
          return;
        }

        failed.add(providerId);
        failedProvidersRef.current.set(mediaKey, failed);
      }

      if (runId !== runIdRef.current) {
        return;
      }

      setItems((current) =>
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
    },
    [
      abortActiveFetches,
      allFailedError,
      getOrderForInput,
      markRemainingSkipped,
      mediaKeyFor,
      resetItems,
      scrapeProvider,
      updateItem,
    ],
  );

  const startScraping = useCallback(
    (input: TInput, preferredProviderId?: TProviderId) => {
      failedProvidersRef.current.delete(mediaKeyFor(input));
      const baseOrder = getOrderForInput(input);
      const mediaKey = mediaKeyFor(input);
      const storedPreferred = getPreferredScrapeProvider(mediaKey);
      const preferredFromArg =
        preferredProviderId && baseOrder.includes(preferredProviderId)
          ? preferredProviderId
          : undefined;
      const preferredFromStore = baseOrder.find((id) => id === storedPreferred);
      const preferred = preferredFromArg ?? preferredFromStore;
      const order = reorderProvidersWithPreferred(baseOrder, preferred);
      activeProviderOrderRef.current = order;
      resetItems(order);
      void runScrapeLoop(input, 0, { useFailedCache: false });
    },
    [getOrderForInput, mediaKeyFor, resetItems, runScrapeLoop],
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
