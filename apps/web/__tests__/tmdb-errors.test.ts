import { describe, expect, test } from "vitest";
import { isTmdbNotFoundError, TmdbHttpError } from "@/lib/tmdb-errors";

describe("isTmdbNotFoundError", () => {
  test("detects TmdbHttpError instances", () => {
    expect(isTmdbNotFoundError(new TmdbHttpError(404, "not found"))).toBe(true);
    expect(isTmdbNotFoundError(new TmdbHttpError(500, "server error"))).toBe(
      false,
    );
  });

  test("detects moviedb-promise axios errors with top-level status", () => {
    expect(
      isTmdbNotFoundError({
        isAxiosError: true,
        status: 404,
        message: "Request failed with status code 404",
      }),
    ).toBe(true);
  });

  test("detects axios errors with nested response status", () => {
    expect(
      isTmdbNotFoundError({
        response: { status: 404 },
      }),
    ).toBe(true);
  });

  test("returns false for other status codes", () => {
    expect(
      isTmdbNotFoundError({
        status: 500,
      }),
    ).toBe(false);
  });

  test("returns false for non-error values", () => {
    expect(isTmdbNotFoundError(null)).toBe(false);
    expect(isTmdbNotFoundError("not found")).toBe(false);
  });
});
