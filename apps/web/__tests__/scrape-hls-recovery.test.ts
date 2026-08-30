import { describe, expect, it, vi } from "vitest";
import Hls, { type ErrorData, type Level } from "hls.js";

import {
  bufferedAheadSeconds,
  configureScrapeHlsInstance,
  decideScrapeHlsFatalRecovery,
  isScrapeHlsMidstream,
  isUnrecoverableScrapeHlsError,
  nextScrapeHlsLevelAfterError,
  pickNextLowerHlsLevelIndex,
  PLAYING_FRAG_LOADING_MAX_RETRY,
  PLAYING_FRAG_LOADING_TIMEOUT_MS,
  scrapeHlsRecoveryBudget,
  shouldFailoverScrapeHlsFatal,
} from "@/lib/scrape/hls-quality";

const fakeBuffered = (ranges: Array<[number, number]>) => ({
  length: ranges.length,
  start: (index: number) => ranges[index]?.[0] ?? 0,
  end: (index: number) => ranges[index]?.[1] ?? 0,
});

const fatal = (
  overrides: Partial<ErrorData> & Pick<ErrorData, "type">,
): ErrorData =>
  ({
    fatal: true,
    details: "fragLoadError",
    ...overrides,
  }) as ErrorData;

describe("scrape hls midstream recovery", () => {
  it("measures buffer ahead only inside the active range", () => {
    expect(
      bufferedAheadSeconds({
        currentTime: 12,
        buffered: fakeBuffered([
          [0, 10],
          [11, 40],
        ]),
      }),
    ).toBe(28);

    expect(
      bufferedAheadSeconds({
        currentTime: 10.5,
        buffered: fakeBuffered([
          [0, 10],
          [11, 40],
        ]),
      }),
    ).toBe(0);
  });

  it("treats playhead past 1s or >1s of buffer as midstream", () => {
    expect(
      isScrapeHlsMidstream({
        currentTime: 0,
        buffered: fakeBuffered([]),
      }),
    ).toBe(false);

    expect(
      isScrapeHlsMidstream({
        currentTime: 0.2,
        buffered: fakeBuffered([[0, 0.4]]),
      }),
    ).toBe(false);

    expect(
      isScrapeHlsMidstream({
        currentTime: 0.2,
        buffered: fakeBuffered([[0, 12]]),
      }),
    ).toBe(true);

    expect(
      isScrapeHlsMidstream({
        currentTime: 90,
        buffered: fakeBuffered([]),
      }),
    ).toBe(true);
  });

  it("treats 403/404 and mux errors as unrecoverable", () => {
    expect(
      isUnrecoverableScrapeHlsError(
        fatal({
          type: Hls.ErrorTypes.NETWORK_ERROR,
          response: { code: 403, text: "Forbidden", url: "https://cdn/x" },
        }),
      ),
    ).toBe(true);

    expect(
      isUnrecoverableScrapeHlsError(
        fatal({
          type: Hls.ErrorTypes.NETWORK_ERROR,
          response: { code: 404, text: "Not Found", url: "https://cdn/x" },
        }),
      ),
    ).toBe(true);

    expect(
      isUnrecoverableScrapeHlsError(fatal({ type: Hls.ErrorTypes.MUX_ERROR })),
    ).toBe(true);

    expect(
      isUnrecoverableScrapeHlsError(
        fatal({
          type: Hls.ErrorTypes.NETWORK_ERROR,
          response: { code: 503, text: "Unavailable", url: "https://cdn/x" },
        }),
      ),
    ).toBe(false);
  });

  it("gives a larger retry budget when the buffer can cover a blip", () => {
    expect(scrapeHlsRecoveryBudget(12)).toEqual({ network: 3, media: 2 });
    expect(scrapeHlsRecoveryBudget(4)).toEqual({ network: 2, media: 1 });
    expect(scrapeHlsRecoveryBudget(0.5)).toEqual({ network: 1, media: 1 });
  });

  it("fails fast before the first frame and recovers in place midstream", () => {
    const budget = scrapeHlsRecoveryBudget(20);

    expect(
      decideScrapeHlsFatalRecovery({
        midstream: false,
        unrecoverable: false,
        errorType: Hls.ErrorTypes.NETWORK_ERROR,
        networkRetries: 0,
        mediaRetries: 0,
        budget,
      }),
    ).toBe("fail-fast");

    expect(
      decideScrapeHlsFatalRecovery({
        midstream: true,
        unrecoverable: false,
        errorType: Hls.ErrorTypes.NETWORK_ERROR,
        networkRetries: 0,
        mediaRetries: 0,
        budget,
      }),
    ).toBe("recover-network");

    expect(
      decideScrapeHlsFatalRecovery({
        midstream: true,
        unrecoverable: false,
        errorType: Hls.ErrorTypes.MEDIA_ERROR,
        networkRetries: 0,
        mediaRetries: 0,
        budget,
      }),
    ).toBe("recover-media");

    expect(
      decideScrapeHlsFatalRecovery({
        midstream: true,
        unrecoverable: true,
        errorType: Hls.ErrorTypes.NETWORK_ERROR,
        networkRetries: 0,
        mediaRetries: 0,
        budget,
      }),
    ).toBe("unrecoverable");

    expect(
      decideScrapeHlsFatalRecovery({
        midstream: true,
        unrecoverable: false,
        errorType: Hls.ErrorTypes.NETWORK_ERROR,
        networkRetries: 3,
        mediaRetries: 0,
        budget,
      }),
    ).toBe("exhausted");
  });

  it("does not hop vidstack on the first recoverable midstream fatal", () => {
    expect(
      shouldFailoverScrapeHlsFatal(
        fatal({ type: Hls.ErrorTypes.MEDIA_ERROR }),
        true,
      ),
    ).toBe(false);

    expect(
      shouldFailoverScrapeHlsFatal(
        fatal({ type: Hls.ErrorTypes.MEDIA_ERROR }),
        false,
      ),
    ).toBe(true);

    expect(
      shouldFailoverScrapeHlsFatal(
        fatal({
          type: Hls.ErrorTypes.NETWORK_ERROR,
          response: { code: 404, text: "Not Found", url: "https://cdn/x" },
        }),
        true,
      ),
    ).toBe(true);

    expect(
      shouldFailoverScrapeHlsFatal(
        { fatal: false, type: Hls.ErrorTypes.MEDIA_ERROR } as ErrorData,
        false,
      ),
    ).toBe(false);
  });

  it("drops to the next lower HLS rung before enabling ABR", () => {
    const levels = [
      { height: 480, url: "https://cdn/480p/index.m3u8" },
      { height: 720, url: "https://cdn/720p/index.m3u8" },
      { height: 1080, url: "https://cdn/1080p/index.m3u8" },
    ] as unknown as Level[];

    expect(pickNextLowerHlsLevelIndex(levels, 2)).toBe(1);
    expect(nextScrapeHlsLevelAfterError(levels, 0)).toBe(-1);
    expect(nextScrapeHlsLevelAfterError(levels.slice(0, 1), 0)).toBeNull();
  });

  it("recovers a midstream network fatal without notifying failover", () => {
    const listeners = new Map<
      string,
      Array<(event: string, detail?: ErrorData) => void>
    >();
    const startLoad = vi.fn();
    const recoverMediaError = vi.fn();
    const onRecoveryExhausted = vi.fn();
    const media = {
      currentTime: 42,
      buffered: fakeBuffered([[30, 90]]),
    };

    const hls = {
      media,
      levels: [],
      currentLevel: -1,
      config: {
        fragLoadingTimeOut: 60_000,
        fragLoadingMaxRetry: 6,
      },
      on: (
        event: string,
        callback: (event: string, detail?: ErrorData) => void,
      ) => {
        const list = listeners.get(event) ?? [];
        list.push(callback);
        listeners.set(event, list);
      },
      startLoad,
      recoverMediaError,
    };

    configureScrapeHlsInstance(hls as unknown as Hls, { onRecoveryExhausted });

    const emitError = (detail: ErrorData) => {
      for (const callback of listeners.get(Hls.Events.ERROR) ?? []) {
        callback(Hls.Events.ERROR, detail);
      }
    };

    const first = fatal({ type: Hls.ErrorTypes.NETWORK_ERROR });
    emitError(first);

    expect(first.fatal).toBe(false);
    expect(startLoad).toHaveBeenCalledWith(42);
    expect(recoverMediaError).not.toHaveBeenCalled();
    expect(onRecoveryExhausted).not.toHaveBeenCalled();
  });

  it("does not recover a startup fatal so vidstack can fail fast", () => {
    const listeners = new Map<
      string,
      Array<(event: string, detail?: ErrorData) => void>
    >();
    const startLoad = vi.fn();
    const onRecoveryExhausted = vi.fn();

    const hls = {
      media: {
        currentTime: 0,
        buffered: fakeBuffered([]),
      },
      levels: [],
      currentLevel: -1,
      config: {
        fragLoadingTimeOut: 60_000,
        fragLoadingMaxRetry: 6,
      },
      on: (
        event: string,
        callback: (event: string, detail?: ErrorData) => void,
      ) => {
        const list = listeners.get(event) ?? [];
        list.push(callback);
        listeners.set(event, list);
      },
      startLoad,
      recoverMediaError: vi.fn(),
    };

    configureScrapeHlsInstance(hls as unknown as Hls, { onRecoveryExhausted });

    const detail = fatal({ type: Hls.ErrorTypes.NETWORK_ERROR });
    for (const callback of listeners.get(Hls.Events.ERROR) ?? []) {
      callback(Hls.Events.ERROR, detail);
    }

    expect(detail.fatal).toBe(true);
    expect(startLoad).not.toHaveBeenCalled();
    expect(onRecoveryExhausted).not.toHaveBeenCalled();
  });

  it("hops after the midstream retry budget is spent", () => {
    const listeners = new Map<
      string,
      Array<(event: string, detail?: ErrorData) => void>
    >();
    const startLoad = vi.fn();
    const onRecoveryExhausted = vi.fn();
    const media = {
      currentTime: 8,
      buffered: fakeBuffered([[8, 9]]),
    };

    const hls = {
      media,
      levels: [],
      currentLevel: -1,
      config: {
        fragLoadingTimeOut: 60_000,
        fragLoadingMaxRetry: 6,
      },
      on: (
        event: string,
        callback: (event: string, detail?: ErrorData) => void,
      ) => {
        const list = listeners.get(event) ?? [];
        list.push(callback);
        listeners.set(event, list);
      },
      startLoad,
      recoverMediaError: vi.fn(),
    };

    configureScrapeHlsInstance(hls as unknown as Hls, { onRecoveryExhausted });

    const emitError = () => {
      const detail = fatal({ type: Hls.ErrorTypes.NETWORK_ERROR });
      for (const callback of listeners.get(Hls.Events.ERROR) ?? []) {
        callback(Hls.Events.ERROR, detail);
      }
      return detail;
    };

    const first = emitError();
    expect(first.fatal).toBe(false);
    expect(onRecoveryExhausted).not.toHaveBeenCalled();

    const second = emitError();
    expect(second.fatal).toBe(true);
    expect(onRecoveryExhausted).toHaveBeenCalledTimes(1);
  });

  it("tightens fragment retries after the first successful load", () => {
    const listeners = new Map<string, Array<() => void>>();
    const hls = {
      media: null,
      levels: [],
      currentLevel: -1,
      config: {
        fragLoadingTimeOut: 60_000,
        fragLoadingMaxRetry: 6,
      },
      on: (event: string, callback: () => void) => {
        const list = listeners.get(event) ?? [];
        list.push(callback);
        listeners.set(event, list);
      },
      startLoad: vi.fn(),
      recoverMediaError: vi.fn(),
    };

    configureScrapeHlsInstance(hls as unknown as Hls);

    for (const callback of listeners.get(Hls.Events.FRAG_LOADED) ?? []) {
      callback();
    }

    expect(hls.config.fragLoadingTimeOut).toBe(PLAYING_FRAG_LOADING_TIMEOUT_MS);
    expect(hls.config.fragLoadingMaxRetry).toBe(PLAYING_FRAG_LOADING_MAX_RETRY);
  });
});
