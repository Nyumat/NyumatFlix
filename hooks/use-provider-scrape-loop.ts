"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    ): Promise<ScrapeAttemptResult<TPayload>> => {
      updateItem(providerId, { status: "pending", error: undefined });
      setActiveProviderId(providerId);

      let response: Response;

      try {
        response = await fetch(apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildRequestBody(providerId, input)),
        });
      } catch {
        if (runId !== runIdRef.current) {
          return { outcome: "cancelled" };
        }

        updateItem(providerId, {
          status: "failure",
          error: "Request failed",
        });
        return { outcome: "failure" };
      }

      if (runId !== runIdRef.current) {
        return { outcome: "cancelled" };
      }

      let rawPayload: Record<string, unknown>;

      try {
        rawPayload = (await response.json()) as Record<string, unknown>;
      } catch {
        updateItem(providerId, {
          status: "failure",
          error: "Invalid response",
        });
        return { outcome: "failure" };
      }

      if (runId !== runIdRef.current) {
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

      for (let index = startFromIndex; index < order.length; index++) {
        if (runId !== runIdRef.current) {
          return;
        }

        const providerId = order[index];
        if (!providerId || failed.has(providerId)) {
          updateItem(providerId, { status: "skipped" });
          continue;
        }

        const attempt = await scrapeProvider(providerId, input, runId);
        if (runId !== runIdRef.current) {
          return;
        }

        if (attempt.outcome === "cancelled") {
          return;
        }

        if (attempt.outcome === "success") {
          setResult(attempt.payload);
          setStatus("playing");
          setActiveProviderId(providerId);
          return;
        }

        failed.add(providerId);
        failedProvidersRef.current.set(mediaKey, failed);
      }

      setStatus("error");
      setError(allFailedError);
      setActiveProviderId(null);
    },
    [
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
      const preferredIndex = preferredProviderId
        ? order.indexOf(preferredProviderId)
        : -1;
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

    if (currentInputRef.current) {
      failedProvidersRef.current.delete(mediaKeyFor(currentInputRef.current));
    }

    currentInputRef.current = null;
    setStatus("idle");
    setActiveProviderId(null);
    setResult(null);
    setError(null);
    resetItems(providerOrder);
  }, [mediaKeyFor, providerOrder, resetItems]);

  useEffect(
    () => () => {
      runIdRef.current += 1;
    },
    [],
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
