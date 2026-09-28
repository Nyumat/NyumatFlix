"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  toPlayableManifestFromScrape,
  type ScrapePlaybackPayload,
} from "@/lib/playback/to-playable-manifest";
import { snapshotLivePlayback } from "@/lib/playback/retain-live-playback";
import {
  createProviderLookupRunner,
  requestDeferredSubtitlesViaApi,
  type DeferredSubtitleRequester,
  type ScrapeRequester,
} from "@/lib/playback/provider-lookup";
import {
  buildSourceLookupKey,
  sourceLookupCache,
  type SourceLookupCache,
  type SourceLookupWinner,
} from "@/lib/playback/source-lookup-cache";
import type { PlayableManifest } from "@nyumatflix/playback";
import { buildPinnedProviderResolveOrder } from "@/lib/scrape/next-provider";
import { mergePayloadSubtitles } from "@/lib/scrape/subtitle-harvest";
import type { ScrapeItem, ScrapeItemStatus } from "@/lib/scrape/types";

export type PlaybackResolveStatus = "idle" | "scraping" | "playing" | "error";

export type PlaybackResolveConfig<
  TInput,
  TResult extends ScrapePlaybackPayload,
> = {
  mediaKeyFor: (input: TInput) => string;
  /** playback is only retained across lookups that share this key. */
  episodeKeyFor?: (input: TInput) => string;
  providerOrderFor: (input: TInput) => readonly string[];
  providerLabels: Record<string, string>;
  buildScrapeBody: (
    input: TInput,
    providerId: string,
  ) => Record<string, unknown>;
  allFailedError?: string;
  onAllProvidersFailed?: () => void;
  mapResult?: (payload: ScrapePlaybackPayload) => TResult;
  /** identifies a lookup: episode plus any audio preferences sent upstream. */
  lookupKeyFor?: (input: TInput) => string;
  subtitleRequestFor?: (input: TInput) => Record<string, unknown> | null;
  lookupCache?: SourceLookupCache;
  requestScrape?: ScrapeRequester;
  requestSubtitles?: DeferredSubtitleRequester;
};

export type PlaybackResolveOptions = {
  pinnedProviderId?: string;
  fresh?: boolean;
  retain?: boolean;
};

export type PlaybackPrefetchHandle = {
  done: Promise<boolean>;
  cancel: () => void;
};

