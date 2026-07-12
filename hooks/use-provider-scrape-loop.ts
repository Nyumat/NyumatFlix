"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { areScrapeProvidersExhausted } from "@/lib/scrape/scrape-provider-menu";
import {
  clearPreferredScrapeProvider,
  getPreferredScrapeProvider,
  setPreferredScrapeProvider,
} from "@/lib/scrape/preferred-provider";
import {
  deprioritizeProviders,
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
  const itemsRef = useRef<ScrapeItem[]>(items);
  itemsRef.current = items;

  const syncItems = useCallback(
    (updater: (current: ScrapeItem[]) => ScrapeItem[]) => {
      setItems((current) => {
        const next = updater(current);
        itemsRef.current = next;
        return next;
      });
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
        const errorMessage =
          typeof rawPayload.error === "string"
            ? rawPayload.error
            : "Unknown error";
        updateItem(providerId, {
          status: rawPayload.unavailable === true ? "unavailable" : "failure",
          error: errorMessage,
        });
        return { outcome: "failure" };
      }

      updateItem(providerId, { status: "success", error: undefined });
      return { outcome: "success", payload: rawPayload as TPayload };
    },
    [apiPath, buildRequestBody, updateItem],
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

  const finalizeSuccessfulProvider = useCallback(
    (order: readonly TProviderId[], providerId: TProviderId) => {
      const startIndex = order.indexOf(providerId);
      if (startIndex < 0) {
        return;
      }

      syncItems((current) =>
        current.map((item) => {
          const itemIndex = order.indexOf(item.providerId as TProviderId);

          if (item.providerId === providerId) {
            return {
              ...item,
              status: "success" as ScrapeItemStatus,
              error: undefined,
            };
          }

          if (itemIndex > startIndex && item.status === "waiting") {
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
          failed.delete(providerId);
          finalizeSuccessfulProvider(order, providerId);
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

      const nextUntriedIndex = order.findIndex((providerId) => {
        if (failed.has(providerId)) {
          return false;
        }

        const status =
          itemsRef.current.find((item) => item.providerId === providerId)
            ?.status ?? "idle";
        return status === "waiting" || status === "idle";
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
    },
    [
      abortActiveFetches,
      allFailedError,
      applyItemsForOrder,
      finalizeSuccessfulProvider,
      getOrderForInput,
      mediaKeyFor,
      resetItems,
      scrapeProvider,
      syncItems,
      updateItem,
    ],
  );

  const startScraping = useCallback(
    (input: TInput, preferredProviderId?: TProviderId) => {
      const baseOrder = getOrderForInput(input);
      const mediaKey = mediaKeyFor(input);
      const failed =
        failedProvidersRef.current.get(mediaKey) ?? new Set<TProviderId>();
      const storedPreferred = getPreferredScrapeProvider(mediaKey);
      const preferredFromArg =
        preferredProviderId && baseOrder.includes(preferredProviderId)
          ? preferredProviderId
          : undefined;
      const preferredFromStore = baseOrder.find((id) => id === storedPreferred);
      const preferred = preferredFromArg ?? preferredFromStore;
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
