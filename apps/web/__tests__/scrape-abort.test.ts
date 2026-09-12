import { describe, expect, it } from "vitest";

import {
  anyAbortSignal,
  isAbortError,
  isScrapeAborted,
  shouldRetryScrapeFetchAttempt,
  throwIfScrapeAborted,
} from "@/lib/scrape/abort";

describe("scrape abort helpers", () => {
  it("does not retry after the client aborts", () => {
    const controller = new AbortController();
    expect(shouldRetryScrapeFetchAttempt(controller.signal)).toBe(true);
    expect(isScrapeAborted(controller.signal)).toBe(false);

    controller.abort();
    expect(shouldRetryScrapeFetchAttempt(controller.signal)).toBe(false);
    expect(isScrapeAborted(controller.signal)).toBe(true);
    expect(shouldRetryScrapeFetchAttempt()).toBe(true);
  });

  it("classifies abort and timeout errors", () => {
    expect(isAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new DOMException("Timed out", "TimeoutError"))).toBe(
      true,
    );
    expect(isAbortError(new Error("upstream 502"))).toBe(false);
  });

  it("composes abort signals when AbortSignal.any is missing", () => {
    const client = new AbortController();
    client.abort();
    expect(
      anyAbortSignal(client.signal, AbortSignal.timeout(55_000)).aborted,
    ).toBe(true);
  });

  it("throws when the signal is already aborted", () => {
    const controller = new AbortController();
    throwIfScrapeAborted(controller.signal);
    controller.abort();
    expect(() => throwIfScrapeAborted(controller.signal)).toThrowError(
      DOMException,
    );
  });
});
