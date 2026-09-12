"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWithCapSession } from "@/lib/cap/client";
import {
  toPlayableManifestFromScrape,
  type ScrapePlaybackPayload,
} from "@/lib/playback/to-playable-manifest";
import { snapshotLivePlayback } from "@/lib/playback/retain-live-playback";
import type { PlayableManifest } from "@nyumatflix/playback";
import { buildPinnedProviderResolveOrder } from "@/lib/scrape/next-provider";
import {
  getScrapeAttemptTimeoutMs,
  SCRAPE_RACE_CONCURRENCY,
} from "@/lib/scrape/provider-race";
import { firstOkInBatches } from "@/lib/scrape/race-first";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";

export type PlaybackResolveStatus = "idle" | "scraping" | "playing" | "error";

type ScrapeApiResponse = {
  ok: boolean;
  providerId?: string;
  providerName?: string;
  playUrl?: string;
  streamKind?: "hls" | "dash" | "mp4";
  referer?: string;
  qualities?: ScrapePlaybackPayload["qualities"];
  subtitles?: ScrapePlaybackPayload["subtitles"];
  audioVersions?: ScrapePlaybackPayload["audioVersions"];
  defaultAudioLang?: string;
  defaultHardSubLang?: string;
  preferredAudioLang?: string;
  directPlayback?: ScrapePlaybackPayload["directPlayback"];
  directFallbackUrl?: string;
  directStreamName?: string;
  directFileName?: string;
  error?: string;
};

export type PlaybackResolveConfig<
  TInput,
  TResult extends ScrapePlaybackPayload,
> = {
  mediaKeyFor: (input: TInput) => string;
  providerOrderFor: (input: TInput) => readonly string[];
  providerLabels: Record<string, string>;
  buildScrapeBody: (
    input: TInput,
    providerId: string,
  ) => Record<string, unknown>;
  allFailedError?: string;
  onAllProvidersFailed?: () => void;
  mapResult?: (payload: ScrapePlaybackPayload) => TResult;
};

const scrapeApiToPayload = (
  data: ScrapeApiResponse & { ok: true },
): ScrapePlaybackPayload => ({
  providerId: data.providerId ?? "",
  providerName: data.providerName ?? data.providerId ?? "",
  playUrl: data.playUrl ?? "",
  streamKind: data.streamKind,
  referer: data.referer,
  qualities: data.qualities,
  subtitles: data.subtitles,
  audioVersions: data.audioVersions,
  defaultAudioLang: data.defaultAudioLang,
  defaultHardSubLang: data.defaultHardSubLang,
  preferredAudioLang: data.preferredAudioLang,
  directPlayback: data.directPlayback,
  directFallbackUrl: data.directFallbackUrl,
  directStreamName: data.directStreamName,
  directFileName: data.directFileName,
});

const initialOverlayItems = (
  providerOrder: readonly string[],
  providerLabels: Record<string, string>,
): ScrapeItem[] =>
  providerOrder.map((providerId) => ({
    providerId,
    name: providerLabels[providerId] ?? providerId,
    status: "waiting" as ScrapeItemStatus,
  }));

export function usePlaybackResolve<
  TInput,
  TResult extends ScrapePlaybackPayload = ScrapePlaybackPayload,
