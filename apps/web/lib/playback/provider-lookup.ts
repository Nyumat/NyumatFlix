import { fetchWithCapSession } from "@/lib/cap/client";
import type {
  SourceLookupItemPatch,
  SourceLookupRunner,
  SourceLookupWinner,
} from "@/lib/playback/source-lookup-cache";
import type { ScrapePlaybackPayload } from "@/lib/playback/to-playable-manifest";
import { anyAbortSignal } from "@/lib/scrape/abort";
import {
  getScrapeAttemptTimeoutMs,
  SCRAPE_RACE_CONCURRENCY,
} from "@/lib/scrape/provider-race";
import { firstOkInBatches } from "@/lib/scrape/race-first";
import type { ScrapeSubtitle } from "@/lib/scrape/types";

export type ScrapeApiResponse = {
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
  subtitlesDeferred?: boolean;
  error?: string;
};

export type ScrapeRequester = (
  body: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<ScrapeApiResponse>;

export type ProviderLookupRequest = {
  providerOrder: readonly string[];
  pinnedProviderId?: string;
  buildBody: (providerId: string) => Record<string, unknown>;
  requestScrape?: ScrapeRequester;
  timeoutMsFor?: (providerId: string, pinned: boolean) => number;
};

export const scrapeApiToPayload = (
  data: ScrapeApiResponse,
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

const requestScrapeViaApi: ScrapeRequester = async (body, signal) => {
  const response = await fetchWithCapSession("/api/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  return (await response.json()) as ScrapeApiResponse;
};

export type DeferredSubtitleRequester = (
  body: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<ScrapeSubtitle[]>;

export const requestDeferredSubtitlesViaApi: DeferredSubtitleRequester = async (
  body,
  signal,
) => {
  const response = await fetchWithCapSession("/api/scrape/subtitles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    return [];
  }
  const data = (await response.json()) as {
    ok?: boolean;
    subtitles?: ScrapeSubtitle[];
  };
  return data.ok && Array.isArray(data.subtitles) ? data.subtitles : [];
};

export const createProviderLookupRunner = ({
  providerOrder,
  pinnedProviderId,
  buildBody,
  requestScrape = requestScrapeViaApi,
  timeoutMsFor = getScrapeAttemptTimeoutMs,
}: ProviderLookupRequest): SourceLookupRunner => {
  return async ({ signal, reportItem }) => {
    const report = (patch: SourceLookupItemPatch) => {
      if (!signal.aborted) {
        reportItem(patch);
      }
    };

    const attempt = async (
      providerId: string,
      pinned: boolean,
      parentSignal: AbortSignal,
    ): Promise<SourceLookupWinner | null> => {
      if (parentSignal.aborted) {
        return null;
      }

      report({ providerId, status: "pending" });
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => {
          timeoutController.abort("timeout");
        },
        timeoutMsFor(providerId, pinned),
      );

      try {
        const data = await requestScrape(
          buildBody(providerId),
          anyAbortSignal(parentSignal, timeoutController.signal),
        );
        if (parentSignal.aborted) {
          return null;
        }
        if (data.ok && data.playUrl) {
          report({ providerId, status: "success" });
          return {
            providerId,
            payload: scrapeApiToPayload(data),
            subtitlesDeferred: data.subtitlesDeferred === true,
          };
        }
        report({
          providerId,
          status: "failure",
          error: data.error ?? "Request failed",
        });
        return null;
      } catch {
        if (parentSignal.aborted) {
          return null;
        }
        report({
          providerId,
          status: "failure",
          error: timeoutController.signal.aborted
            ? "Timed out"
            : "Request failed",
        });
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const race = async (order: readonly string[]) => {
      if (order.length === 0) {
        return null;
      }
      const winner = await firstOkInBatches(
        order,
        (providerId, attemptSignal) =>
          attempt(providerId, false, attemptSignal),
        SCRAPE_RACE_CONCURRENCY,
        { signal },
      );
      return winner?.value ?? null;
    };

    if (!pinnedProviderId) {
      return race(providerOrder);
    }

    const pinned = await attempt(pinnedProviderId, true, signal);
    if (pinned || signal.aborted) {
      return pinned;
    }
    return race(
      providerOrder.filter((providerId) => providerId !== pinnedProviderId),
    );
  };
};
