import { describe, expect, it } from "vitest";

import {
  DIRECT_UNAVAILABLE_CODE,
  DIRECT_UNAVAILABLE_MESSAGE,
  DirectUnavailableError,
  directUpstreamErrorBody,
  isBrowserDirectNetworkFailure,
  isDirectUnavailableHttpFailure,
  isDirectUpstreamUnreachable,
} from "@/lib/direct/upstream-unavailable";

describe("direct upstream unavailable", () => {
  it("treats a refused connection as the service being down", () => {
    const error = new TypeError("fetch failed");
    Object.assign(error, { cause: { code: "ECONNREFUSED" } });
    expect(isDirectUpstreamUnreachable(error)).toBe(true);
    expect(directUpstreamErrorBody(error)).toEqual({
      status: 503,
      body: { error: DIRECT_UNAVAILABLE_CODE },
    });
  });

  it("leaves client aborts alone", () => {
    const error = new DOMException("The operation was aborted", "AbortError");
    expect(isDirectUpstreamUnreachable(error)).toBe(false);
    expect(directUpstreamErrorBody(error).status).toBe(502);
  });

  it("maps legacy 502 fetch-failed bodies to a user-facing message", () => {
    expect(
      isDirectUnavailableHttpFailure(502, '{"error":"fetch failed"}'),
    ).toBe(true);
    expect(
      isDirectUnavailableHttpFailure(503, '{"error":"direct_unavailable"}'),
    ).toBe(true);
    expect(isDirectUnavailableHttpFailure(404, "missing")).toBe(false);
    expect(new DirectUnavailableError().message).toBe(
      DIRECT_UNAVAILABLE_MESSAGE,
    );
  });

  it("recognizes browser network failures", () => {
    expect(
      isBrowserDirectNetworkFailure(new TypeError("Failed to fetch")),
    ).toBe(true);
    expect(isBrowserDirectNetworkFailure(new Error("network error"))).toBe(
      true,
    );
    expect(
      isBrowserDirectNetworkFailure(new DOMException("aborted", "AbortError")),
    ).toBe(false);
  });
});