>(config: PlaybackResolveConfig<TInput, TResult>) {
  const {
    mediaKeyFor,
    providerOrderFor,
    providerLabels,
    buildScrapeBody,
    allFailedError = "No playable source found.",
    onAllProvidersFailed,
    mapResult = (payload) => payload as TResult,
  } = config;

  const [items, setItems] = useState<ScrapeItem[]>([]);
  const [status, setStatus] = useState<PlaybackResolveStatus>("idle");
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [manifest, setManifest] = useState<PlayableManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef(status);
  const resultRef = useRef(result);
  const manifestRef = useRef(manifest);
  const retainedPlaybackRef = useRef<ReturnType<
    typeof snapshotLivePlayback<TResult>
  > | null>(null);
  statusRef.current = status;
  resultRef.current = result;
  manifestRef.current = manifest;

  const stopRace = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const restoreRetainedPlayback = useCallback(() => {
    const retained = retainedPlaybackRef.current;
    if (!retained) {
      return false;
    }
    setResult(retained.result);
    setManifest(retained.manifest);
    setStatus("playing");
    setError(null);
    retainedPlaybackRef.current = null;
    return true;
  }, []);

  const patchItem = useCallback(
    (
      providerId: string,
      patch: Partial<Pick<ScrapeItem, "status" | "error">>,
    ) => {
      setItems((current) =>
        current.map((item) =>
          item.providerId === providerId ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const scrapeProvider = useCallback(
    async (
      input: TInput,
      providerId: string,
      pinned: boolean,
      runId: number,
      parentSignal: AbortSignal,
    ): Promise<ScrapePlaybackPayload | null> => {
      if (runId !== runIdRef.current || parentSignal.aborted) {
        return null;
      }

      patchItem(providerId, { status: "pending", error: undefined });
      setActiveProviderId(providerId);

      const timeoutMs = getScrapeAttemptTimeoutMs(providerId, pinned);
      const timeoutController = new AbortController();
      const timeoutId = window.setTimeout(() => {
        if (!timeoutController.signal.aborted) {
          timeoutController.abort("timeout");
        }
      }, timeoutMs);

      const linkedSignal =
        typeof AbortSignal.any === "function"
          ? AbortSignal.any([parentSignal, timeoutController.signal])
          : parentSignal;

      try {
        const response = await fetchWithCapSession("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildScrapeBody(input, providerId)),
          signal: linkedSignal,
        });

        if (runId !== runIdRef.current) {
          return null;
        }

        const data = (await response.json()) as ScrapeApiResponse;
        if (data.ok && data.playUrl) {
          patchItem(providerId, { status: "success", error: undefined });
          return scrapeApiToPayload({ ...data, ok: true });
        }

        patchItem(providerId, {
          status: "failure",
          error: data.error ?? "Request failed",
        });
        return null;
      } catch {
        if (runId !== runIdRef.current || parentSignal.aborted) {
          return null;
        }
        patchItem(providerId, {
          status: "failure",
          error:
            timeoutController.signal.aborted && !parentSignal.aborted
              ? "Timed out"
              : "Request failed",
        });
        return null;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [buildScrapeBody, patchItem],
  );

  const startResolve = useCallback(
    async (input: TInput, options?: { pinnedProviderId?: string }) => {
      stopRace();
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      retainedPlaybackRef.current = snapshotLivePlayback({
        status: statusRef.current,
        result: resultRef.current,
        manifest: manifestRef.current,
      });

      const pinnedProviderId = options?.pinnedProviderId;
      const providerOrder = buildPinnedProviderResolveOrder(
        providerOrderFor(input),
        pinnedProviderId,
      );

      setItems(initialOverlayItems(providerOrder, providerLabels));
      setStatus("scraping");
      setError(null);
      if (!retainedPlaybackRef.current) {
        setResult(null);
        setManifest(null);
      }
      setActiveProviderId(pinnedProviderId ?? providerOrder[0] ?? null);

      let winner: { item: string; value: ScrapePlaybackPayload } | null = null;

      if (pinnedProviderId) {
        const pinnedPayload = await scrapeProvider(
          input,
          pinnedProviderId,
          true,
          runId,
          controller.signal,
        );

        if (pinnedPayload) {
          winner = { item: pinnedProviderId, value: pinnedPayload };
        } else if (runId === runIdRef.current && !controller.signal.aborted) {
          const remainder = providerOrder.filter(
            (providerId) => providerId !== pinnedProviderId,
          );

          if (remainder.length > 0) {
            winner = await firstOkInBatches(
              remainder,
              (providerId, signal) =>
                scrapeProvider(input, providerId, false, runId, signal),
              SCRAPE_RACE_CONCURRENCY,
              { signal: controller.signal },
            );
          }
        }
      } else {
        winner = await firstOkInBatches(
          providerOrder,
          (providerId, signal) =>
            scrapeProvider(input, providerId, false, runId, signal),
          SCRAPE_RACE_CONCURRENCY,
          { signal: controller.signal },
        );
      }

      if (runId !== runIdRef.current) {
        return;
      }

      if (winner?.value) {
        const mapped = mapResult(winner.value);
        setResult(mapped);
        setManifest(toPlayableManifestFromScrape(mapped));
        setStatus("playing");
        setError(null);
        setActiveProviderId(winner.item);
        retainedPlaybackRef.current = null;

        setItems((current) =>
          current.map((item) => {
            if (item.providerId === winner.item) {
              return { ...item, status: "success" as ScrapeItemStatus };
            }
            if (item.status === "pending") {
              return { ...item, status: "skipped" as ScrapeItemStatus };
            }
            return item;
          }),
        );
        return;
      }

      if (restoreRetainedPlayback()) {
        return;
      }

      setStatus("error");
      setError(allFailedError);
      setResult(null);
      setManifest(null);
      onAllProvidersFailed?.();
    },
    [
      allFailedError,
      mapResult,
      onAllProvidersFailed,
      providerLabels,
      providerOrderFor,
      restoreRetainedPlayback,
      scrapeProvider,
      stopRace,
    ],
  );

  const startScraping = useCallback(
    (input: TInput) => {
      void startResolve(input);
    },
    [startResolve],
  );

  const switchToProvider = useCallback(
    (input: TInput, providerId: string) => {
      void startResolve(input, { pinnedProviderId: providerId });
    },
    [startResolve],
  );

  const resumeScraping = useCallback(
    (input: TInput, fromProviderId?: string) => {
      void startResolve(
        input,
        fromProviderId ? { pinnedProviderId: fromProviderId } : undefined,
      );
    },
    [startResolve],
  );

  const retryAllScraping = useCallback(
    (input: TInput) => {
      void startResolve(input);
    },
    [startResolve],
  );

  const stopScraping = useCallback(() => {
    runIdRef.current += 1;
    stopRace();
    retainedPlaybackRef.current = null;
    setStatus("idle");
    setActiveProviderId(null);
    setResult(null);
    setManifest(null);
    setError(null);
    setItems([]);
  }, [stopRace]);

  useEffect(
    () => () => {
      stopScraping();
    },
    [stopScraping],
  );

  return {
    items,
    status,
    activeProviderId,
    result,
    manifest,
    error,
    startScraping,
    resumeScraping,
    switchToProvider,
    retryAllScraping,
    stopScraping,
    mediaKeyFor,
  };
}