type ResultSource = {
  lookupKey: string;
  cached: boolean;
  pinnedProviderId?: string;
};

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
    episodeKeyFor = mediaKeyFor,
    lookupKeyFor = mediaKeyFor,
    subtitleRequestFor,
    lookupCache = sourceLookupCache,
    requestScrape,
    requestSubtitles = requestDeferredSubtitlesViaApi,
  } = config;

  const [items, setItems] = useState<ScrapeItem[]>([]);
  const [status, setStatus] = useState<PlaybackResolveStatus>("idle");
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [manifest, setManifest] = useState<PlayableManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [episodeKey, setEpisodeKey] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const statusRef = useRef(status);
  const resultRef = useRef(result);
  const manifestRef = useRef(manifest);
  const episodeKeyRef = useRef<string | null>(null);
  const resultSourceRef = useRef<ResultSource | null>(null);
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

  const createRunner = useCallback(
    (
      input: TInput,
      providerOrder: readonly string[],
      pinnedProviderId?: string,
    ) =>
      createProviderLookupRunner({
        providerOrder,
        pinnedProviderId,
        buildBody: (providerId) => buildScrapeBody(input, providerId),
        requestScrape,
      }),
    [buildScrapeBody, requestScrape],
  );

  const loadDeferredSubtitles = useCallback(
    async (
      runId: number,
      input: TInput,
      lookupKey: string,
      winner: SourceLookupWinner,
      signal: AbortSignal,
    ) => {
      const body = subtitleRequestFor?.(input);
      if (!body) {
        return;
      }

      const subtitles = await requestSubtitles(body, signal).catch(() => []);
      if (
        runId !== runIdRef.current ||
        signal.aborted ||
        subtitles.length === 0
      ) {
        return;
      }

      const payload = mergePayloadSubtitles(winner.payload, subtitles);
      lookupCache.replace(lookupKey, {
        ...winner,
        payload,
        subtitlesDeferred: false,
      });
      const mapped = mapResult(payload);
      setResult(mapped);
      setManifest(toPlayableManifestFromScrape(mapped));
    },
    [lookupCache, mapResult, requestSubtitles, subtitleRequestFor],
  );

  const startResolve = useCallback(
    async (input: TInput, options?: PlaybackResolveOptions) => {
      stopRace();
      runIdRef.current += 1;
      const runId = runIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      const nextEpisodeKey = episodeKeyFor(input);
      const sameEpisode = episodeKeyRef.current === nextEpisodeKey;
      retainedPlaybackRef.current =
        sameEpisode && options?.retain !== false
          ? snapshotLivePlayback({
              status: statusRef.current,
              result: resultRef.current,
              manifest: manifestRef.current,
            })
          : null;
      episodeKeyRef.current = nextEpisodeKey;
      setEpisodeKey(nextEpisodeKey);

      const pinnedProviderId = options?.pinnedProviderId;
      const providerOrder = buildPinnedProviderResolveOrder(
        providerOrderFor(input),
        pinnedProviderId,
      );
      const lookupKey = buildSourceLookupKey({
        lookupKey: lookupKeyFor(input),
        providerOrder,
        pinnedProviderId,
      });

      setItems(initialOverlayItems(providerOrder, providerLabels));
      setStatus("scraping");
      setError(null);
      if (!retainedPlaybackRef.current) {
        resultSourceRef.current = null;
        setResult(null);
        setManifest(null);
      }
      setActiveProviderId(pinnedProviderId ?? providerOrder[0] ?? null);

      const outcome = await lookupCache.lookup(
        lookupKey,
        createRunner(input, providerOrder, pinnedProviderId),
        {
          signal: controller.signal,
          fresh: options?.fresh,
          onItem: (patch) => {
            if (runId !== runIdRef.current) {
              return;
            }
            patchItem(patch.providerId, {
              status: patch.status,
              error: patch.error,
            });
            if (patch.status === "pending") {
              setActiveProviderId(patch.providerId);
            }
          },
        },
      );

      if (runId !== runIdRef.current) {
        return;
      }

      const winner = outcome.winner;
      if (winner) {
        const mapped = mapResult(winner.payload);
        setResult(mapped);
        setManifest(toPlayableManifestFromScrape(mapped));
        setStatus("playing");
        setError(null);
        setActiveProviderId(winner.providerId);
        retainedPlaybackRef.current = null;
        resultSourceRef.current = {
          lookupKey,
          cached: outcome.cached,
          pinnedProviderId,
        };

        setItems((current) =>
          current.map((item) => {
            if (item.providerId === winner.providerId) {
              return { ...item, status: "success" as ScrapeItemStatus };
            }
            if (item.status === "pending") {
              return { ...item, status: "skipped" as ScrapeItemStatus };
            }
            return item;
          }),
        );

        if (winner.subtitlesDeferred) {
          void loadDeferredSubtitles(
            runId,
            input,
            lookupKey,
            winner,
            controller.signal,
          );
        }
        return;
      }

      if (restoreRetainedPlayback()) {
        return;
      }

      resultSourceRef.current = null;
      setStatus("error");
      setError(allFailedError);
      setResult(null);
      setManifest(null);
      onAllProvidersFailed?.();
    },
    [
      allFailedError,
      createRunner,
      loadDeferredSubtitles,
      lookupCache,
      lookupKeyFor,
      mapResult,
      episodeKeyFor,
      onAllProvidersFailed,
      patchItem,
      providerLabels,
      providerOrderFor,
      restoreRetainedPlayback,
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
      void startResolve(input, {
        pinnedProviderId: fromProviderId,
        fresh: true,
      });
    },
    [startResolve],
  );

  const retryAllScraping = useCallback(
    (input: TInput) => {
      void startResolve(input, { fresh: true });
    },
    [startResolve],
  );

  const prefetch = useCallback(
    (input: TInput): PlaybackPrefetchHandle => {
      const providerOrder = buildPinnedProviderResolveOrder(
        providerOrderFor(input),
      );
      const lookupKey = buildSourceLookupKey({
        lookupKey: lookupKeyFor(input),
        providerOrder,
      });
      const controller = new AbortController();
      const done = lookupCache
        .lookup(lookupKey, createRunner(input, providerOrder), {
          signal: controller.signal,
        })
        .then((outcome) => outcome.winner !== null);
      return { done, cancel: () => controller.abort() };
    },
    [createRunner, lookupCache, lookupKeyFor, providerOrderFor],
  );

  const evictCurrentResult = useCallback(() => {
    const source = resultSourceRef.current;
    if (source) {
      lookupCache.evict(source.lookupKey);
    }
  }, [lookupCache]);

  /** a cached stream may have expired upstream; retry once with a fresh lookup. */
  const recoverCachedStartFailure = useCallback(
    (input: TInput): boolean => {
      const source = resultSourceRef.current;
      if (!source?.cached || episodeKeyRef.current !== episodeKeyFor(input)) {
        return false;
      }
      lookupCache.evict(source.lookupKey);
      void startResolve(input, {
        pinnedProviderId: source.pinnedProviderId,
        fresh: true,
        retain: false,
      });
      return true;
    },
    [episodeKeyFor, lookupCache, startResolve],
  );

  const stopScraping = useCallback(() => {
    runIdRef.current += 1;
    stopRace();
    retainedPlaybackRef.current = null;
    resultSourceRef.current = null;
    episodeKeyRef.current = null;
    setEpisodeKey(null);
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
    episodeKey,
    startScraping,
    resumeScraping,
    switchToProvider,
    retryAllScraping,
    stopScraping,
    prefetch,
    evictCurrentResult,
    recoverCachedStartFailure,
    mediaKeyFor,
  };
}
